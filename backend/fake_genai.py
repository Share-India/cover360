import os
import time
import requests
import json
import base64
from io import BytesIO

_api_key = None

def configure(api_key):
    global _api_key
    _api_key = api_key

def list_models():
    class M:
        def __init__(self, n): self.name = n
    return [M('models/gemini-3.8-flash')]

class GenerativeModel:
    def __init__(self, model_name):
        if not model_name.startswith('models/'):
            model_name = 'models/' + model_name
        self.model_name = model_name

    def generate_content(self, contents, **kwargs):
        url = f"https://generativelanguage.googleapis.com/v1beta/{self.model_name}:generateContent"
        parts = []
        if isinstance(contents, list):
            for c in contents:
                if isinstance(c, str):
                    parts.append({"text": c})
                elif isinstance(c, dict) and "data" in c:
                    img_data = c["data"]
                    if isinstance(img_data, bytes):
                        img_data = base64.b64encode(img_data).decode('utf-8')
                    parts.append({
                        "inline_data": {
                            "mime_type": c.get("mime_type", "image/jpeg"),
                            "data": img_data
                        }
                    })
                elif hasattr(c, 'save'): # PIL Image
                    buf = BytesIO()
                    c.save(buf, format='JPEG')
                    parts.append({
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": base64.b64encode(buf.getvalue()).decode('utf-8')
                        }
                    })
                else:
                    parts.append({"text": str(c)})
        else:
            parts.append({"text": str(contents)})
            
        payload = {"contents": [{"parts": parts}]}
        # Try the main model; if Google keeps saying "busy", optionally try GEMINI_FALLBACK_MODEL
        names = [self.model_name]
        fb = (os.environ.get('GEMINI_FALLBACK_MODEL') or '').strip()
        if fb:
            fb = fb if fb.startswith('models/') else 'models/' + fb
            if fb != self.model_name:
                names.append(fb)

        last_error = None
        for name in names:
            url = f"https://generativelanguage.googleapis.com/v1beta/{name}:generateContent"
            for attempt in range(3):
                try:
                    resp = requests.post(url, json=payload, headers={"x-goog-api-key": _api_key.strip()}, timeout=90).json()
                except requests.exceptions.Timeout:
                    raise RuntimeError("Gemini API error 504: the request timed out")
                try:
                    text = resp['candidates'][0]['content']['parts'][0]['text']
                    class R:
                        def __init__(self, t): self.text = t
                    return R(text)
                except Exception:
                    pass
                print(f"Gemini API Exception parsing response: {resp}", flush=True)
                err = resp.get('error', {}) if isinstance(resp, dict) else {}
                if not err:
                    # e.g. the answer was blocked: no error, but also no text
                    class R:
                        def __init__(self, t): self.text = t
                    return R("{}")
                last_error = RuntimeError(f"Gemini API error {err.get('code', '')}: {err.get('message', err)}")
                if err.get('code') in (429, 500, 503) and attempt < 2:
                    time.sleep(3 * (attempt + 1))   # busy / rate limited: wait and retry
                    continue
                break
        raise last_error

    def start_chat(self, history=None):
        class Chat:
            def __init__(self, m, h):
                self.model = m
                self.history = h or []
            def send_message(self, text, **kwargs):
                url = f"https://generativelanguage.googleapis.com/v1beta/{self.model}:generateContent?key={_api_key}"
                contents = []
                for h in self.history:
                    contents.append({"role": h["role"], "parts": [{"text": p} for p in h["parts"]]})
                contents.append({"role": "user", "parts": [{"text": text}]})
                resp = requests.post(url, json={"contents": contents}).json()
                class R:
                    def __init__(self, t): self.text = t
                try:
                    return R(resp['candidates'][0]['content']['parts'][0]['text'])
                except:
                    return R("I am sorry, I cannot process this right now.")
        return Chat(self.model_name, history)
