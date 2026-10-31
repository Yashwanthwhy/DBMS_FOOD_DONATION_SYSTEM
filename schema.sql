-- =====================================================================
-- FOOD DONATION MANAGEMENT SYSTEM - DATABASE SCHEMA (MySQL)
-- Compatible with MySQL 8.0+ and MySQL Workbench
-- =====================================================================

CREATE DATABASE IF NOT EXISTS food_donation_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE food_donation_db;

-- ---------------------------------------------------------------------
-- 1. DROP EXISTING TABLES IN REVERSE DEPENDENCY ORDER
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS v_distribution_impact;
DROP VIEW IF EXISTS v_active_food_packages;
DROP TABLE IF EXISTS distribution_history;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS food_packages;
DROP TABLE IF EXISTS ngos;
DROP TABLE IF EXISTS donors;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------
-- 2. USERS (Authentication & Role Base)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL DEFAULT 'pbkdf2_demo_hash',
    role ENUM('DONOR', 'NGO', 'ADMIN') NOT NULL,
    phone VARCHAR(25) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. DONORS (Entities that donate surplus food)
-- ---------------------------------------------------------------------
CREATE TABLE donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    organization_name VARCHAR(150) NOT NULL,
    donor_type ENUM('RESTAURANT', 'HOTEL', 'SUPERMARKET', 'CATERING', 'CORPORATE', 'INDIVIDUAL') NOT NULL,
    food_safety_license VARCHAR(80) NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(80) NOT NULL,
    state VARCHAR(80) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL DEFAULT 12.9716000,
    longitude DECIMAL(10, 7) NOT NULL DEFAULT 77.5946000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_donor_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. NGOS (Organizations distributing food to people in need)
-- ---------------------------------------------------------------------
CREATE TABLE ngos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    organization_name VARCHAR(150) NOT NULL,
    registration_no VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(80) NOT NULL,
    state VARCHAR(80) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    daily_servings_capacity INT NOT NULL DEFAULT 200,
    verification_status ENUM('PENDING', 'VERIFIED', 'REJECTED') DEFAULT 'VERIFIED',
    latitude DECIMAL(10, 7) NOT NULL DEFAULT 12.9750000,
    longitude DECIMAL(10, 7) NOT NULL DEFAULT 77.6050000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ngo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. FOOD PACKAGES (Surplus food items listed by Donors)
-- ---------------------------------------------------------------------
CREATE TABLE food_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    food_category ENUM('COOKED_MEALS', 'RAW_PRODUCE', 'PACKAGED_GOODS', 'BAKERY_DAIRY') NOT NULL,
    dietary_type ENUM('VEGETARIAN', 'VEGAN', 'NON_VEGETARIAN', 'MIXED') DEFAULT 'VEGETARIAN',
    quantity_kg DECIMAL(8, 2) NOT NULL,
    estimated_servings INT NOT NULL,
    storage_condition ENUM('HOT_HOLD', 'AMBIENT', 'REFRIGERATED', 'FROZEN') DEFAULT 'AMBIENT',
    prepared_at DATETIME NOT NULL,
    expiry_time DATETIME NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_instructions TEXT NULL,
    status ENUM('AVAILABLE', 'REQUESTED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'EXPIRED', 'CANCELLED') DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_package_donor FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
    INDEX idx_package_status (status),
    INDEX idx_package_expiry (expiry_time)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. REQUESTS (NGO claims/requests for food packages)
-- ---------------------------------------------------------------------
CREATE TABLE requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    ngo_id INT NOT NULL,
    needed_servings INT NOT NULL,
    request_notes TEXT NULL,
    urgency_level ENUM('NORMAL', 'HIGH', 'CRITICAL') DEFAULT 'NORMAL',
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') DEFAULT 'PENDING',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    CONSTRAINT fk_request_package FOREIGN KEY (package_id) REFERENCES food_packages(id) ON DELETE CASCADE,
    CONSTRAINT fk_request_ngo FOREIGN KEY (ngo_id) REFERENCES ngos(id) ON DELETE CASCADE,
    INDEX idx_request_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. ASSIGNMENTS (Logistics / Volunteer / Driver assignment for pickup & drop)
-- ---------------------------------------------------------------------
CREATE TABLE assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    package_id INT NOT NULL,
    ngo_id INT NOT NULL,
    driver_name VARCHAR(100) NOT NULL,
    driver_phone VARCHAR(25) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'Van',
    vehicle_number VARCHAR(50) NOT NULL,
    pickup_otp VARCHAR(6) NOT NULL,
    delivery_otp VARCHAR(6) NOT NULL,
    status ENUM('SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'FAILED') DEFAULT 'SCHEDULED',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    picked_up_at DATETIME NULL,
    delivered_at DATETIME NULL,
    notes TEXT NULL,
    CONSTRAINT fk_assignment_request FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_package FOREIGN KEY (package_id) REFERENCES food_packages(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_ngo FOREIGN KEY (ngo_id) REFERENCES ngos(id) ON DELETE CASCADE,
    INDEX idx_assignment_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. DISTRIBUTION HISTORY (Proof of distribution & impact tracking)
-- ---------------------------------------------------------------------
CREATE TABLE distribution_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NULL,
    package_id INT NOT NULL,
    ngo_id INT NOT NULL,
    donor_id INT NOT NULL,
    actual_servings_distributed INT NOT NULL,
    beneficiaries_target VARCHAR(200) NOT NULL,
    distribution_location TEXT NOT NULL,
    proof_image_url VARCHAR(255) NULL,
    feedback_notes TEXT NULL,
    rating_donor INT CHECK (rating_donor BETWEEN 1 AND 5),
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dist_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL,
    CONSTRAINT fk_dist_package FOREIGN KEY (package_id) REFERENCES food_packages(id) ON DELETE CASCADE,
    CONSTRAINT fk_dist_ngo FOREIGN KEY (ngo_id) REFERENCES ngos(id) ON DELETE CASCADE,
    CONSTRAINT fk_dist_donor FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. USEFUL ANALYTICAL VIEWS
-- ---------------------------------------------------------------------
CREATE VIEW v_active_food_packages AS
SELECT 
    fp.id AS package_id,
    fp.title,
    fp.food_category,
    fp.quantity_kg,
    fp.estimated_servings,
    fp.storage_condition,
    fp.expiry_time,
    TIMESTAMPDIFF(MINUTE, NOW(), fp.expiry_time) AS minutes_until_expiry,
    fp.status,
    d.organization_name AS donor_name,
    d.donor_type,
    d.contact_person AS donor_contact,
    d.phone AS donor_phone,
    fp.pickup_address
FROM food_packages fp
JOIN donors d ON fp.donor_id = d.id
WHERE fp.status IN ('AVAILABLE', 'REQUESTED')
  AND fp.expiry_time > NOW()
ORDER BY fp.expiry_time ASC;

CREATE VIEW v_distribution_impact AS
SELECT 
    COUNT(DISTINCT dh.id) AS total_distributions,
    COALESCE(SUM(dh.actual_servings_distributed), 0) AS total_meals_served,
    COALESCE(SUM(fp.quantity_kg), 0) AS total_food_rescued_kg,
    COUNT(DISTINCT dh.donor_id) AS active_donors_count,
    COUNT(DISTINCT dh.ngo_id) AS active_ngos_count
FROM distribution_history dh
JOIN food_packages fp ON dh.package_id = fp.id;

-- ---------------------------------------------------------------------
-- 10. REALISTIC SEED DATA (Ready for testing in MySQL Workbench)
-- ---------------------------------------------------------------------

-- Users
INSERT INTO users (id, name, email, role, phone) VALUES
(1, 'Green Leaf Bistro', 'bistro@example.com', 'DONOR', '+91 98765 43210'),
(2, 'Grand Hyatt Banquets', 'hyatt@example.com', 'DONOR', '+91 98765 43211'),
(3, 'City Food Bank Foundation', 'admin@cityfoodbank.org', 'NGO', '+91 91234 56789'),
(4, 'Hope Child Shelter', 'contact@hopechild.org', 'NGO', '+91 91234 56788'),
(5, 'Admin Officer', 'admin@foodshare.org', 'ADMIN', '+91 90000 00000');

-- Donors
INSERT INTO donors (id, user_id, organization_name, donor_type, food_safety_license, contact_person, phone, address, city, state, pincode, latitude, longitude) VALUES
(1, 1, 'Green Leaf Gourmet Bistro', 'RESTAURANT', 'FSSAI-1122334455', 'Chef Marco', '+91 98765 43210', '104, 100ft Road, Indiranagar', 'Bengaluru', 'Karnataka', '560038', 12.9783000, 77.6408000),
(2, 2, 'Grand Horizon Convention Hall', 'CATERING', 'FSSAI-9988776655', 'Rajesh Sharma', '+91 98765 43211', 'Plot 45, Outer Ring Road, Bellandur', 'Bengaluru', 'Karnataka', '560103', 12.9250000, 77.6830000);

-- NGOs
INSERT INTO ngos (id, user_id, organization_name, registration_no, contact_person, phone, address, city, state, pincode, daily_servings_capacity, verification_status, latitude, longitude) VALUES
(1, 3, 'City Food Bank Foundation', 'REG-NGO-2018-984', 'Sister Agnes', '+91 91234 56789', '12, 4th Cross, Austin Town', 'Bengaluru', 'Karnataka', '560047', 600, 'VERIFIED', 12.9610000, 77.6150000),
(2, 4, 'Hope Child & Homeless Shelter', 'REG-NGO-2021-312', 'Arun Kumar', '+91 91234 56788', '89, 7th Main, Koramangala 1st Block', 'Bengaluru', 'Karnataka', '560034', 250, 'VERIFIED', 12.9340000, 77.6280000);

-- Food Packages
INSERT INTO food_packages (id, donor_id, title, description, food_category, dietary_type, quantity_kg, estimated_servings, storage_condition, prepared_at, expiry_time, pickup_address, pickup_instructions, status) VALUES
(1, 1, '50 Portions Veg Biryani & Paneer Gravy', 'Freshly prepared evening banquet surplus in insulated food containers', 'COOKED_MEALS', 'VEGETARIAN', 22.50, 50, 'HOT_HOLD', NOW() - INTERVAL 2 HOUR, NOW() + INTERVAL 4 HOUR, '104, 100ft Road, Indiranagar, Bengaluru', 'Collect from rear service entrance, ask for Marco.', 'AVAILABLE'),
(2, 1, 'Assorted Artisan Bread & Pastries', 'Unsold fresh bakery breads, baguettes, and croissants packed in boxes', 'BAKERY_DAIRY', 'VEGETARIAN', 14.00, 40, 'AMBIENT', NOW() - INTERVAL 5 HOUR, NOW() + INTERVAL 18 HOUR, '104, 100ft Road, Indiranagar, Bengaluru', 'Front bakery counter.', 'AVAILABLE'),
(3, 2, 'North Indian Buffet Spread (Rice, Dal, Roti)', 'Leftover corporate event lunch surplus kept in hot food warmers', 'COOKED_MEALS', 'VEGETARIAN', 45.00, 110, 'HOT_HOLD', NOW() - INTERVAL 3 HOUR, NOW() + INTERVAL 3 HOUR, 'Plot 45, Outer Ring Road, Bellandur, Bengaluru', 'Loading dock B, security gate pass: FOOD45', 'ASSIGNED'),
(4, 2, 'Fresh Crate Vegetables & Pre-cut Salads', 'Raw cabbage, cucumbers, tomatoes, bell peppers in crates', 'RAW_PRODUCE', 'VEGAN', 30.00, 75, 'REFRIGERATED', NOW() - INTERVAL 6 HOUR, NOW() + INTERVAL 24 HOUR, 'Plot 45, Outer Ring Road, Bellandur, Bengaluru', 'Cold storage room #2', 'DELIVERED');

-- Requests
INSERT INTO requests (id, package_id, ngo_id, needed_servings, request_notes, urgency_level, status, requested_at) VALUES
(1, 3, 1, 110, 'Can distribute immediately at Austin Town evening shelter dinner.', 'HIGH', 'APPROVED', NOW() - INTERVAL 2 HOUR),
(2, 4, 2, 75, 'Fresh produce needed for children shelter kitchen breakfast tomorrow.', 'NORMAL', 'APPROVED', NOW() - INTERVAL 12 HOUR),
(3, 1, 2, 50, 'We have a night shelter distribution vehicle ready.', 'HIGH', 'PENDING', NOW() - INTERVAL 20 MINUTE);

-- Assignments
INSERT INTO assignments (id, request_id, package_id, ngo_id, driver_name, driver_phone, vehicle_type, vehicle_number, pickup_otp, delivery_otp, status, assigned_at, picked_up_at, delivered_at, notes) VALUES
(1, 1, 3, 1, 'Suresh Patel', '+91 94444 11223', 'Eco Van', 'KA-01-MJ-4512', '4821', '9034', 'IN_TRANSIT', NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 25 MINUTE, NULL, 'Vehicle equipped with thermal bags'),
(2, 2, 4, 2, 'Manoj Verma', '+91 94444 33445', 'Mini Truck', 'KA-05-AA-7890', '7109', '3256', 'DELIVERED', NOW() - INTERVAL 10 HOUR, NOW() - INTERVAL 8 HOUR, NOW() - INTERVAL 7 HOUR, 'Delivered and verified by shelter supervisor');

-- Distribution History
INSERT INTO distribution_history (id, assignment_id, package_id, ngo_id, donor_id, actual_servings_distributed, beneficiaries_target, distribution_location, proof_image_url, feedback_notes, rating_donor, completed_at) VALUES
(1, 2, 4, 2, 2, 75, 'Orphanage and low-income community families', 'Hope Child Shelter, Koramangala 1st Block', 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=600&q=80', 'Vegetables were fresh and clean! Children had a wholesome meal.', 5, NOW() - INTERVAL 6 HOUR);
