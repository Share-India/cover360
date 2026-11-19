import os
import sys
import json
import fitz
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

def convert_pdf_to_images(file_path):
    images = []
    try:
        doc = fitz.open(file_path)
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("jpeg")
            images.append({"mime_type": "image/jpeg", "data": img_bytes})
    except Exception as e:
        print(f"Error converting PDF {file_path} to images: {e}")
    return images

system_prompt = """You are an expert Motor Insurance data extractor. 
I will provide you with the raw text or images from an insurance policy document.
You must extract the following information and return ONLY a valid JSON object:
{
  "policyHolderName": "string",
  "vehicleRegistrationNo": "string",
  "vehicleModel": "string (Extract BOTH the Vehicle Make and the Vehicle Model. E.g., 'Honda Civic', 'Maruti Suzuki Swift')",
  "manufacturerYear": "string (Extract ONLY the exact 4-digit Year of Manufacture found in the document. Do not guess or use example years. If not found, return 'Not Found')",
  "vehicleAge": "string (Extract the exact Vehicle Age if explicitly stated. Do not guess. If not found, return 'Not Found')",
  "periodOfInsurance": "string",
  "dob": "string (Extract Policy Holder's Date of Birth)",
  "age": "string (Extract the Policy Holder's Age in years)",
  "idv": "string",
  "income": "string",
  "purchasePrice": "string"
}
If a field cannot be found, set its value to "Not Found". Do not include any markdown formatting, backticks, or extra text. Output pure JSON."""

# To test specific files, pass them as arguments: python test_extraction.py path/to/file1.pdf
pdfs = sys.argv[1:] if len(sys.argv) > 1 else []

if not pdfs:
    print("No PDFs provided. Please pass PDF file paths as arguments.")
    sys.exit(0)

model = genai.GenerativeModel(os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash'))

results = {}

for pdf in pdfs:
    print(f"Processing: {os.path.basename(pdf)}")
    images = convert_pdf_to_images(pdf)
    content_payload = [system_prompt, "Here is the insurance policy document:\n\n"]
    if images:
        content_payload.extend(images)
    else:
        print("No images extracted")
        continue

    try:
        response = model.generate_content(content_payload)
        ai_output = response.text
        start = ai_output.find('{')
        end = ai_output.rfind('}')
        if start != -1 and end != -1:
            ai_output = ai_output[start:end+1]
        
        parsed_data = json.loads(ai_output)
        results[os.path.basename(pdf)] = parsed_data
        print(f"Success for {os.path.basename(pdf)}")
    except Exception as e:
        print(f"Error processing {os.path.basename(pdf)}: {e}")

with open("extraction_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("Done. Saved to extraction_results.json")
