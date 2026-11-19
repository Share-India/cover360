import py_compile
import sys
try:
    py_compile.compile('c:\\Users\\Admin\\.gemini\\Scratch\\MotorAI\\backend\\app.py', doraise=True)
    print("Syntax OK")
except py_compile.PyCompileError as e:
    print(f"Syntax Error: {e}")
except Exception as e:
    print(f"Other Error: {e}")
