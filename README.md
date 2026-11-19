# Cover360 - Local Development Guide

This guide explains how to run the Cover360 Frontend and Backend on your local machine.

## Prerequisites
- Node.js (v18+)
- Python (3.9+)
- Docker (optional, for running via containers)

---

## 1. Run the Backend (Python/Flask)

Open a terminal and follow these steps:

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment (optional but recommended)
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the backend server
python app.py
```
**The Backend will be available at:** `http://localhost:5000` (or whichever port `app.py` specifies)

---

## 2. Run the Frontend (Next.js)

Open a **new** terminal and follow these steps:

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
**The Frontend will be available at:** `http://localhost:3000`

---

## Alternative: Run with Docker Compose

If you have Docker installed, you can run both the frontend and backend simultaneously without manually installing dependencies.

Open a terminal in the root directory of the project and run:

```bash
docker-compose up --build
```
- **Frontend:** `http://localhost:3000`
- **Backend:** `http://localhost:5000`
