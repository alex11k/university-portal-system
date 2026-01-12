const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'portal_user',
    password: process.env.DB_PASSWORD || 'SecurePass123!',
    database: process.env.DB_NAME || 'university_portal',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// ========== MIDDLEWARE ==========
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access token required' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

// ========== AUTHENTICATION ROUTES ==========

// User Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, username, password, full_name, age, birthday, gender, location } = req.body;
        
        // Check if user exists
        const [existing] = await pool.execute(
            'SELECT user_id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email or username already exists' });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Create user using stored procedure
        const [result] = await pool.execute(
            'CALL CreateNewUser(?, ?, ?, ?, ?, ?, ?, ?)',
            [email, username, passwordHash, full_name, age, birthday, gender, location]
        );
        
        res.status(201).json({
            message: 'User registered successfully',
            userId: result[0][0].user_id
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user
        const [users] = await pool.execute(
            `SELECT u.*, up.user_type, d.department_name, c.campus_name 
             FROM users u 
             LEFT JOIN user_profiles up ON u.user_id = up.user_id 
             LEFT JOIN departments d ON up.department_id = d.department_id 
             LEFT JOIN campuses c ON up.campus_id = c.campus_id 
             WHERE u.username = ? OR u.email = ?`,
            [username, username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = users[0];
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create JWT token
        const token = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                username: user.username,
                userType: user.user_type
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Remove sensitive data
        delete user.password_hash;
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                userId: user.user_id,
                email: user.email,
                username: user.username,
                fullName: user.full_name,
                userType: user.user_type,
                department: user.department_name,
                campus: user.campus_name,
                profileComplete: user.profile_completion_percentage === 100
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// ========== USER PROFILE ROUTES ==========

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const [results] = await pool.execute(
            `SELECT u.*, up.*, d.department_name, d.department_code, 
                    c.campus_name, c.campus_code,
                    su.full_name as supervisor_name
             FROM users u
             LEFT JOIN user_profiles up ON u.user_id = up.user_id
             LEFT JOIN departments d ON up.department_id = d.department_id
             LEFT JOIN campuses c ON up.campus_id = c.campus_id
             LEFT JOIN users su ON up.supervisor_id = su.user_id
             WHERE u.user_id = ?`,
            [req.user.userId]
        );
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = results[0];
        delete user.password_hash;
        
        res.json({ user });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const {
            focal_person, user_type, employee_number, student_number,
            department_id, campus_id, position_title, supervisor_id
        } = req.body;
        
        // Generate code number
        const codeNumber = `${user_type === 'employee' ? 'EMP' : 'STU'}-${Date.now().toString().slice(-6)}`;
        
        // Calculate profile completion
        let completion = 40; // Base
        if (focal_person) completion += 5;
        if (department_id) completion += 10;
        if (campus_id) completion += 10;
        if (user_type === 'employee' && employee_number) completion += 10;
        if (user_type === 'student' && student_number) completion += 10;
        completion = Math.min(completion, 100);
        
        // Check if profile exists
        const [existing] = await pool.execute(
            'SELECT profile_id FROM user_profiles WHERE user_id = ?',
            [req.user.userId]
        );
        
        if (existing.length > 0) {
            // Update existing profile
            await pool.execute(
                `UPDATE user_profiles SET 
                    focal_person = ?, user_type = ?, employee_number = ?, 
                    student_number = ?, code_number = ?, department_id = ?, 
                    campus_id = ?, position_title = ?, supervisor_id = ?,
                    profile_completion_percentage = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [
                    focal_person, user_type, employee_number,
                    student_number, codeNumber, department_id,
                    campus_id, position_title, supervisor_id,
                    completion, req.user.userId
                ]
            );
        } else {
            // Create new profile
            await pool.execute(
                `INSERT INTO user_profiles 
                 (user_id, focal_person, user_type, employee_number, student_number, 
                  code_number, department_id, campus_id, position_title, supervisor_id, profile_completion_percentage)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.userId, focal_person, user_type, employee_number,
                    student_number, codeNumber, department_id,
                    campus_id, position_title, supervisor_id, completion
                ]
            );
        }
        
        res.json({ 
            message: 'Profile updated successfully',
            profileCompletion: completion
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== DEPARTMENT ROUTES ==========

// Get all departments
app.get('/api/departments', async (req, res) => {
    try {
        const [departments] = await pool.execute(
            `SELECT d.*, c.campus_name, c.location as campus_location,
                    u.full_name as department_head_name,
                    COUNT(DISTINCT up.user_id) as total_members
             FROM departments d
             LEFT JOIN campuses c ON d.campus_id = c.campus_id
             LEFT JOIN users u ON d.department_head_id = u.user_id
             LEFT JOIN user_profiles up ON d.department_id = up.department_id
             WHERE d.is_active = TRUE
             GROUP BY d.department_id
             ORDER BY d.department_name`
        );
        
        res.json({ departments });
    } catch (error) {
        console.error('Departments fetch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get departments by campus
app.get('/api/departments/campus/:campusId', async (req, res) => {
    try {
        const [departments] = await pool.execute(
            `SELECT d.*, c.campus_name,
                    COUNT(DISTINCT CASE WHEN up.user_type = 'employee' THEN up.user_id END) as total_employees,
                    COUNT(DISTINCT CASE WHEN up.user_type = 'student' THEN up.user_id END) as total_students
             FROM departments d
             LEFT JOIN campuses c ON d.campus_id = c.campus_id
             LEFT JOIN user_profiles up ON d.department_id = up.department_id
             WHERE d.campus_id = ? AND d.is_active = TRUE
             GROUP BY d.department_id`,
            [req.params.campusId]
        );
        
        res.json({ departments });
    } catch (error) {
        console.error('Campus departments error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== LEAVE MANAGEMENT ROUTES ==========

// Get leave types
app.get('/api/leave/types', authenticateToken, async (req, res) => {
    try {
        const [types] = await pool.execute(
            'SELECT * FROM leave_types WHERE is_active = TRUE ORDER BY type_name'
        );
        res.json({ types });
    } catch (error) {
        console.error('Leave types error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user leave balance
app.get('/api/leave/balance', authenticateToken, async (req, res) => {
    try {
        const [balances] = await pool.execute(
            `SELECT lt.type_name, lb.year, lb.total_allocated, lb.used, lb.remaining
             FROM leave_balances lb
             JOIN leave_types lt ON lb.type_id = lt.type_id
             WHERE lb.user_id = ? AND lb.year = YEAR(CURDATE())`,
            [req.user.userId]
        );
        
        // Calculate summary
        const summary = {
            totalAllocated: balances.reduce((sum, b) => sum + b.total_allocated, 0),
            totalUsed: balances.reduce((sum, b) => sum + b.used, 0),
            totalRemaining: balances.reduce((sum, b) => sum + b.remaining, 0)
        };
        
        res.json({ balances, summary });
    } catch (error) {
        console.error('Leave balance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Submit leave request
app.post('/api/leave/request', authenticateToken, async (req, res) => {
    try {
        const { type_id, start_date, end_date, reason, contact_during_leave } = req.body;
        
        // Use stored procedure
        const [result] = await pool.execute(
            'CALL RequestLeave(?, ?, ?, ?, ?, ?)',
            [req.user.userId, type_id, start_date, end_date, reason, contact_during_leave]
        );
        
        res.status(201).json({
            message: 'Leave request submitted successfully',
            requestId: result[0][0].request_id
        });
    } catch (error) {
        console.error('Leave request error:', error);
        if (error.code === '45000') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Server error' });
        }
    }
});

// Get user leave history
app.get('/api/leave/history', authenticateToken, async (req, res) => {
    try {
        const { status, year } = req.query;
        
        let query = `
            SELECT lr.*, lt.type_name,
                   DATE_FORMAT(lr.start_date, '%Y-%m-%d') as start_date_formatted,
                   DATE_FORMAT(lr.end_date, '%Y-%m-%d') as end_date_formatted,
                   DATE_FORMAT(lr.submitted_at, '%Y-%m-%d %H:%i') as submitted_at_formatted
            FROM leave_requests lr
            JOIN leave_types lt ON lr.type_id = lt.type_id
            WHERE lr.user_id = ?
        `;
        
        const params = [req.user.userId];
        
        if (status && status !== 'all') {
            query += ' AND lr.status = ?';
            params.push(status);
        }
        
        if (year) {
            query += ' AND YEAR(lr.start_date) = ?';
            params.push(year);
        }
        
        query += ' ORDER BY lr.submitted_at DESC';
        
        const [history] = await pool.execute(query, params);
        res.json({ history });
    } catch (error) {
        console.error('Leave history error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== CAMPUS ROUTES ==========

// Get all campuses
app.get('/api/campuses', async (req, res) => {
    try {
        const [campuses] = await pool.execute(
            `SELECT c.*, 
                    COUNT(DISTINCT d.department_id) as total_departments,
                    COUNT(DISTINCT up.user_id) as total_users
             FROM campuses c
             LEFT JOIN departments d ON c.campus_id = d.campus_id AND d.is_active = TRUE
             LEFT JOIN user_profiles up ON c.campus_id = up.campus_id
             WHERE c.is_active = TRUE
             GROUP BY c.campus_id
             ORDER BY c.campus_name`
        );
        
        res.json({ campuses });
    } catch (error) {
        console.error('Campuses error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== STATISTICS ROUTES ==========

// Get system statistics
app.get('/api/statistics', authenticateToken, async (req, res) => {
    try {
        const [stats] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as total_users,
                (SELECT COUNT(*) FROM departments WHERE is_active = TRUE) as total_departments,
                (SELECT COUNT(*) FROM campuses WHERE is_active = TRUE) as total_campuses,
                (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') as pending_leaves,
                (SELECT AVG(profile_completion_percentage) FROM user_profiles) as avg_profile_completion,
                (SELECT COUNT(*) FROM users WHERE is_verified = TRUE) as verified_users
        `);
        
        res.json({ statistics: stats[0] });
    } catch (error) {
        console.error('Statistics error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== DASHBOARD DATA ==========

// Get dashboard data
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        // User info
        const [userInfo] = await pool.execute(
            `SELECT u.full_name, u.email, up.user_type, up.profile_completion_percentage,
                    d.department_name, c.campus_name
             FROM users u
             LEFT JOIN user_profiles up ON u.user_id = up.user_id
             LEFT JOIN departments d ON up.department_id = d.department_id
             LEFT JOIN campuses c ON up.campus_id = c.campus_id
             WHERE u.user_id = ?`,
            [req.user.userId]
        );
        
        // Recent leaves
        const [recentLeaves] = await pool.execute(
            `SELECT lr.request_id, lt.type_name, lr.start_date, lr.end_date, lr.status,
                    DATEDIFF(lr.end_date, lr.start_date) + 1 as duration
             FROM leave_requests lr
             JOIN leave_types lt ON lr.type_id = lt.type_id
             WHERE lr.user_id = ?
             ORDER BY lr.submitted_at DESC
             LIMIT 5`,
            [req.user.userId]
        );
        
        // Notifications
        const [notifications] = await pool.execute(
            `SELECT notification_id, title, message, type, is_read, created_at
             FROM notifications
             WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY created_at DESC
             LIMIT 10`,
            [req.user.userId]
        );
        
        // Upcoming holidays
        const [holidays] = await pool.execute(
            `SELECT holiday_name, holiday_date, holiday_type
             FROM holidays
             WHERE holiday_date >= CURDATE()
             ORDER BY holiday_date
             LIMIT 5`
        );
        
        res.json({
            user: userInfo[0] || {},
            recentLeaves,
            notifications,
            upcomingHolidays: holidays,
            stats: {
                totalLeaves: recentLeaves.length,
                unreadNotifications: notifications.filter(n => !n.is_read).length,
                upcomingHolidays: holidays.length
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
});

// Test database connection
pool.getConnection()
    .then(connection => {
        console.log('Database connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('Database connection failed:', err);
    });