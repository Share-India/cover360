CREATE DATABASE IF NOT EXISTS motorai;

USE motorai;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Pending',
    extracted_policy_holder VARCHAR(200),
    extracted_registration_no VARCHAR(100),
    extracted_vehicle_model VARCHAR(200),
    extracted_manufacturer_year VARCHAR(50),
    extracted_dob VARCHAR(50),
    extracted_age INT,
    extracted_idv VARCHAR(100),
    extracted_income VARCHAR(100),
    extracted_car_cost VARCHAR(100),
    extracted_vehicle_age INT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE recommends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    recommendation_type VARCHAR(100) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);