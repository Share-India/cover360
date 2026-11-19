"""Create (or promote) an admin user.

Usage (from the backend folder):
    python create_admin.py "Full Name" admin@example.com
The password is asked for interactively so it never lands in shell history.
Other admins can afterwards be added from the Admin > Users page.
"""
import sys
import getpass
from werkzeug.security import generate_password_hash

from app import app
from models import db, User


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    name, email = sys.argv[1], sys.argv[2]
    password = getpass.getpass("Password (min 8 chars): ")
    if len(password) < 8:
        print("Password must be at least 8 characters.")
        sys.exit(1)
    if password != getpass.getpass("Repeat password: "):
        print("Passwords do not match.")
        sys.exit(1)
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        if user:
            user.role = 'admin'
            user.hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
            print(f"Existing user {email} is now an admin (password updated).")
        else:
            db.session.add(User(name=name, email=email, role='admin',
                                hashed_password=generate_password_hash(password, method='pbkdf2:sha256')))
            print(f"Admin {email} created.")
        db.session.commit()


if __name__ == '__main__':
    main()
