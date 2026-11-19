import os
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
    return [M('models/gemini-2.5-flash')]

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
        resp = requests.post(url, json=payload, headers={"x-goog-api-key": _api_key.strip()}).json()
        class R:
            def __init__(self, t): self.text = t
        try:
            return R(resp['candidates'][0]['content']['parts'][0]['text'])
        except Exception as e:
            print(f"Gemini API Exception parsing response: {resp}", flush=True)
            return R("{}")

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
