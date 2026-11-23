"""Motor KYC extraction and merging with the policy data.

Only the fields needed for advisory and email are read (name, DOB, mobile,
email). Full ID numbers (Aadhaar / PAN) are deliberately never requested, kept
or stored.
"""
import json
import os
import re

KYC_PROMPT = """You are an expert KYC document reader for Indian motor insurance.
I will give you a KYC document (Aadhaar, PAN, driving licence, passport, voter ID or a KYC form).
Extract ONLY the following and return ONLY a valid JSON object:
{
  "fullName": "string (full name of the person as printed)",
  "dob": "string (Date of Birth formatted EXACTLY as YYYY-MM-DD, or 'Not Found')",
  "mobile": "string (10-digit mobile number if printed, else 'Not Found')",
  "email": "string (email address if printed, else 'Not Found')",
  "documentType": "string (e.g. Aadhaar, PAN, Driving Licence, Passport, Voter ID, KYC Form)"
}
Do NOT output any ID number (Aadhaar, PAN, licence number). If a field is not visible, use "Not Found".
Output pure JSON with no markdown or extra text."""

_NOT_FOUND = {'', 'not found', 'n/a', 'na', 'none', 'null', 'unknown'}


def clean(value):
    """Return a stripped string, or None for empty / 'Not Found' style values."""
    if value is None:
        return None
    text = str(value).strip()
    return None if text.lower() in _NOT_FOUND else text


def normalize_dob(value):
    """Normalise a date string to YYYY-MM-DD where possible."""
    text = clean(value)
    if not text:
        return None
    m = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b', text)
    if m:
        day, month, year = m.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    m = re.search(r'\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b', text)
    if m:
        year, month, day = m.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return None


def normalize_mobile(value):
    text = clean(value)
    if not text:
        return None
    digits = re.sub(r'\D', '', text)
    if len(digits) > 10:
        digits = digits[-10:]
    return digits if len(digits) == 10 else None


def normalize_email(value):
    text = clean(value)
    if text and re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', text):
        return text.lower()
    return None


def extract_kyc(genai, kyc_bytes, filename, pdf_to_images):
    """Run Gemini on the KYC file. Returns a dict or None if it could not be read."""
    name = (filename or '').lower()
    payload = [KYC_PROMPT, "Here is the KYC document:\n\n"]
    if name.endswith('.pdf'):
        images = pdf_to_images(kyc_bytes)
        if not images:
            return None
        payload.extend(images)
    elif name.endswith(('.jpg', '.jpeg', '.png', '.webp')):
        mime = 'image/png' if name.endswith('.png') else 'image/webp' if name.endswith('.webp') else 'image/jpeg'
        payload.append({"mime_type": mime, "data": kyc_bytes})
    else:
        return None

    model = genai.GenerativeModel((os.environ.get('GEMINI_MODEL') or 'gemini-3.8-flash'))
    response = model.generate_content(payload)
    text = response.text or ''
    start, end = text.find('{'), text.rfind('}')
    if start == -1 or end == -1:
        return None
    raw = json.loads(text[start:end + 1])
    return {
        'fullName': clean(raw.get('fullName')),
        'dob': normalize_dob(raw.get('dob')),
        'mobile': normalize_mobile(raw.get('mobile')),
        'email': normalize_email(raw.get('email')),
        'documentType': clean(raw.get('documentType')),
    }


def _name_tokens(name):
    return {t for t in re.findall(r'[a-z]+', (name or '').lower()) if len(t) > 1}


def names_match(a, b):
    ta, tb = _name_tokens(a), _name_tokens(b)
    if not ta or not tb:
        return True  # nothing to compare
    return len(ta & tb) / min(len(ta), len(tb)) >= 0.5


def merge_kyc(parsed, kyc):
    """Merge KYC details into the parsed policy dict (in place).

    Returns (sources, name_mismatch) where sources maps a field key to
    'Policy' or 'KYC' so the UI can show where each value came from.
    """
    sources = {}
    for key in ('policyHolderName', 'vehicleRegistrationNo', 'vehicleModel',
                'manufacturerYear', 'idv', 'periodOfInsurance'):
        if clean(parsed.get(key)):
            sources[key] = 'Policy'

    parsed['dob'] = normalize_dob(parsed.get('dob')) or 'Not Found'
    parsed['email'] = normalize_email(parsed.get('email')) or 'Not Found'
    parsed['mobile'] = normalize_mobile(parsed.get('mobile')) or 'Not Found'
    for key in ('dob', 'email', 'mobile'):
        if parsed[key] != 'Not Found':
            sources[key] = 'Policy'

    name_mismatch = False
    if kyc:
        # KYC is the authoritative source for personal details.
        if kyc.get('dob'):
            parsed['dob'] = kyc['dob']
            sources['dob'] = 'KYC'
        if kyc.get('email') and parsed['email'] == 'Not Found':
            parsed['email'] = kyc['email']
            sources['email'] = 'KYC'
        if kyc.get('mobile') and parsed['mobile'] == 'Not Found':
            parsed['mobile'] = kyc['mobile']
            sources['mobile'] = 'KYC'
        if not clean(parsed.get('policyHolderName')) and kyc.get('fullName'):
            parsed['policyHolderName'] = kyc['fullName']
            sources['policyHolderName'] = 'KYC'
        elif kyc.get('fullName') and not names_match(parsed.get('policyHolderName'), kyc['fullName']):
            name_mismatch = True
    return sources, name_mismatch