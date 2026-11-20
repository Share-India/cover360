from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    mobile = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(20), nullable=False, default='agent')  # 'admin' or 'agent'
    hashed_password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    policies = db.relationship('Policy', backref='user', lazy=True)
    recommendations = db.relationship('Recommend', backref='user', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role or 'agent'
        }

class Policy(db.Model):
    __tablename__ = 'policies'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='Pending') # Pending, Processing, Completed, Failed
    
    # Extracted data fields
    extracted_policy_holder = db.Column(db.String(200), nullable=True)
    extracted_registration_no = db.Column(db.String(100), nullable=True)
    extracted_vehicle_model = db.Column(db.String(200), nullable=True)
    extracted_manufacturer_year = db.Column(db.String(50), nullable=True)
    extracted_period_of_insurance = db.Column(db.String(200), nullable=True)
    
    # New demographic and financial fields
    extracted_dob = db.Column(db.String(50), nullable=True)
    extracted_age = db.Column(db.Integer, nullable=True)
    extracted_idv = db.Column(db.String(100), nullable=True)
    extracted_income = db.Column(db.String(100), nullable=True)
    extracted_car_cost = db.Column(db.String(100), nullable=True)
    extracted_vehicle_age = db.Column(db.Integer, nullable=True)
    estimated_original_cost = db.Column(db.String(100), nullable=True)

    # Contact details (from KYC / policy) and email delivery tracking
    extracted_email = db.Column(db.String(200), nullable=True)
    extracted_mobile = db.Column(db.String(30), nullable=True)
    kyc_file_name = db.Column(db.String(255), nullable=True)
    email_status = db.Column(db.String(30), nullable=True)  # sent / failed
    email_sent_to = db.Column(db.String(200), nullable=True)
    email_sent_at = db.Column(db.DateTime, nullable=True)

    # Raw AI text
    raw_text = db.Column(db.Text, nullable=True)

    def to_dict(self, include_owner=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'file_name': self.file_name,
            'upload_date': self.upload_date.isoformat(),
            'status': self.status,
            # UI expects these keys
            'policyHolderName': self.extracted_policy_holder,
            'vehicleRegistrationNo': self.extracted_registration_no,
            'vehicleModel': self.extracted_vehicle_model,
            'manufacturerYear': self.extracted_manufacturer_year,
            'periodOfInsurance': self.extracted_period_of_insurance,
            'dob': self.extracted_dob,
            'age': self.extracted_age,
            'idv': self.extracted_idv,
            'income': self.extracted_income,
            'carCost': self.extracted_car_cost,
            'vehicleAge': self.extracted_vehicle_age,
            'estimatedOriginalCost': self.estimated_original_cost,
            'email': self.extracted_email,
            'mobile': self.extracted_mobile,
            'kycFileName': self.kyc_file_name,
            'emailStatus': self.email_status,
            'emailSentTo': self.email_sent_to,
            'emailSentAt': self.email_sent_at.isoformat() if self.email_sent_at else None
        }
        if include_owner and self.user is not None:
            data['uploadedBy'] = {'id': self.user.id, 'name': self.user.name, 'email': self.user.email}
        return data

class Recommend(db.Model):
    __tablename__ = 'recommends'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    recommendation_type = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        desc_data = self.description
        try:
            import json
            desc_data = json.loads(self.description)
        except:
            pass
            
        return {
            'id': self.id,
            'user_id': self.user_id,
            'recommendation_type': self.recommendation_type,
            'description': desc_data,
            'created_at': self.created_at.isoformat()
        }


class OtpRequest(db.Model):
    """A one-time password sent to a mobile number during sign-up (only a hash is stored)."""
    __tablename__ = 'otp_requests'

    id = db.Column(db.Integer, primary_key=True)
    mobile = db.Column(db.String(20), nullable=False, index=True)
    otp_hash = db.Column(db.String(64), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    used = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
