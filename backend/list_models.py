import os
import google.generativeai as genai
import sys

def main():
    try:
        genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
        models = genai.list_models()
        with open('models_output.txt', 'w') as f:
            for m in models:
                f.write(m.name + '\n')
        print("Success")
    except Exception as e:
        with open('models_output.txt', 'w') as f:
            f.write(str(e))

if __name__ == "__main__":
    main()
