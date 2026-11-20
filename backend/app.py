import os
import json
from io import BytesIO
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import fake_genai as genai
import PyPDF2
import fitz
import base64
import jwt
import logging
from functools import wraps
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

import re
import hmac
import hashlib
import secrets
import sms
import kyc_utils
from models import db, User, Policy, Recommend, OtpRequest

# Load environment variables
load_dotenv(override=True)

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-key-123')

# Database Configuration
database_url = os.environ.get('DATABASE_URL')
if not database_url:
    db_user = os.environ.get('DB_USER', 'root')
    db_pass = os.environ.get('DB_PASSWORD', 'password')
    db_host = os.environ.get('DB_HOST', 'localhost')
    db_name = os.environ.get('DB_NAME', 'motor_insurance_db')
    database_url = f"mysql+pymysql://{db_user}:{db_pass}@{db_host}/{db_name}"

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
with app.app_context():
    try:
        db.create_all()
        # Add newly introduced columns to an existing policies table (create_all does not alter tables)
        try:
            from sqlalchemy import inspect as sa_inspect, text as sa_text
            existing_cols = {c['name'] for c in sa_inspect(db.engine).get_columns('policies')}
            for col_name, ddl in (
                ('extracted_email', 'VARCHAR(200)'),
                ('extracted_mobile', 'VARCHAR(30)'),
                ('kyc_file_name', 'VARCHAR(255)'),
                ('email_status', 'VARCHAR(30)'),
                ('email_sent_to', 'VARCHAR(200)'),
                ('email_sent_at', 'DATETIME'),
            ):
                if col_name not in existing_cols:
                    db.session.execute(sa_text(f"ALTER TABLE policies ADD COLUMN {col_name} {ddl}"))
                    db.session.commit()
                    print(f"INFO: Added column policies.{col_name}")
        except Exception as mig_err:
            db.session.rollback()
            print(f"WARNING: Column migration failed: {mig_err}")
        # Role column on users (existing accounts become regular agents)
        try:
            user_cols = {c['name'] for c in sa_inspect(db.engine).get_columns('users')}
            if 'role' not in user_cols:
                db.session.execute(sa_text("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'agent'"))
                db.session.commit()
                print("INFO: Added column users.role")
        except Exception as mig_err:
            db.session.rollback()
            print(f"WARNING: users.role migration failed: {mig_err}")
        print("INFO: Successfully connected and initialized DB")
    except Exception as e:
        print(f"WARNING: Could not initialize database. Error: {e}")

# Initialize Gemini AI Client

gemini_api_key = os.environ.get('GEMINI_API_KEY')
try:
    if gemini_api_key and gemini_api_key != 'your_gemini_api_key_here':
        genai.configure(api_key=gemini_api_key)
        gemini_client_ready = True
    else:
        gemini_client_ready = False
except Exception as e:
    print(f"Failed to initialize Gemini client: {e}")
    gemini_client_ready = False

@app.route('/', methods=['GET'])
def root():
    return jsonify({'status': 'Cover360 API is running'})

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Cover360 Backend is running!'})

# Authentication Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]
                
        if not token:
            return jsonify({'error': 'Token is missing!'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(id=data['user_id']).first()
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired!'}), 401
        except Exception as e:
            return jsonify({'error': 'Token is invalid!'}), 401

        if current_user is None:
            return jsonify({'error': 'User no longer exists.'}), 401

        return f(current_user, *args, **kwargs)
    return decorated


def is_admin(user):
    return (user.role or 'agent') == 'admin'


def admin_required(f):
    """Like token_required, but only lets admin users through."""
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if not is_admin(current_user):
            return jsonify({'error': 'Admin access required.'}), 403
        return f(current_user, *args, **kwargs)
    return decorated


def get_accessible_policy_or_404(policy_id, user):
    """Admins can open any policy; agents only the ones they uploaded.
    Someone else's policy is reported as 404 so its existence is not revealed."""
    from werkzeug.exceptions import NotFound
    policy = db.session.get(Policy, policy_id)
    if policy is None or (not is_admin(user) and policy.user_id != user.id):
        raise NotFound()
    return policy


def issue_token(user):
    return jwt.encode({
        'user_id': user.id,
        'role': user.role or 'agent',
        'exp': datetime.utcnow() + timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm="HS256")

# Auth Endpoints
OTP_EXPIRY_MINUTES = 10
OTP_RESEND_SECONDS = 30
OTP_MAX_PER_HOUR = 5
OTP_MAX_ATTEMPTS = 5


def _hash_otp(mobile, otp):
    return hmac.new(app.config['SECRET_KEY'].encode(), f"{mobile}:{otp}".encode(), hashlib.sha256).hexdigest()


def _valid_mobile(value):
    """10-digit Indian mobile number (starts with 6-9), or None."""
    m = kyc_utils.normalize_mobile(value)
    return m if m and m[0] in '6789' else None


def _password_problem(password, confirm):
    if len(password) < 8:
        return 'Password must be at least 8 characters.'
    if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        return 'Password must contain at least one letter and one number.'
    if password != confirm:
        return 'Password and confirm password do not match.'
    return None


@app.route('/api/auth/send-otp', methods=['POST'])
def send_signup_otp():
    """Step 1 of sign-up: text a one-time password to the mobile number."""
    data = request.get_json(silent=True) or {}
    mobile = _valid_mobile(data.get('mobile'))
    if not mobile:
        return jsonify({'error': 'Enter a valid 10-digit mobile number.'}), 400

    email = kyc_utils.normalize_email(data.get('email')) if data.get('email') else None
    if email and User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify({'error': 'An account with this email already exists. Please sign in.'}), 409
    if User.query.filter_by(mobile=mobile).first():
        return jsonify({'error': 'An account with this mobile number already exists. Please sign in.'}), 409

    now = datetime.utcnow()
    last = OtpRequest.query.filter_by(mobile=mobile).order_by(OtpRequest.created_at.desc()).first()
    if last and (now - last.created_at).total_seconds() < OTP_RESEND_SECONDS:
        wait = int(OTP_RESEND_SECONDS - (now - last.created_at).total_seconds()) + 1
        return jsonify({'error': f'Please wait {wait} seconds before requesting another OTP.', 'retryAfter': wait}), 429
    recent = OtpRequest.query.filter(OtpRequest.mobile == mobile, OtpRequest.created_at > now - timedelta(hours=1)).count()
    if recent >= OTP_MAX_PER_HOUR:
        return jsonify({'error': 'Too many OTP requests. Please try again after an hour.'}), 429

    otp = f"{secrets.randbelow(1000000):06d}"
    OtpRequest.query.filter_by(mobile=mobile, used=False).update({'used': True})
    row = OtpRequest(mobile=mobile, otp_hash=_hash_otp(mobile, otp), expires_at=now + timedelta(minutes=OTP_EXPIRY_MINUTES))
    db.session.add(row)
    db.session.commit()

    try:
        sms.send_otp(mobile, otp, OTP_EXPIRY_MINUTES)
    except sms.SmsError as e:
        logger.error(f"OTP SMS failed for {mobile}: {e}")
        row.used = True
        db.session.commit()
        return jsonify({'error': 'Could not send the OTP right now. Please try again shortly.'}), 503

    return jsonify({'message': 'OTP sent to your mobile number.', 'expiresInMinutes': OTP_EXPIRY_MINUTES, 'resendAfter': OTP_RESEND_SECONDS})


@app.route('/api/auth/signup', methods=['POST'])
def signup():
    """Step 2 of sign-up: name, email, mobile, OTP, password and confirm password."""
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get('fullName') or '').strip()
        email = kyc_utils.normalize_email(data.get('email'))
        mobile = _valid_mobile(data.get('mobile'))
        otp = re.sub(r'\D', '', str(data.get('otp') or ''))
        password = data.get('password') or ''
        confirm = data.get('confirmPassword') or ''

        if not name:
            return jsonify({'error': 'Full name is required.'}), 400
        if not email:
            return jsonify({'error': 'Enter a valid email address.'}), 400
        if not mobile:
            return jsonify({'error': 'Enter a valid 10-digit mobile number.'}), 400
        if len(otp) != 6:
            return jsonify({'error': 'Enter the 6-digit OTP sent to your mobile.'}), 400
        problem = _password_problem(password, confirm)
        if problem:
            return jsonify({'error': problem}), 400

        if User.query.filter(db.func.lower(User.email) == email).first():
            return jsonify({'error': 'An account with this email already exists.'}), 409
        if User.query.filter_by(mobile=mobile).first():
            return jsonify({'error': 'An account with this mobile number already exists.'}), 409

        row = (OtpRequest.query.filter_by(mobile=mobile, used=False)
               .order_by(OtpRequest.created_at.desc()).first())
        if not row or row.expires_at < datetime.utcnow():
            return jsonify({'error': 'OTP expired or not requested. Please request a new OTP.'}), 400
        if row.attempts >= OTP_MAX_ATTEMPTS:
            row.used = True
            db.session.commit()
            return jsonify({'error': 'Too many wrong attempts. Please request a new OTP.'}), 400
        if not hmac.compare_digest(row.otp_hash, _hash_otp(mobile, otp)):
            row.attempts += 1
            db.session.commit()
            return jsonify({'error': 'Incorrect OTP. Please check and try again.'}), 400

        row.used = True
        new_user = User(
            name=name,
            email=email,
            mobile=mobile,
            role='agent',  # public sign-up can only ever create agents
            hashed_password=generate_password_hash(password, method='pbkdf2:sha256')
        )
        db.session.add(new_user)
        db.session.commit()
        logger.info(f"User {email} created successfully")
        return jsonify({'message': 'Account created successfully. Please sign in.'}), 201
    except Exception as e:
        logger.error(f"Signup error: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({'error': 'Could not create the account. Please try again.'}), 500


def _do_login(required_role):
    """Shared login. The agent login and the admin login are separate endpoints:
    each only accepts accounts of its own role."""
    try:
        data = request.get_json(silent=True) or {}
        identifier = str(data.get('identifier') or data.get('email') or '').strip()
        password = data.get('password') or ''
        if not identifier or not password:
            return jsonify({'error': 'Enter your email or mobile number and password.', 'message': 'Missing credentials'}), 401

        # Sign in with either the email address or the mobile number
        if '@' in identifier:
            candidates = User.query.filter(db.func.lower(User.email) == identifier.lower()).all()
        else:
            m = kyc_utils.normalize_mobile(identifier)
            candidates = User.query.filter_by(mobile=m).all() if m else []
        user = next((u for u in candidates if check_password_hash(u.hashed_password, password)), None)
        # One generic message for every failure so accounts cannot be probed
        if not user:
            logger.warning(f"{required_role} login failed for {identifier}")
            return jsonify({'error': 'Invalid email/mobile or password', 'message': 'Invalid email/mobile or password'}), 401

        if (user.role or 'agent') != required_role:
            logger.warning(f"{required_role} login refused for {user.email} (role={user.role})")
            if required_role == 'admin':
                msg = 'This account is not an admin account.'
            else:
                msg = 'Admin accounts must sign in from the admin login page.'
            return jsonify({'error': msg, 'message': msg}), 403

        logger.info(f"{required_role} {user.email} logged in successfully")
        return jsonify({'token': issue_token(user), 'user': user.to_dict()})
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error during login'}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    return _do_login('agent')


@app.route('/api/auth/admin-login', methods=['POST'])
def admin_login():
    return _do_login('admin')


# Admin-only user management: this is the only way to create another admin
@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_list_users(current_user):
    users = User.query.order_by(User.created_at.desc()).all()
    out = []
    for u in users:
        d = u.to_dict()
        d['created_at'] = u.created_at.isoformat() if u.created_at else None
        d['policy_count'] = len(u.policies)
        out.append(d)
    return jsonify(out)


@app.route('/api/admin/users', methods=['POST'])
@admin_required
def admin_create_user(current_user):
    data = request.get_json(silent=True) or {}
    name = (data.get('fullName') or '').strip()
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''
    role = data.get('role', 'admin')
    if not name or not email or not password:
        return jsonify({'error': 'Name, email and password are required.'}), 400
    if role not in ('admin', 'agent'):
        return jsonify({'error': "Role must be 'admin' or 'agent'."}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters.'}), 400
    if User.query.filter(db.func.lower(User.email) == email.lower()).first():
        return jsonify({'error': 'A user with this email already exists.'}), 409
    email = email.lower()
    user = User(name=name, email=email, mobile=kyc_utils.normalize_mobile(data.get('mobile')) or '', role=role,
                hashed_password=generate_password_hash(password, method='pbkdf2:sha256'))
    db.session.add(user)
    db.session.commit()
    logger.info(f"Admin {current_user.email} created {role} user {email}")
    return jsonify(user.to_dict()), 201


@app.route('/api/init-db', methods=['POST'])
@admin_required
def init_db(current_user):
    try:
        db.create_all()
        return jsonify({'message': 'Database tables created successfully.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reset-db', methods=['POST', 'GET'], strict_slashes=False)
@admin_required
def reset_db(current_user):
    try:
        db.drop_all()
        db.create_all()

        return jsonify({'message': 'Database completely reset and tables recreated successfully.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def extract_text_from_pdf(file_stream):
    """Helper function to extract text from a PDF file stream"""
    try:
        pdf_reader = PyPDF2.PdfReader(file_stream)
        text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return None

def convert_pdf_to_images(file_bytes):
    """Convert PDF pages to JPEGs using PyMuPDF to pass directly to Gemini."""
    images = []
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("jpeg")
            images.append({"mime_type": "image/jpeg", "data": img_bytes})
    except Exception as e:
        print(f"Error converting PDF to images: {e}")
    return images

@app.route('/api/analyze-policy', methods=['POST'])
@token_required
def analyze_policy(current_user):
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty filename.'}), 400
        
    # Read and parse PDF
    file_bytes = file.read()
    kyc_upload = request.files.get('kyc_file')
    kyc_bytes = kyc_upload.read() if kyc_upload and kyc_upload.filename else None
    kyc_filename = kyc_upload.filename if kyc_bytes else None
    sources, name_mismatch, kyc_status = {}, False, 'not_provided'
    file_stream = BytesIO(file_bytes)
    
    extracted_text = ""
    if file.filename.lower().endswith('.pdf'):
        extracted_text = extract_text_from_pdf(file_stream)
    else:
        # Fallback for plain text files (for testing)
        try:
            extracted_text = file_bytes.decode('utf-8')
        except Exception:
            return jsonify({'error': 'Unsupported file format. Please upload a PDF.'}), 400
            
    if not extracted_text or len(extracted_text.strip()) == 0:
        print("Warning: Could not extract text from PDF. Falling back to dummy text for mock extraction.")
        extracted_text = "DUMMY_TEXT"

    parsed_data = None
    if gemini_client_ready:
        system_prompt = """You are an expert Motor Insurance data extractor. 
I will provide you with the raw text or images from an insurance policy document.
You must extract the following information and return ONLY a valid JSON object:
{
  "policyHolderName": "string (Extract the full Name of the Insured / Policy Holder / Proposer)",
  "vehicleRegistrationNo": "string (Extract the Vehicle Registration Number / Reg No., e.g., MH03DP5803)",
  "vehicleModel": "string (Extract BOTH the Vehicle Make and Model. Look for Make/Model/Variant)",
  "manufacturerYear": "string (Extract ONLY the exact 4-digit Year of Manufacture or Mfg Yr. If you see 'Year of Regn/Year of Mfg. 2025/0001-01-01', extract '2025'. Look directly at the Vehicle Details section. Do not guess.)",
  "vehicleAge": "string (Extract the exact Vehicle Age if explicitly stated. Do not guess. If not found, return 'Not Found')",
  "periodOfInsurance": "string (Extract Policy Start and End Dates / Period of Insurance. e.g., '01/01/2023 to 31/12/2023')",
  "dob": "string (Extract Policy Holder's Date of Birth. Format EXACTLY as YYYY-MM-DD. E.g. '1961-06-21')",
  "age": "string (Extract the Policy Holder's Age in years)",
  "idv": "string (Extract the Insured Declared Value (IDV) / Sum Insured. Return the exact amount)",
  "income": "string",
  "purchasePrice": "string",
  "email": "string (Policy holder's email address if printed on the policy, else Not Found)",
  "mobile": "string (Policy holder's mobile number if printed on the policy, else Not Found)"
}
If a field cannot be found, set its value to "Not Found". Do not include any markdown formatting, backticks, or extra text. Output pure JSON."""
        
        try:
            import tempfile
            import os
            
            content_payload = [system_prompt, "Here is the insurance policy document:\n\n"]
            uploaded_file = None
            
            if file.filename.lower().endswith('.pdf'):
                images = convert_pdf_to_images(file_bytes)
                if images:
                    content_payload.extend(images)
                else:
                    content_payload.append(extracted_text)
            else:
                content_payload.append(extracted_text)
                
            gemini_model_name = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
            model = genai.GenerativeModel(gemini_model_name)
            response = model.generate_content(
                content_payload,
                safety_settings={
                    'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
                    'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE',
                    'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_NONE',
                    'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE'
                }
            )
            
            # Clean up remote file from Gemini
            if uploaded_file:
                try:
                    uploaded_file.delete()
                except Exception as cleanup_err:
                    print(f"Warning: Failed to delete remote Gemini file: {cleanup_err}")
            
            ai_output = response.text
            start = ai_output.find('{')
            end = ai_output.rfind('}')
            if start != -1 and end != -1:
                ai_output = ai_output[start:end+1]
            
            parsed_data = json.loads(ai_output)

            # Optional KYC document: read it and merge DOB / email / mobile with the policy data
            kyc_info = None
            if kyc_bytes:
                try:
                    kyc_info = kyc_utils.extract_kyc(genai, kyc_bytes, kyc_filename, convert_pdf_to_images)
                    kyc_status = 'read' if kyc_info else 'unreadable'
                except Exception as kyc_err:
                    print(f"KYC extraction failed: {kyc_err}", flush=True)
                    kyc_status = 'unreadable'
            sources, name_mismatch = kyc_utils.merge_kyc(parsed_data, kyc_info)
            
            import re
            from datetime import datetime
            current_year = datetime.now().year
            
            # Calculate User Age
            age = None
            dob_str = parsed_data.get('dob', '')
            if dob_str and dob_str != "Not Found":
                date_match = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b', dob_str)
                if date_match:
                    day, month, year = date_match.groups()
                    parsed_data['dob'] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                else:
                    date_match_rev = re.search(r'\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b', dob_str)
                    if date_match_rev:
                        year, month, day = date_match_rev.groups()
                        parsed_data['dob'] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                match = re.search(r'\b(19\d{2}|20\d{2})\b', str(parsed_data['dob']))
                if match:
                    age = current_year - int(match.group(1))
            
            # If DOB not found but age is given
            if age is None:
                age_str = parsed_data.get('age', '')
                if age_str and age_str != "Not Found":
                    match = re.search(r'\b(\d{2})\b', age_str)
                    if match:
                        age = int(match.group(1))
            
            # Calculate Vehicle Age
            vehicle_age = None
            mfg_str = str(parsed_data.get('manufacturerYear', ''))
            if mfg_str and mfg_str != "Not Found":
                match = re.search(r'\b(19\d{2}|20\d{2})\b', mfg_str)
                if match:
                    mfg_year = int(match.group(1))
                    vehicle_age = max(0, current_year - mfg_year)
            
            if vehicle_age is None:
                v_age_str = str(parsed_data.get('vehicleAge', ''))
                if v_age_str and v_age_str != "Not Found":
                    match = re.search(r'\b(\d{1,2})\b', v_age_str)
                    if match:
                        vehicle_age = int(match.group(1))
            
            # Extract IDV
            idv_val = None
            idv_str = parsed_data.get('idv', '')
            if idv_str and idv_str != "Not Found":
                idv_clean = re.sub(r'[^\d.]', '', idv_str)
                if idv_clean:
                    idv_val = float(idv_clean)
            
            # Car Cost Estimation
            estimated_original_cost = None
            
            purchase_price_str = parsed_data.get('purchasePrice', '')
            if purchase_price_str and purchase_price_str != "Not Found":
                pp_clean = re.sub(r'[^\d.]', '', purchase_price_str)
                if pp_clean:
                    estimated_original_cost = float(pp_clean)
            
            if estimated_original_cost is None and idv_val is not None and vehicle_age is not None:
                annual_depreciation = 0.10
                estimated_original_cost = (
                    idv_val / ((1 - annual_depreciation) ** vehicle_age)
                )
                
            if estimated_original_cost is not None and vehicle_age is not None:
                old_salary = estimated_original_cost * 2.0
                current_annual_income = old_salary * (1.10 ** vehicle_age)
                parsed_data['income'] = str(int(current_annual_income))
            else:
                parsed_data['income'] = "Not Found"

            parsed_data['calculated_age'] = age
            parsed_data['calculated_vehicle_age'] = vehicle_age
            parsed_data['carCost'] = parsed_data.get('idv', 'Not Found')
            
            if estimated_original_cost is not None:
                parsed_data['estimatedOriginalCost'] = str(int(round(estimated_original_cost)))
            else:
                parsed_data['estimatedOriginalCost'] = "Not Found"
            
            
            print(f"DEBUG: Parsed data successfully via Gemini: {parsed_data}", flush=True)
        except Exception as e:
            models = [m.name for m in genai.list_models()]
            print(f"Gemini API Error: {e}. Models: {models}", flush=True)
            return jsonify({'error': f'Failed to process document: {str(e)}. Available models: {models}'}), 500
    else:
        print(f"DEBUG: gemini_client_ready is FALSE! key='{gemini_api_key}'", flush=True)
            
    if not parsed_data:
        return jsonify({'error': 'Failed to extract data from the document. Please try again.'}), 500
    # Save extracted data to the database
    # Ensure DB and dummy user exist just in case startup failed
    try:
        db.create_all()

    except Exception:
        db.session.rollback()

    try:
        new_policy = Policy(
            # pyrefly: ignore [unexpected-keyword]
            user_id=current_user.id,  # owner: the logged-in user who uploaded it
            # pyrefly: ignore [unexpected-keyword]
            file_name=file.filename,
            # pyrefly: ignore [unexpected-keyword]
            raw_text=(extracted_text[:60000] if extracted_text else None),
            extracted_policy_holder=str(parsed_data.get('policyHolderName'))[:200] if parsed_data.get('policyHolderName') else None,
            # pyrefly: ignore [unexpected-keyword]
            extracted_registration_no=str(parsed_data.get('vehicleRegistrationNo'))[:100] if parsed_data.get('vehicleRegistrationNo') else None,
            # pyrefly: ignore [unexpected-keyword]
            extracted_vehicle_model=str(parsed_data.get('vehicleModel'))[:200] if parsed_data.get('vehicleModel') else None,
            # pyrefly: ignore [unexpected-keyword]
            extracted_manufacturer_year=str(parsed_data.get('manufacturerYear'))[:50] if parsed_data.get('manufacturerYear') else None,
            # pyrefly: ignore [unexpected-keyword]
            extracted_period_of_insurance=str(parsed_data.get('periodOfInsurance'))[:200] if parsed_data.get('periodOfInsurance') else None,
            # pyrefly: ignore [unexpected-keyword]
            extracted_dob=str(parsed_data.get('dob'))[:50] if parsed_data.get('dob') else None,
            # pyrefly: ignore [unexpected-keyword]
            extracted_age=parsed_data.get('calculated_age'),
            # pyrefly: ignore [unexpected-keyword]
            extracted_idv=str(parsed_data.get('idv'))[:100] if parsed_data.get('idv') else None,
            # pyrefly: ignore [unexpected-keyword]
            extracted_income=str(parsed_data.get('income'))[:100] if parsed_data.get('income') else None,
            # pyrefly: ignore [unexpected-keyword]
            extracted_car_cost=str(parsed_data.get('carCost'))[:100] if parsed_data.get('carCost') else None,
            # pyrefly: ignore [unexpected-keyword]
            extracted_vehicle_age=parsed_data.get('calculated_vehicle_age'),
            # pyrefly: ignore [unexpected-keyword]
            estimated_original_cost=str(parsed_data.get('estimatedOriginalCost'))[:100] if parsed_data.get('estimatedOriginalCost') else None,
            extracted_email=kyc_utils.clean(parsed_data.get('email')),
            extracted_mobile=kyc_utils.clean(parsed_data.get('mobile')),
            kyc_file_name=kyc_filename
        )
        db.session.add(new_policy)
        db.session.commit()
        
        # Return the saved policy data (including fields expected by frontend)
        result = new_policy.to_dict()
        result['sources'] = sources
        result['kycStatus'] = kyc_status
        result['kycNameMismatch'] = name_mismatch
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        print(f"Database Error: {e}")
        return jsonify({'error': f'Failed to save policy to database. Reason: {str(e)}'}), 500


# New endpoint: fetch history of policies for the user
@app.route('/api/history', methods=['GET'])
@token_required
def get_history(current_user):
    # Admins see every upload (with who uploaded it); agents only see their own
    query = Policy.query
    if not is_admin(current_user):
        query = query.filter_by(user_id=current_user.id)
    policies = query.order_by(Policy.upload_date.desc()).all()
    return jsonify([p.to_dict(include_owner=is_admin(current_user)) for p in policies])


@app.route('/api/policies/<int:policy_id>', methods=['PUT'])
@token_required
def update_policy(current_user, policy_id):
    policy = get_accessible_policy_or_404(policy_id, current_user)
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    from datetime import datetime
    import re
    current_year = datetime.now().year
    
    if 'policyHolderName' in data: policy.extracted_policy_holder = data['policyHolderName']
    if 'vehicleRegistrationNo' in data: policy.extracted_registration_no = data['vehicleRegistrationNo']
    if 'vehicleModel' in data: policy.extracted_vehicle_model = data['vehicleModel']
    if 'manufacturerYear' in data: 
        policy.extracted_manufacturer_year = data['manufacturerYear']
        match = re.search(r'\b(19\d{2}|20\d{2})\b', str(data['manufacturerYear']))
        if match:
            mfg_year = int(match.group(1))
            from datetime import datetime
            current_year = datetime.now().year
            policy.extracted_vehicle_age = max(0, current_year - mfg_year)
    if 'periodOfInsurance' in data: policy.extracted_period_of_insurance = data['periodOfInsurance']
    if 'dob' in data: 
        policy.extracted_dob = data['dob']
        match = re.search(r'\b(19\d{2}|20\d{2})\b', str(data['dob']))
        if match:
            policy.extracted_age = current_year - int(match.group(1))
    if 'idv' in data: policy.extracted_idv = data['idv']
    if 'income' in data: policy.extracted_income = data['income']
    if 'carCost' in data: policy.extracted_car_cost = data['carCost']
    if 'email' in data: policy.extracted_email = kyc_utils.normalize_email(data['email'])
    if 'mobile' in data: policy.extracted_mobile = kyc_utils.normalize_mobile(data['mobile'])
    
    # Recalculate cost estimation based on potentially updated fields
    idv_val = None
    if policy.extracted_idv and policy.extracted_idv != "Not Found":
        idv_clean = re.sub(r'[^\d.]', '', policy.extracted_idv)
        if idv_clean:
            idv_val = float(idv_clean)
            
    vehicle_age = policy.extracted_vehicle_age
    
    # If the user provides a direct purchase price (or estimatedOriginalCost via UI), use it
    if 'estimatedOriginalCost' in data and data['estimatedOriginalCost'] not in [None, '', 'Not Found']:
        policy.estimated_original_cost = data['estimatedOriginalCost']
    elif idv_val is not None and vehicle_age is not None:
        annual_depreciation = 0.10
        calculated_cost = idv_val / ((1 - annual_depreciation) ** vehicle_age)
        policy.estimated_original_cost = str(int(round(calculated_cost)))
        
    if not policy.extracted_income or policy.extracted_income == "Not Found" or "not" in policy.extracted_income.lower():
        if policy.estimated_original_cost and policy.estimated_original_cost != "Not Found":
            try:
                orig_cost_val = float(re.sub(r'[^\d.]', '', str(policy.estimated_original_cost)))
                
                v_age_for_income = 0
                if policy.extracted_manufacturer_year and policy.extracted_manufacturer_year != "Not Found":
                    match = re.search(r'\b(19\d{2}|20\d{2})\b', str(policy.extracted_manufacturer_year))
                    if match:
                        mfg_year = int(match.group(1))
                        from datetime import datetime
                        v_age_for_income = max(0, datetime.now().year - mfg_year)
                elif policy.extracted_vehicle_age is not None:
                    v_age_for_income = policy.extracted_vehicle_age
                    
                old_salary = orig_cost_val * 2.0
                current_annual_income = old_salary * (1.10 ** v_age_for_income)
                policy.extracted_income = str(int(current_annual_income))
            except Exception:
                pass
    
    try:
        db.session.commit()
        return jsonify(policy.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommendations/<int:user_id>', methods=['GET'])
@token_required
def get_recommendations(current_user, user_id):
    if not is_admin(current_user) and user_id != current_user.id:
        return jsonify({'error': 'Not found'}), 404
    recs = Recommend.query.filter_by(user_id=user_id).all()
    return jsonify([r.to_dict() for r in recs])

def calculate_hlv_term_cover(age, income):
    try:
        import re
        income_clean = re.sub(r'[^\d.]', '', str(income)) if income else '0'
        annual_income = float(income_clean) if income_clean else 0
    except (ValueError, TypeError):
        annual_income = 0
        
    if annual_income == 0:
        annual_income = 500000  # Fallback baseline income
        
    try:
        age_val = int(age) if age else 30
    except (ValueError, TypeError):
        age_val = 30
        
    if age_val <= 30:
        multiplier = 35
    elif age_val <= 35:
        multiplier = 30
    elif age_val <= 40:
        multiplier = 25
    elif age_val <= 45:
        multiplier = 20
    elif age_val <= 50:
        multiplier = 15
    elif age_val <= 55:
        multiplier = 10
    else:
        multiplier = 5
        
    return annual_income * multiplier

def estimate_health_cover(age, idv, income):
    try:
        import re
        income_clean = re.sub(r'[^\d.]', '', str(income)) if income else '0'
        income_val = float(income_clean) if income_clean else 0
    except (ValueError, TypeError):
        income_val = 0
        
    try:
        age_val = int(age) if age else 30
    except (ValueError, TypeError):
        age_val = 30
        
    try:
        import re
        idv_clean = re.sub(r'[^\d.]', '', str(idv)) if idv else '0'
        idv_val = float(idv_clean) if idv_clean else 0
    except (ValueError, TypeError):
        idv_val = 0

    if income_val < 500000:
        health_cover = 1000000      # 10 Lakh
    elif income_val < 1000000:
        health_cover = 1500000      # 15 Lakh
    elif income_val < 2000000:
        health_cover = 2500000      # 25 Lakh
    elif income_val < 5000000:
        health_cover = 5000000      # 50 Lakh
    else:
        health_cover = 10000000     # 1 Crore

    # Adjust based on Age
    if age_val > 45:
        health_cover += 500000      # Add 5 Lakh for older individuals
        
    # Adjust based on IDV (lifestyle indicator)
    if idv_val > 1000000:
        health_cover += 500000      # Add 5 Lakh if they own a car worth > 10 Lakh
    
    return health_cover

def get_rto_details(registration_no):
    if not registration_no or registration_no == "Not Found":
        return None
    rto_code = str(registration_no).replace(' ', '').strip()[:4].upper()
    try:
        import csv
        import os
        base_dir = os.path.dirname(os.path.abspath(__file__))
        csv_path = os.path.join(base_dir, 'India_RTO_Master_Dataset.csv')
        if os.path.exists(csv_path):
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('RTO_Code', '').strip().upper() == rto_code:
                        return row
    except Exception as e:
        print(f"Error reading RTO dataset: {e}")
    return None

@app.route('/api/policies/<int:policy_id>/generate-report', methods=['POST'])
@token_required
def generate_report_for_policy(current_user, policy_id):
    policy = get_accessible_policy_or_404(policy_id, current_user)
    
    if not gemini_client_ready:
        return jsonify({'error': 'Gemini API is not configured or ready.'}), 500
        
    rto_details = get_rto_details(policy.extracted_registration_no)
    
    object_count = 3
    category_list = "1. Health Insurance\n2. Term Insurance\n3. Vehicle Profile"
    
    system_prompt = f"""You are an expert Insurance Advisor.
Analyze the following user profile and provide highly tailored insurance recommendations.
You MUST output a JSON array of exactly {object_count} objects. Do not include any markdown formatting, backticks, or extra text. Output pure JSON array.
The objects MUST represent these {object_count} specific categories in this exact order:
{category_list}

Each object in the array MUST follow this exact structure depending on its category:

For 'Health Insurance' and 'Term Insurance':
{{
  "category": "string",
  "recommended_sum": "string (e.g., '₹ 10,00,000')",
  "policy_term_or_coverage": "string (e.g., '1 Year' or 'Individual')",
  "key_benefits": ["string", "string", "string"],
  "hlv_details": {{
    "recommended_term_cover": "string (e.g., '₹ 1,00,00,000')",
    "existing_term_cover": "string (e.g., '₹ 0' or 'Not Available')",
    "coverage_gap": "string",
    "status": "string (Adequate or Underinsured)",
    "ai_recommendation": "string"
  }} // Include hlv_details ONLY for the 'Term Insurance' category
}}

For 'Vehicle Profile':
{{
  "category": "Vehicle Profile",
  "risk_score": "number (0-100, calculate based on age, city type, income, and vehicle value)",
  "factors": [
    "string (Age analysis)",
    "string (City type analysis)",
    "string (Income analysis)",
    "string (Vehicle value analysis)"
  ]
}}
"""
    
    user_data = f"""
Profile Information:
Age: {policy.extracted_age}
Income: {policy.extracted_income}
Vehicle Age: {policy.extracted_vehicle_age}
Car IDV: {policy.extracted_idv}
City Type: {rto_details.get('Tier', 'Unknown') if rto_details else 'Unknown'}
"""
    
    calculated_health_cover = estimate_health_cover(policy.extracted_age, policy.extracted_idv, policy.extracted_income)
    calculated_term_cover = calculate_hlv_term_cover(policy.extracted_age, policy.extracted_income)
    
    def format_indian_currency(value):
        if value >= 10000000:
            val = value / 10000000
            return f"₹{int(val) if val.is_integer() else round(val, 2)} Crore"
        elif value >= 100000:
            val = value / 100000
            return f"₹{int(val) if val.is_integer() else round(val, 2)} Lakh"
        else:
            return f"₹{value:,.0f}"
            
    user_data += f"\nEstimated Health Insurance Cover Needed: {format_indian_currency(calculated_health_cover)}\n(Please strongly consider this estimation for the recommended_sum for Health Insurance.)\n"
    user_data += f"\nCalculated HLV Term Insurance Cover Needed: {format_indian_currency(calculated_term_cover)}\n(Please MUST use this exact value for the recommended_term_cover in hlv_details for Term Insurance, and calculate coverage gap based on it.)\n"
    
    try:
        model = genai.GenerativeModel(os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash'))
        response = model.generate_content([system_prompt, user_data])
        
        ai_output = response.text
        start = ai_output.find('[')
        end = ai_output.rfind(']')
        if start != -1 and end != -1:
            ai_output = ai_output[start:end+1]
            
        recommendations_data = json.loads(ai_output)
        

        DEFAULT_KEY_BENEFITS = {
            "Health Insurance": [
                "Covers eligible hospitalization expenses, including room rent, ICU charges, surgery, and doctor fees as per policy terms.",
                "Covers eligible pre- and post-hospitalization medical expenses.",
                "Cashless treatment at a wide network of network hospitals (subject to insurer availability).",
                "Financial protection against major medical emergencies and rising healthcare costs.",
                "Lifelong renewability available in eligible health insurance plans."
            ],
            "Term Insurance": [
                "Provides financial security to your nominee in case of the policyholder's death.",
                "Helps replace lost income and supports long-term financial goals.",
                "Assists in protecting dependents from outstanding financial liabilities.",
                "Affordable premiums for high life cover.",
                "Optional riders may be available depending on the insurer."
            ],
            "Personal Accident Insurance": [
                "Lump-sum benefit in case of accidental death.",
                "Financial protection against permanent total or partial disability.",
                "Covers accident-related medical expenses where applicable.",
                "Helps maintain family financial stability after an accident.",
                "Optional accident-related riders may be available."
            ],
            "Cyber Insurance": [
                "Protection against online financial fraud and cyber incidents.",
                "Coverage for UPI and digital payment fraud, subject to policy terms.",
                "Assistance for identity theft and cyber extortion events.",
                "Coverage for unauthorized online transactions where applicable.",
                "Support for cyber incident response and recovery services."
            ],
            "Critical Illness": [
                "Lump-sum benefit upon diagnosis of covered critical illnesses.",
                "Helps manage treatment and recovery expenses.",
                "Provides financial support during loss of income due to illness.",
                "Covers specified illnesses as defined in the policy.",
                "Can complement existing health insurance coverage."
            ]
        }

        # Save to database
        Recommend.query.filter_by(user_id=policy.user_id).delete()
        
        new_recs = []
        for rec in recommendations_data:
            cat = rec.get('category')
            if cat in DEFAULT_KEY_BENEFITS:
                rec['key_benefits'] = DEFAULT_KEY_BENEFITS[cat]
                
            new_rec = Recommend(
                user_id=policy.user_id,
                recommendation_type=cat,
                description=json.dumps(rec)
            )
            new_recs.append(new_rec)
            
        # Calculate PA Cover manually
        try:
            import re
            income_clean = re.sub(r'[^\d.]', '', str(policy.extracted_income)) if policy.extracted_income else '0'
            annual_income = float(income_clean) if income_clean else 0
        except (ValueError, TypeError):
            annual_income = 0
            
        if annual_income == 0:
            annual_income = 500000  # Fallback baseline income
            
        pa_cover = annual_income * 10
        
        pa_cover_data = {
            "category": "Personal Accident Insurance",
            "annual_income": annual_income,
            "formula": "Annual Income × 10",
            "recommended_pa_cover": pa_cover,
            "recommended_pa_cover_display": format_indian_currency(pa_cover),
            "key_benefits": DEFAULT_KEY_BENEFITS["Personal Accident Insurance"]
        }
        
        pa_rec = Recommend(
            user_id=policy.user_id,
            recommendation_type="Personal Accident Cover Recommendation",
            description=json.dumps(pa_cover_data)
        )
        new_recs.append(pa_rec)
            
        db.session.add_all(new_recs)
        db.session.commit()
        
        # Calculate Cyber Insurance deterministically
        def get_cyber_insurance_recommendation(registration_no):
            rto_code = ""
            if registration_no:
                import re
                match = re.search(r'^[A-Za-z]{2}\d{2}', str(registration_no).replace(" ", ""))
                if match:
                    rto_code = match.group(0).upper()
            
            city = "Unknown"
            state = "Unknown"
            tier = "Tier3" # Default
            
            if rto_code:
                try:
                    import csv
                    csv_path = os.path.join(os.path.dirname(__file__), 'India_RTO_Master_Dataset.csv')
                    if os.path.exists(csv_path):
                        with open(csv_path, 'r', encoding='utf-8-sig') as f:
                            reader = csv.DictReader(f)
                            for row in reader:
                                if row.get('RTO_Code', '').upper() == rto_code:
                                    city = row.get('City', 'Unknown')
                                    state = row.get('State', 'Unknown')
                                    tier = row.get('Tier', 'Tier3')
                                    break
                except Exception as e:
                    print(f"Error reading RTO dataset: {e}")
                    
            if tier == "Metro":
                risk_level = "High Risk"
                recommended_cover = "₹ 10 Lakh - ₹ 25 Lakh"
            elif tier == "Tier2":
                risk_level = "Medium Risk"
                recommended_cover = "₹ 5 Lakh - ₹ 10 Lakh"
            else:
                risk_level = "Moderate Risk"
                recommended_cover = "₹ 3 Lakh - ₹ 5 Lakh"
                
            return {
                "category": "Cyber Insurance",
                "recommended_sum": recommended_cover,
                "policy_term_or_coverage": "1 Year",
                "key_benefits": DEFAULT_KEY_BENEFITS["Cyber Insurance"],
                "cyber_details": {
                    "city": city,
                    "state": state,
                    "risk_level": risk_level
                }
            }

        cyber_data = get_cyber_insurance_recommendation(policy.extracted_registration_no)
        cyber_rec = Recommend(
            user_id=policy.user_id,
            recommendation_type="Cyber Insurance",
            description=json.dumps(cyber_data)
        )
        db.session.add(cyber_rec)
        db.session.commit()
        
        # Calculate Critical Illness Cover deterministically
        def get_critical_illness_recommendation(policy, rto_details):
            age = policy.extracted_age or 30
            car_cost_str = str(policy.estimated_original_cost) if policy.estimated_original_cost and policy.estimated_original_cost != "Not Found" else str(policy.extracted_idv)
            import re
            cost_clean = re.sub(r'[^\d.]', '', car_cost_str) if car_cost_str else '0'
            car_cost = float(cost_clean) if cost_clean else 500000
            
            tier = rto_details.get('Tier', 'Tier3') if rto_details else 'Tier3'
            city = rto_details.get('City', 'Unknown') if rto_details else 'Unknown'
            
            # Risk estimation
            if age > 45 or tier == "Metro":
                risk_level = "High Risk"
            elif age > 30 or tier == "Tier2":
                risk_level = "Medium Risk"
            else:
                risk_level = "Low Risk"
                
            # Sum insured recommendation
            if risk_level == "High Risk":
                recommended_sum = "₹ 50 Lakh" if car_cost > 1500000 else "₹ 25 Lakh"
            elif risk_level == "Medium Risk":
                recommended_sum = "₹ 20 Lakh" if car_cost > 1000000 else "₹ 10 Lakh"
            else:
                recommended_sum = "₹ 10 Lakh" if car_cost > 500000 else "₹ 5 Lakh"
                
            reason = f"Based on your Age ({age}), living in {city} ({tier}), and vehicle lifestyle, you have a {risk_level.lower()} for critical illnesses."
            
            return {
                "category": "Critical Illness",
                "recommended_sum": recommended_sum,
                "policy_term_or_coverage": "1 Year",
                "key_benefits": DEFAULT_KEY_BENEFITS["Critical Illness"],
                "critical_illness_details": {
                    "risk_level": risk_level,
                    "reason": reason
                }
            }

        ci_data = get_critical_illness_recommendation(policy, rto_details)
        ci_rec = Recommend(
            user_id=policy.user_id,
            recommendation_type="Critical Illness",
            description=json.dumps(ci_data)
        )
        db.session.add(ci_rec)
        db.session.commit()
        
        # Append to recommendations_data so frontend gets it immediately
        recommendations_data.insert(1, cyber_data) # Insert after Health
        recommendations_data.insert(2, ci_data) # Insert after Cyber
        recommendations_data.append(pa_cover_data) 
        
        # Vehicle Profile is now part of recommendations_data naturally, 
        # so we don't manually append it anymore.
        
        # In original code, the JSON returned by generate_report_for_policy was `recommendations_data` which ONLY contained Gemini results, while PA cover was just saved to DB.
        # But wait, original code says: `return jsonify(recommendations_data)`
        # And `pa_rec` was saved to DB, but `recommendations_data` was NOT updated with PA Cover!
        # Let's keep it consistent: we add cyber_data to recommendations_data so it returns the same structure.
        # But we only need to return the JSON for the recommendations we want the frontend to see here.
        # Actually, let's just re-fetch all recommendations or return them explicitly.
        # I'll just append cyber_data to recommendations_data so frontend has it.
        return jsonify(recommendations_data)
        
    except Exception as e:
        print(f"Error generating AI report: {e}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/policies/<int:policy_id>/download-pdf', methods=['GET'])
@token_required
def download_pdf_report(current_user, policy_id):
    from flask import send_file
    from pdf_generator import build_pdf
    from io import BytesIO
    import json
    
    policy = get_accessible_policy_or_404(policy_id, current_user)
    _latest_recs = {}
    for _r in Recommend.query.filter_by(user_id=policy.user_id).order_by(Recommend.id).all():
        _latest_recs[_r.recommendation_type] = _r
    recs = list(_latest_recs.values())
    
    # Map Policy object to dictionary expected by pdf_generator
    customer_data = {
        'policy_holder': policy.extracted_policy_holder or 'N/A',
        'age': policy.extracted_age or 'N/A',
        'vehicle_model': policy.extracted_vehicle_model or 'N/A',
        'registration_no': policy.extracted_registration_no or 'N/A',
        'manufacturing_year': policy.extracted_manufacturer_year or 'N/A',
        'vehicle_age': policy.extracted_vehicle_age or 'N/A',
        'idv': policy.extracted_idv or 'N/A',
        'estimated_cost': policy.estimated_original_cost or 'N/A',
        'income': policy.extracted_income or 'N/A',
        'risk_level': 'Standard' # Could be calculated from vehicle profile if saved
    }
    
    # Map Recommendations to expected format
    recommendations = []
    for r in recs:
        # Some are just JSON strings in DB, parse if needed
        data = r.description
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except:
                data = {}
        
        # Determine cover
        if r.recommendation_type == 'Personal Accident Cover Recommendation':
            cover = data.get('recommended_pa_cover_display') or data.get('recommended_sum') or 'N/A'
        elif r.recommendation_type == 'Term Insurance':
            cover = (data.get('hlv_details') or {}).get('recommended_term_cover') or data.get('recommended_sum') or 'N/A'
        else:
            cover = data.get('recommended_sum') or data.get('recommended_pa_cover_display') or 'N/A'
        
        # Determine risk level from nested objects
        risk = "Standard Risk"
        if 'critical_illness_details' in data:
            risk = data['critical_illness_details'].get('risk_level', risk)
        elif 'cyber_details' in data:
            risk = data['cyber_details'].get('risk_level', risk)
        elif 'hlv_details' in data:
            # For Term, hlv_details might not have risk, but let's check
            risk = data['hlv_details'].get('status', risk)
        
        rec_data = {
            'title': r.recommendation_type,
            'cover': cover,
            'term': data.get('policy_term_or_coverage', '1 Year'),
            'risk': risk,
            'benefits': data.get('key_benefits', [])
        }
        
        # Skip vehicle profile from the insurance cards
        if rec_data['title'] == 'Vehicle Profile':
            customer_data['risk_level'] = f"{data.get('risk_score', 'N/A')}/100"
            continue
            
        recommendations.append(rec_data)
        
    pdf_buffer = BytesIO()
    build_pdf(pdf_buffer, customer_data, recommendations)
    pdf_buffer.seek(0)
    
    return send_file(
        pdf_buffer,
        as_attachment=True,
        download_name=f"Cover360_Advisory_Report_{policy.extracted_registration_no or policy_id}.pdf",
        mimetype="application/pdf"
    )


@app.route('/api/chat', methods=['POST'])
@token_required
def chat_insure_ai(current_user):
    try:
        data = request.json or {}
        print(f"Incoming Request to /api/chat: {data}", flush=True)
        
        # Always the logged-in user's own data; a client-supplied user_id is ignored
        user_id = current_user.id
        
        # Backward compatibility
        if 'history' in data and data['history']:
            chat_history = data['history']
        elif 'message' in data and data['message']:
            chat_history = [{'sender': 'user', 'text': data['message']}]
        else:
            print("Validation Error: Missing history or message", flush=True)
            return jsonify({'error': 'History or message is required'}), 400
            
        policy = Policy.query.filter_by(user_id=user_id).order_by(Policy.upload_date.desc()).first()
        recs = Recommend.query.filter_by(user_id=user_id).all()
        
        context_data = ""
        if policy:
            context_data += "User Profile Data:\n"
            context_data += f"- Age: {policy.extracted_age or 'Unknown'}\n"
            context_data += f"- DOB: {policy.extracted_dob or 'Unknown'}\n"
            context_data += f"- Income: {policy.extracted_income or 'Unknown'}\n"
            context_data += f"- Marital Status: {getattr(policy, 'marital_status', None) or 'Unknown'}\n"
            context_data += f"- Vehicle Registration No: {policy.extracted_registration_no or 'Unknown'}\n"
            context_data += f"- Vehicle Make: {policy.extracted_vehicle_model or 'Unknown'}\n"
            context_data += "\n"
            
        if recs:
            context_data += "AI Recommendations for User:\n"
            for r in recs:
                context_data += f"- Type: {r.recommendation_type}\n"
                context_data += f"- Details: {r.description}\n"
                
        system_prompt = f"""You are Cover360 Advisor AI, an intelligent insurance advisor. Answer professionally using the customer's profile, uploaded motor policy, and previous conversation. If required information is missing, ask only one relevant follow-up question at a time before giving a recommendation. Remember the customer's previous answers and update recommendations dynamically. Never ask the same question twice. Keep responses concise, personalized, and focused on helping the customer choose the right insurance solution.

Response Style Rules:
- Never start responses with phrases like "Thank you for sharing", "Thank you for letting me know", "Based on the information provided", or similar acknowledgements.
- Start directly with the recommendation or analysis.
- Respond like a professional insurance advisor, not a customer support agent.
- Keep responses concise, structured, and business-oriented.
- When the customer provides new information, immediately update the analysis and recommendations instead of repeating previous information.
- Ask only one relevant follow-up question when additional information is required.
- Do not repeat explanations that have already been provided earlier in the conversation.
- Maintain conversation context and build upon previous responses.

Conversation Rules:
- Treat every user message as new profile information and update the customer profile immediately.
- If the user provides additional information that answers a previous question, do not repeat or ask the same question again.
- Infer related information whenever reasonable instead of ignoring new context.
- Ask only the next most relevant follow-up question.
- Never continue asking an outdated question after the customer has already provided newer information.
- Before asking a follow-up question, summarize how the new information changes the recommendation.
- Maintain a conversation state and dynamically update recommendations whenever the customer profile changes.

Context Data Available (Customer Profile and Motor Policy Data):
{context_data}

If the user asks about their Family Booklet or provides Family Booklet details, answer them clearly in plain text or bullet points. Do NOT output raw JSON to the user.
"""

        model = genai.GenerativeModel(
            model_name=os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
        )
        
        # Build history for Gemini
        history_msgs = []
        # Exclude the very last message, since that's the prompt
        for msg in chat_history[:-1]:
            role = "user" if msg.get("sender") == "user" else "model"
            
            # The frontend sends user text as 'text', and AI chat text as 'message' or 'text'
            text_val = msg.get("text") or msg.get("message") or ""
            
            if msg.get("type") == "recommendation":
                import json
                text_val = json.dumps(msg.get("recommendation_data", {}))
                
            if text_val.strip() == "":
                text_val = " " # Prevent empty parts error
            
            history_msgs.append({"role": role, "parts": [text_val]})
            
        last_msg = chat_history[-1].get("text", "")
        if not last_msg:
            last_msg = " "
            
        print(f"Prepared History Msgs: {history_msgs}", flush=True)
        print(f"Last User Msg: {last_msg}", flush=True)
        print("Sending to Gemini...", flush=True)
        
        chat = model.start_chat(history=history_msgs)
        
        response = chat.send_message(
            f"System Prompt:\n{system_prompt}\n\nUser Question:\n{last_msg}"
        )
        
        print(f"Gemini Raw Response: {response.text}", flush=True)
        
        try:
            reply_text = response.text
        except ValueError:
            print("Gemini API Error: Safety filter or ValueError triggered", flush=True)
            reply_text = '{"type": "chat", "message": "I am sorry, I cannot answer that question due to safety filters."}'
            
        return jsonify({"reply": reply_text})
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        global last_chat_error
        last_chat_error = error_trace
        print(f"Backend Exception: {error_trace}", flush=True)
        return jsonify({'error': f"Backend Error: {str(e)}"}), 500

last_chat_error = "No errors yet."

@app.route('/api/debug-error', methods=['GET'])
@admin_required
def debug_error(current_user):
    return jsonify({"last_error": last_chat_error})

if __name__ == '__main__':
    port = int(os.environ.get('FLASK_RUN_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
