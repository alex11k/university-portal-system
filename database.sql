-- ============================================
-- University Portal Database Schema
-- ============================================

-- Create database
CREATE DATABASE IF NOT EXISTS university_portal;
USE university_portal;

-- ========== USERS & AUTHENTICATION ==========

-- Users table (Main user information)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    age INT,
    birthday DATE,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    location VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    emergency_contact VARCHAR(100),
    blood_group VARCHAR(5),
    bio TEXT,
    profile_image VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User profiles (Account setup information)
CREATE TABLE user_profiles (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    focal_person VARCHAR(100),
    user_type ENUM('employee', 'student') NOT NULL,
    employee_number VARCHAR(50) UNIQUE,
    student_number VARCHAR(50) UNIQUE,
    code_number VARCHAR(50) UNIQUE NOT NULL,
    department_id INT,
    campus_id INT,
    date_joined DATE,
    position_title VARCHAR(100),
    supervisor_id INT,
    profile_completion_percentage INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (campus_id) REFERENCES campuses(campus_id),
    FOREIGN KEY (supervisor_id) REFERENCES users(user_id)
);

-- User login sessions
CREATE TABLE user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Password reset tokens
CREATE TABLE password_resets (
    reset_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ========== DEPARTMENT STRUCTURE ==========

-- Campuses table
CREATE TABLE campuses (
    campus_id INT PRIMARY KEY AUTO_INCREMENT,
    campus_code VARCHAR(10) UNIQUE NOT NULL,
    campus_name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    established_year YEAR,
    total_area DECIMAL(10,2), -- in square meters
    is_active BOOLEAN DEFAULT TRUE
);

-- Departments table
CREATE TABLE departments (
    department_id INT PRIMARY KEY AUTO_INCREMENT,
    department_code VARCHAR(10) UNIQUE NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    description TEXT,
    campus_id INT NOT NULL,
    building_name VARCHAR(100),
    floor_number VARCHAR(10),
    room_number VARCHAR(20),
    department_head_id INT,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    established_date DATE,
    total_employees INT DEFAULT 0,
    total_students INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (campus_id) REFERENCES campuses(campus_id),
    FOREIGN KEY (department_head_id) REFERENCES users(user_id)
);

-- Department offices
CREATE TABLE department_offices (
    office_id INT PRIMARY KEY AUTO_INCREMENT,
    department_id INT NOT NULL,
    office_name VARCHAR(100),
    room_number VARCHAR(20),
    floor VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(100),
    office_hours TEXT,
    is_main_office BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE CASCADE
);

-- ========== LEAVE MANAGEMENT ==========

-- Leave types
CREATE TABLE leave_types (
    type_id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    type_code VARCHAR(10) UNIQUE NOT NULL,
    description TEXT,
    max_days_per_year INT,
    min_days_per_request INT DEFAULT 1,
    max_days_per_request INT,
    requires_approval BOOLEAN DEFAULT TRUE,
    requires_documentation BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Leave requests
CREATE TABLE leave_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(5,1) NOT NULL, -- Supports half days (0.5)
    reason TEXT NOT NULL,
    contact_during_leave VARCHAR(100),
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    supervisor_approval BOOLEAN DEFAULT FALSE,
    hr_approval BOOLEAN DEFAULT FALSE,
    approved_by INT,
    rejection_reason TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (type_id) REFERENCES leave_types(type_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    CHECK (end_date >= start_date)
);

-- Leave balances
CREATE TABLE leave_balances (
    balance_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type_id INT NOT NULL,
    year YEAR NOT NULL,
    total_allocated INT DEFAULT 0,
    used DECIMAL(5,1) DEFAULT 0,
    remaining DECIMAL(5,1) AS (total_allocated - used),
    carried_over_from_previous INT DEFAULT 0,
    expires_at DATE,
    UNIQUE KEY unique_user_leave_year (user_id, type_id, year),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (type_id) REFERENCES leave_types(type_id)
);

-- Leave documents (for medical/special leaves)
CREATE TABLE leave_documents (
    document_id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,
    document_type VARCHAR(50),
    document_path VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_by INT,
    verified_at TIMESTAMP NULL,
    FOREIGN KEY (request_id) REFERENCES leave_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(user_id)
);

-- ========== ATTENDANCE & SCHEDULE ==========

-- User schedules
CREATE TABLE user_schedules (
    schedule_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
    start_time TIME,
    end_time TIME,
    is_working_day BOOLEAN DEFAULT TRUE,
    effective_from DATE,
    effective_to DATE,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Holidays
CREATE TABLE holidays (
    holiday_id INT PRIMARY KEY AUTO_INCREMENT,
    holiday_name VARCHAR(100) NOT NULL,
    holiday_date DATE NOT NULL,
    holiday_type ENUM('national', 'regional', 'institutional', 'optional'),
    description TEXT,
    year YEAR,
    is_recurring BOOLEAN DEFAULT TRUE
);

-- ========== NOTIFICATIONS ==========

-- System notifications
CREATE TABLE notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error', 'leave_update', 'profile_update'),
    is_read BOOLEAN DEFAULT FALSE,
    related_entity_type VARCHAR(50), -- 'leave_request', 'department', etc.
    related_entity_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ========== AUDIT LOG ==========

-- Audit trail for important actions
CREATE TABLE audit_log (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert default campuses
INSERT INTO campuses (campus_code, campus_name, location, address, phone, email, established_year) VALUES
('MAIN', 'Main Campus', '123 University Ave, City', 'Main University Complex', '(123) 456-7890', 'main@university.edu', 1950),
('NORTH', 'North Campus', '456 North Street, City', 'Engineering and Technology Campus', '(123) 456-7891', 'north@university.edu', 1975),
('SOUTH', 'South Campus', '789 South Road, City', 'Medical and Health Sciences Campus', '(123) 456-7892', 'south@university.edu', 1980),
('EAST', 'East Campus', '321 East Avenue, City', 'Business and Law Campus', '(123) 456-7893', 'east@university.edu', 1990),
('WEST', 'West Campus', '654 West Boulevard, City', 'Arts and Humanities Campus', '(123) 456-7894', 'west@university.edu', 2000);

-- Insert default departments
INSERT INTO departments (department_code, department_name, description, campus_id, building_name, room_number, contact_email, contact_phone) VALUES
('CS', 'Computer Science', 'Department of Computer Science and Engineering', 1, 'Technology Building', '301', 'cs@university.edu', '(123) 555-0101'),
('BUS', 'Business Administration', 'School of Business and Management', 4, 'Business Tower', '210', 'business@university.edu', '(123) 555-0102'),
('ME', 'Mechanical Engineering', 'Department of Mechanical and Aerospace Engineering', 2, 'Engineering Complex', '101', 'mech@university.edu', '(123) 555-0103'),
('MED', 'Medicine', 'School of Medicine and Health Sciences', 3, 'Medical Center', '501', 'medicine@university.edu', '(123) 555-0104'),
('ENG', 'English Literature', 'Department of English Language and Literature', 5, 'Humanities Hall', '401', 'english@university.edu', '(123) 555-0105'),
('PHY', 'Physics', 'Department of Physics and Astronomy', 1, 'Science Building', '205', 'physics@university.edu', '(123) 555-0106');

-- Insert default leave types
INSERT INTO leave_types (type_name, type_code, description, max_days_per_year, requires_documentation) VALUES
('Sick Leave', 'SL', 'Leave for illness or medical treatment', 15, TRUE),
('Vacation Leave', 'VL', 'Annual vacation leave', 30, FALSE),
('Personal Leave', 'PL', 'Leave for personal reasons', 10, FALSE),
('Maternity Leave', 'ML', 'Leave for childbirth and maternity', 180, TRUE),
('Paternity Leave', 'PTL', 'Leave for new fathers', 14, TRUE),
('Study Leave', 'STL', 'Leave for academic studies', 30, TRUE),
('Emergency Leave', 'EL', 'Leave for emergencies', 5, TRUE);

-- Insert default holidays for current year
INSERT INTO holidays (holiday_name, holiday_date, holiday_type, description, year) VALUES
('New Year''s Day', '2024-01-01', 'national', 'New Year Celebration', 2024),
('University Foundation Day', '2024-02-15', 'institutional', 'University anniversary', 2024),
('Spring Break', '2024-03-11', 'institutional', 'Spring vacation', 2024),
('Summer Break', '2024-06-01', 'institutional', 'Summer vacation start', 2024),
('Independence Day', '2024-07-04', 'national', 'National Independence Day', 2024);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_active ON users(is_active);

-- User profiles indexes
CREATE INDEX idx_user_profiles_user_type ON user_profiles(user_type);
CREATE INDEX idx_user_profiles_department ON user_profiles(department_id);
CREATE INDEX idx_user_profiles_campus ON user_profiles(campus_id);

-- Departments indexes
CREATE INDEX idx_departments_campus ON departments(campus_id);
CREATE INDEX idx_departments_code ON departments(department_code);

-- Leave requests indexes
CREATE INDEX idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_requests_submitted ON leave_requests(submitted_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- Audit log indexes
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- ============================================
-- CREATE VIEWS FOR REPORTING
-- ============================================

-- View for user department information
CREATE VIEW user_department_view AS
SELECT 
    u.user_id,
    u.full_name,
    u.email,
    up.user_type,
    up.employee_number,
    up.student_number,
    d.department_name,
    c.campus_name,
    c.location
FROM users u
LEFT JOIN user_profiles up ON u.user_id = up.user_id
LEFT JOIN departments d ON up.department_id = d.department_id
LEFT JOIN campuses c ON up.campus_id = c.campus_id;

-- View for leave balance summary
CREATE VIEW leave_balance_summary AS
SELECT 
    u.user_id,
    u.full_name,
    d.department_name,
    lt.type_name,
    lb.year,
    lb.total_allocated,
    lb.used,
    lb.remaining,
    lb.carried_over_from_previous
FROM users u
JOIN leave_balances lb ON u.user_id = lb.user_id
JOIN leave_types lt ON lb.type_id = lt.type_id
LEFT JOIN user_profiles up ON u.user_id = up.user_id
LEFT JOIN departments d ON up.department_id = d.department_id;

-- View for department statistics
CREATE VIEW department_statistics AS
SELECT 
    d.department_id,
    d.department_name,
    c.campus_name,
    COUNT(DISTINCT up.user_id) as total_members,
    COUNT(DISTINCT CASE WHEN up.user_type = 'employee' THEN up.user_id END) as total_employees,
    COUNT(DISTINCT CASE WHEN up.user_type = 'student' THEN up.user_id END) as total_students,
    COUNT(DISTINCT lr.request_id) as total_leave_requests,
    AVG(up.profile_completion_percentage) as avg_profile_completion
FROM departments d
LEFT JOIN campuses c ON d.campus_id = c.campus_id
LEFT JOIN user_profiles up ON d.department_id = up.department_id
LEFT JOIN leave_requests lr ON up.user_id = lr.user_id
GROUP BY d.department_id, d.department_name, c.campus_name;

-- ============================================
-- CREATE STORED PROCEDURES
-- ============================================

-- Procedure to create a new user
DELIMITER //
CREATE PROCEDURE CreateNewUser(
    IN p_email VARCHAR(100),
    IN p_username VARCHAR(50),
    IN p_password_hash VARCHAR(255),
    IN p_full_name VARCHAR(100),
    IN p_age INT,
    IN p_birthday DATE,
    IN p_gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    IN p_location VARCHAR(100)
)
BEGIN
    DECLARE new_user_id INT;
    
    -- Insert into users table
    INSERT INTO users (email, username, password_hash, full_name, age, birthday, gender, location)
    VALUES (p_email, p_username, p_password_hash, p_full_name, p_age, p_birthday, p_gender, p_location);
    
    SET new_user_id = LAST_INSERT_ID();
    
    -- Insert default leave balances for the current year
    INSERT INTO leave_balances (user_id, type_id, year, total_allocated)
    SELECT new_user_id, type_id, YEAR(CURDATE()), max_days_per_year
    FROM leave_types
    WHERE is_active = TRUE;
    
    SELECT new_user_id as user_id, 'User created successfully' as message;
END//
DELIMITER ;

-- Procedure to request leave
DELIMITER //
CREATE PROCEDURE RequestLeave(
    IN p_user_id INT,
    IN p_type_id INT,
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_reason TEXT,
    IN p_contact_during_leave VARCHAR(100)
)
BEGIN
    DECLARE v_total_days DECIMAL(5,1);
    DECLARE v_remaining_days DECIMAL(5,1);
    DECLARE v_year YEAR;
    
    -- Calculate total days
    SET v_total_days = DATEDIFF(p_end_date, p_start_date) + 1;
    SET v_year = YEAR(p_start_date);
    
    -- Check leave balance
    SELECT remaining INTO v_remaining_days
    FROM leave_balances
    WHERE user_id = p_user_id 
    AND type_id = p_type_id 
    AND year = v_year;
    
    IF v_remaining_days IS NULL OR v_remaining_days < v_total_days THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Insufficient leave balance';
    ELSE
        -- Create leave request
        INSERT INTO leave_requests (user_id, type_id, start_date, end_date, total_days, reason, contact_during_leave)
        VALUES (p_user_id, p_type_id, p_start_date, p_end_date, v_total_days, p_reason, p_contact_during_leave);
        
        -- Create notification
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (p_user_id, 'Leave Request Submitted', 
                CONCAT('Your leave request for ', v_total_days, ' days has been submitted and is pending approval.'), 
                'leave_update');
        
        SELECT LAST_INSERT_ID() as request_id, 'Leave request submitted successfully' as message;
    END IF;
END//
DELIMITER ;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

-- Trigger to update leave balance when leave is approved
DELIMITER //
CREATE TRIGGER after_leave_approved
AFTER UPDATE ON leave_requests
FOR EACH ROW
BEGIN
    DECLARE v_year YEAR;
    
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        SET v_year = YEAR(NEW.start_date);
        
        -- Update used leave balance
        UPDATE leave_balances
        SET used = used + NEW.total_days
        WHERE user_id = NEW.user_id 
        AND type_id = NEW.type_id 
        AND year = v_year;
        
        -- Create notification
        INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
        VALUES (NEW.user_id, 'Leave Request Approved', 
                CONCAT('Your leave request from ', DATE_FORMAT(NEW.start_date, '%M %d, %Y'), 
                       ' to ', DATE_FORMAT(NEW.end_date, '%M %d, %Y'), ' has been approved.'), 
                'success', 'leave_request', NEW.request_id);
    END IF;
END//
DELIMITER ;

-- Trigger to update employee/student counts in departments
DELIMITER //
CREATE TRIGGER after_user_profile_update
AFTER UPDATE ON user_profiles
FOR EACH ROW
BEGIN
    -- Update department statistics if department changed
    IF NEW.department_id != OLD.department_id OR (NEW.department_id IS NOT NULL AND OLD.department_id IS NULL) THEN
        -- Decrement from old department
        IF OLD.department_id IS NOT NULL THEN
            IF OLD.user_type = 'employee' THEN
                UPDATE departments 
                SET total_employees = GREATEST(total_employees - 1, 0)
                WHERE department_id = OLD.department_id;
            ELSE
                UPDATE departments 
                SET total_students = GREATEST(total_students - 1, 0)
                WHERE department_id = OLD.department_id;
            END IF;
        END IF;
        
        -- Increment to new department
        IF NEW.department_id IS NOT NULL THEN
            IF NEW.user_type = 'employee' THEN
                UPDATE departments 
                SET total_employees = total_employees + 1
                WHERE department_id = NEW.department_id;
            ELSE
                UPDATE departments 
                SET total_students = total_students + 1
                WHERE department_id = NEW.department_id;
            END IF;
        END IF;
    END IF;
END//
DELIMITER ;

-- ============================================
-- CREATE FUNCTIONS
-- ============================================

-- Function to calculate user's age
DELIMITER //
CREATE FUNCTION CalculateAge(birthdate DATE)
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN TIMESTAMPDIFF(YEAR, birthdate, CURDATE());
END//
DELIMITER ;

-- Function to check if a date is a working day
DELIMITER //
CREATE FUNCTION IsWorkingDay(check_date DATE)
RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    DECLARE day_name VARCHAR(10);
    DECLARE is_holiday BOOLEAN;
    
    SET day_name = DAYNAME(check_date);
    SET is_holiday = EXISTS(SELECT 1 FROM holidays WHERE holiday_date = check_date);
    
    RETURN NOT (day_name IN ('Saturday', 'Sunday') OR is_holiday);
END//
DELIMITER ;

-- ============================================
-- GRANT PERMISSIONS (Adjust based on your setup)
-- ============================================

-- Create a dedicated user for the web application
CREATE USER IF NOT EXISTS 'portal_user'@'localhost' IDENTIFIED BY 'SecurePass123!';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON university_portal.* TO 'portal_user'@'localhost';
FLUSH PRIVILEGES;

-- ============================================
-- END OF DATABASE SCHEMA
-- ============================================