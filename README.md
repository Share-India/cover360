# Cover360

Reads a customer's motor insurance policy, fills in the details automatically and suggests suitable insurance covers.
Two kinds of users: **agents** (see only their own uploads) and **admins** (see everything, can add other admins).

- `backend/` - Flask API (SQLite by default, MySQL optional)
- `frontend/` - Next.js web app

## Run with Docker (recommended for deployment)

1. Copy `.env.example` to `.env` and set at least `SECRET_KEY` (long random string) and `GEMINI_API_KEY`.
2. Start everything:
   ```bash
   docker compose up -d --build
   ```
   Web app: http://localhost:3000 - API: http://localhost:5000
3. Create the first admin (asks for the password; later admins can be added in the app under *Users*):
   ```bash
   docker compose exec -it backend python create_admin.py "Your Name" admin@yourcompany.com
   ```
   Admin sign-in page: `/admin/login`. Agents sign in at `/login`.

Data (the SQLite database) lives in the `cover360-data` Docker volume, so it survives restarts and rebuilds.
Back it up with `docker run --rm -v cover360-data:/data -v "$PWD":/backup alpine tar czf /backup/cover360-data.tgz -C /data .`

### Deploying on a server / domain
- The browser must be able to reach the API. Either keep ports 3000 and 5000 open (default: the site calls
  `<same host>:5000/api`), or put both behind a reverse proxy with HTTPS and set `PUBLIC_API_URL`
  (for example `https://api.yourdomain.com/api`) in `.env`, then rebuild with `docker compose up -d --build`.
- Use HTTPS in production; logins are sent as bearer tokens.
- To use MySQL instead of SQLite, set `DATABASE_URL=mysql+pymysql://user:password@host/dbname` in `.env`.

## Run locally without Docker

Backend (Python 3.10+):
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # then edit it
python app.py                # http://localhost:5000
python create_admin.py "Your Name" admin@yourcompany.com
```

Frontend (Node 20+):
```bash
cd frontend
npm install
npm run dev                  # http://localhost:3000
```
