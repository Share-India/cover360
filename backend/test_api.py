import requests

url = 'http://localhost:5000/api/analyze-policy'
files = {'file': ('test.pdf', b'dummy content')}
response = requests.post(url, files=files)
print(response.status_code)
print(response.text)
