// ========== CONFIGURATION ==========
const API_BASE_URL = 'http://localhost:3000/api';
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// ========== API SERVICE FUNCTIONS ==========
const apiService = {
    // Set authorization header
    getHeaders: () => {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        return headers;
    },
    
    // Handle API response
    handleResponse: async (response) => {
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
        }
        return response.json();
    },
    
    // Authentication API calls
    auth: {
        register: async (userData) => {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: apiService.getHeaders(),
                body: JSON.stringify(userData)
            });
            return apiService.handleResponse(response);
        },
        
        login: async (credentials) => {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: apiService.getHeaders(),
                body: JSON.stringify(credentials)
            });
            const data = await apiService.handleResponse(response);
            
            if (data.token) {
                authToken = data.token;
                localStorage.setItem('authToken', authToken);
                currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(data.user));
            }
            
            return data;
        },
        
        logout: () => {
            authToken = null;
            currentUser = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        }
    },
    
    // User API calls
    user: {
        getProfile: async () => {
            const response = await fetch(`${API_BASE_URL}/user/profile`, {
                headers: apiService.getHeaders()
            });
            return apiService.handleResponse(response);
        },
        
        updateProfile: async (profileData) => {
            const response = await fetch(`${API_BASE_URL}/user/profile`, {
                method: 'PUT',
                headers: apiService.getHeaders(),
                body: JSON.stringify(profileData)
            });
            return apiService.handleResponse(response);
        }
    },
    
    // Department API calls
    departments: {
        getAll: async () => {
            const response = await fetch(`${API_BASE_URL}/departments`, {
                headers: apiService.getHeaders()
            });
            return apiService.handleResponse(response);
        },
        
        getByCampus: async (campusId) => {
            const response = await fetch(`${API_BASE_URL}/departments/campus/${campusId}`, {
                headers: apiService.getHeaders()
            });
            return apiService.handleResponse(response);
        }
    },
    
    // Leave API calls
    leave: {
        getTypes: async () => {
            const response = await fetch(`${API_BASE_URL}/leave/types`, {
                headers: apiService.getHeaders()
            });
            return apiService.handleResponse(response);
        },
        
        getBalance: async () => {
            const response = await fetch(`${API_BASE_URL}/leave/balance`, {
                headers: apiService.getHeaders()
            });
            return apiService.handleResponse(response);
        },
        
        request: async (leaveData) => {
            const response = await fetch(`${API_BASE_URL}/leave/request`, {
                method: 'POST',
                headers: apiService.getHeaders(),
                body: JSON.stringify(leaveData)
            });
            return apiService.handleResponse(response);
        },
        
        getHistory: async (filters = {}) => {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await fetch(`${API_BASE_URL}/leave/history?${queryParams}`, {
                headers: apiService.getHeaders()
            });
            return apiService.handleResponse(response);
        }
    },
    
    // Campus API calls
    campuses: {
        getAll: async () => {
            const response = await fetch(`${API_BASE_URL}/campuses`, {
                headers: apiService.getHeaders()
            });
            return apiService.handleResponse(response);
        }
    },
    
    // Statistics API calls
    statistics: {
        getSystemStats: async () => {
            const response = await fetch(`${API_BASE_URL}/statistics`, {
                headers: apiService.getHeaders()
            });
            return apiService.handleResponse(response);
        },
        
        getDashboardData: async () => {
            const response = await fetch(`${API_BASE_URL}/dashboard`, {
                headers: apiService.getHeaders()
            });
            return apiService.handleResponse(response);
        }
    }
};

// ========== UPDATED AUTHENTICATION FUNCTIONS ==========
async function initializeAuthPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab') || 'login';
    
    switchTab(tab);
    
    // Add tab switching functionality
    document.querySelectorAll('.tab-btn, .switch-link, .forgot-link').forEach(element => {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = element.dataset.tab;
            if (tabName) switchTab(tabName);
        });
    });
    
    // Password toggle functionality
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    });
    
    // Password strength indicator
    const passwordInput = document.getElementById('signupPassword');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
        });
    }
    
    // Initialize forms
    initializeLoginForm();
    initializeSignupForm();
    initializeForgotForm();
}

async function initializeLoginForm() {
    const form = document.getElementById('loginFormElement');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            showToast('Logging in...', 'info');
            
            const result = await apiService.auth.login({ username, password });
            
            showToast('Login successful!', 'success');
            
            // Redirect based on profile completion
            setTimeout(() => {
                if (result.user.profileComplete) {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'profile.html';
                }
            }, 1500);
            
        } catch (error) {
            showToast(error.message || 'Login failed. Please try again.', 'error');
        }
    });
}

async function initializeSignupForm() {
    const form = document.getElementById('signupFormElement');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const userData = {
            email: document.getElementById('signupEmail').value,
            username: document.getElementById('signupName').value.replace(/\s+/g, '').toLowerCase(),
            password: document.getElementById('signupPassword').value,
            full_name: document.getElementById('signupName').value,
            age: parseInt(document.getElementById('signupAge').value),
            birthday: document.getElementById('signupBirthday').value,
            gender: document.getElementById('signupGender').value,
            location: document.getElementById('signupLocation').value
        };
        
        // Validation
        if (userData.password !== document.getElementById('signupConfirmPassword').value) {
            showToast('Passwords do not match!', 'error');
            return;
        }
        
        if (userData.age < 16) {
            showToast('You must be at least 16 years old to register.', 'error');
            return;
        }
        
        try {
            showToast('Creating account...', 'info');
            
            const result = await apiService.auth.register(userData);
            
            showToast('Account created successfully! Please login.', 'success');
            
            // Auto-login after successful registration
            setTimeout(async () => {
                try {
                    const loginResult = await apiService.auth.login({
                        username: userData.username,
                        password: userData.password
                    });
                    
                    showToast('Auto-login successful! Please complete your profile.', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'profile.html';
                    }, 1500);
                    
                } catch (loginError) {
                    showToast('Please login with your new credentials', 'info');
                    switchTab('login');
                }
            }, 2000);
            
        } catch (error) {
            showToast(error.message || 'Registration failed. Please try again.', 'error');
        }
    });
}

// ========== UPDATED PROFILE FUNCTIONS ==========
async function initializeProfilePage() {
    // Check authentication
    if (!authToken) {
        window.location.href = 'auth.html?tab=login';
        return;
    }
    
    try {
        // Load user profile
        const response = await apiService.user.getProfile();
        const userData = response.user;
        
        // Populate form with existing data
        if (userData.full_name) {
            document.getElementById('signupName')?.value = userData.full_name;
            document.getElementById('reviewName').textContent = userData.full_name;
        }
        
        if (userData.email) {
            document.getElementById('signupEmail')?.value = userData.email;
            document.getElementById('reviewEmail').textContent = userData.email;
        }
        
        if (userData.user_type) {
            document.querySelector(`input[name="userType"][value="${userData.user_type}"]`).checked = true;
            document.getElementById('reviewUserType').textContent = 
                userData.user_type === 'employee' ? 'Employee' : 'Student';
        }
        
        // Load departments for dropdown
        await loadDepartmentsForProfile();
        
        // Initialize form interactions
        initializeProfileFormInteractions();
        
        // Update progress
        updateProgress();
        
    } catch (error) {
        showToast('Failed to load profile data', 'error');
        console.error('Profile load error:', error);
    }
}

async function loadDepartmentsForProfile() {
    try {
        const response = await apiService.departments.getAll();
        const departments = response.departments;
        
        const deptSelect = document.getElementById('profileDepartment');
        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">Select Department</option>';
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.department_id;
                option.textContent = dept.department_name;
                deptSelect.appendChild(option);
            });
        }
        
        // Load campuses
        const campusResponse = await apiService.campuses.getAll();
        const campuses = campusResponse.campuses;
        
        const campusSelect = document.getElementById('profileCampus');
        if (campusSelect) {
            campusSelect.innerHTML = '<option value="">Select Campus</option>';
            campuses.forEach(campus => {
                const option = document.createElement('option');
                option.value = campus.campus_id;
                option.textContent = campus.campus_name;
                campusSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Failed to load departments/campuses:', error);
    }
}

async function submitProfile() {
    try {
        const profileData = {
            focal_person: document.getElementById('profileFocalPerson')?.value || null,
            user_type: document.querySelector('input[name="userType"]:checked')?.value,
            employee_number: document.getElementById('employeeNumber')?.value || null,
            student_number: document.getElementById('employeeNumber')?.value || null, // Using same field
            department_id: document.getElementById('profileDepartment')?.value || null,
            campus_id: document.getElementById('profileCampus')?.value || null,
            position_title: document.getElementById('employeeNumber')?.value ? 'Employee' : 'Student'
        };
        
        showToast('Updating profile...', 'info');
        
        const result = await apiService.user.updateProfile(profileData);
        
        showToast('Profile updated successfully!', 'success');
        
        // Show success modal
        setTimeout(() => {
            const modal = document.getElementById('successModal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
            }
        }, 1000);
        
    } catch (error) {
        showToast(error.message || 'Failed to update profile', 'error');
    }
}

// ========== UPDATED DEPARTMENTS FUNCTIONS ==========
async function initializeDepartmentsPage() {
    try {
        // Load departments from API
        const response = await apiService.departments.getAll();
        departmentsData = response.departments;
        
        renderDepartments(departmentsData);
        
        // Load campuses for filter
        const campusResponse = await apiService.campuses.getAll();
        const campuses = campusResponse.campuses;
        
        populateCampusFilter(campuses);
        
        // Update statistics
        updateDepartmentStats(departmentsData);
        
    } catch (error) {
        showToast('Failed to load departments', 'error');
        console.error('Departments load error:', error);
    }
    
    // Initialize filters
    const campusFilter = document.getElementById('campusFilter');
    const searchInput = document.getElementById('searchDepartment');
    
    if (campusFilter) {
        campusFilter.addEventListener('change', filterDepartments);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', filterDepartments);
    }
}

function populateCampusFilter(campuses) {
    const campusFilter = document.getElementById('campusFilter');
    if (!campusFilter) return;
    
    // Clear existing options except "All Campuses"
    campusFilter.innerHTML = '<option value="all">All Campuses</option>';
    
    campuses.forEach(campus => {
        const option = document.createElement('option');
        option.value = campus.campus_id;
        option.textContent = campus.campus_name;
        campusFilter.appendChild(option);
    });
}

// ========== UPDATED LEAVE MANAGEMENT FUNCTIONS ==========
async function initializeLeavePage() {
    if (!authToken) {
        window.location.href = 'auth.html?tab=login';
        return;
    }
    
    try {
        // Load leave types
        const typesResponse = await apiService.leave.getTypes();
        populateLeaveTypes(typesResponse.types);
        
        // Load leave balance
        const balanceResponse = await apiService.leave.getBalance();
        updateLeaveBalanceUI(balanceResponse);
        
        // Load leave history
        const historyResponse = await apiService.leave.getHistory();
        renderLeaveHistory(historyResponse.history);
        
        // Initialize form
        initializeLeaveForm();
        
        // Initialize calendar
        initializeCalendar();
        
    } catch (error) {
        showToast('Failed to load leave data', 'error');
        console.error('Leave page init error:', error);
    }
}

function populateLeaveTypes(types) {
    const typeSelect = document.getElementById('leaveType');
    if (!typeSelect) return;
    
    typeSelect.innerHTML = '<option value="">Select leave type</option>';
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type.type_id;
        option.textContent = type.type_name;
        option.title = type.description;
        typeSelect.appendChild(option);
    });
}

function updateLeaveBalanceUI(balanceData) {
    // Update summary cards
    document.getElementById('availableLeaves')?.textContent = 
        Math.floor(balanceData.summary?.totalRemaining || 0);
    document.getElementById('usedLeaves')?.textContent = 
        Math.floor(balanceData.summary?.totalUsed || 0);
}

async function submitLeaveRequest(leaveData) {
    try {
        showToast('Submitting leave request...', 'info');
        
        const result = await apiService.leave.request(leaveData);
        
        showToast('Leave request submitted successfully!', 'success');
        
        // Refresh leave data
        await refreshLeaveData();
        
        // Reset form
        document.getElementById('leaveForm')?.reset();
        calculateTotalDays();
        
    } catch (error) {
        showToast(error.message || 'Failed to submit leave request', 'error');
    }
}

async function refreshLeaveData() {
    try {
        // Refresh balance
        const balanceResponse = await apiService.leave.getBalance();
        updateLeaveBalanceUI(balanceResponse);
        
        // Refresh history
        const historyResponse = await apiService.leave.getHistory();
        renderLeaveHistory(historyResponse.history);
        
    } catch (error) {
        console.error('Failed to refresh leave data:', error);
    }
}

// ========== UPDATED DASHBOARD FUNCTIONS ==========
async function initializeDashboard() {
    if (!authToken) {
        window.location.href = 'auth.html?tab=login';
        return;
    }
    
    try {
        const dashboardData = await apiService.statistics.getDashboardData();
        
        // Update UI with dashboard data
        updateDashboardUI(dashboardData);
        
        // Load system statistics
        const statsResponse = await apiService.statistics.getSystemStats();
        updateSystemStats(statsResponse.statistics);
        
    } catch (error) {
        showToast('Failed to load dashboard data', 'error');
        console.error('Dashboard init error:', error);
    }
}

function updateDashboardUI(data) {
    // Update user info
    if (data.user) {
        document.getElementById('userName')?.textContent = data.user.full_name || 'User';
        document.getElementById('userDepartment')?.textContent = data.user.department_name || 'Not assigned';
        document.getElementById('userCampus')?.textContent = data.user.campus_name || 'Not assigned';
        document.getElementById('profileCompletion')?.textContent = 
            `${data.user.profile_completion_percentage || 0}%`;
    }
    
    // Update recent leaves
    if (data.recentLeaves && data.recentLeaves.length > 0) {
        renderRecentLeaves(data.recentLeaves);
    }
    
    // Update notifications
    if (data.notifications && data.notifications.length > 0) {
        renderNotifications(data.notifications);
    }
}

function updateSystemStats(stats) {
    document.getElementById('totalUsers')?.textContent = stats.total_users || '0';
    document.getElementById('totalDepartments')?.textContent = stats.total_departments || '0';
    document.getElementById('totalCampuses')?.textContent = stats.total_campuses || '0';
    document.getElementById('pendingLeavesCount')?.textContent = stats.pending_leaves || '0';
}

// ========== UPDATED NAVIGATION & INITIALIZATION ==========
function initializeNavigation() {
    // Check authentication on page load
    checkAuthentication();
    
    // Mobile menu toggle
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove('active');
        }
    });
    
    // Logout functionality
    document.querySelectorAll('[data-logout]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            apiService.auth.logout();
        });
    });
}

function checkAuthentication() {
    // Load user from localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
    }
    
    // Show/hide auth links based on login status
    const authLinks = document.querySelectorAll('[data-auth]');
    authLinks.forEach(link => {
        if (currentUser) {
            if (link.dataset.auth === 'logged-out') {
                link.style.display = 'none';
            } else if (link.dataset.auth === 'logged-in') {
                link.style.display = 'block';
            }
        } else {
            if (link.dataset.auth === 'logged-out') {
                link.style.display = 'block';
            } else if (link.dataset.auth === 'logged-in') {
                link.style.display = 'none';
            }
        }
    });
    
    // Redirect protected pages
    const protectedPages = ['dashboard.html', 'profile.html', 'leave.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage) && !authToken) {
        window.location.href = 'auth.html?tab=login';
        return false;
    }
    
    return !!authToken;
}

// ========== MAIN INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    // Initialize navigation on all pages
    initializeNavigation();
    
    // Page-specific initialization
    const currentPage = window.location.pathname.split('/').pop();
    
    switch(currentPage) {
        case 'auth.html':
            initializeAuthPage();
            break;
        case 'profile.html':
            initializeProfilePage();
            break;
        case 'departments.html':
            initializeDepartmentsPage();
            break;
        case 'leave.html':
            initializeLeavePage();
            break;
        case 'dashboard.html':
            initializeDashboard();
            break;
        case 'index.html':
            // Initialize homepage features
            initializeHomepage();
            break;
    }
});

async function initializeHomepage() {
    try {
        // Load system statistics
        const statsResponse = await apiService.statistics.getSystemStats();
        updateHomepageStats(statsResponse.statistics);
        
    } catch (error) {
        console.error('Failed to load homepage stats:', error);
        // Fallback to static data
        updateStats();
    }
}

function updateHomepageStats(stats) {
    document.getElementById('userCount')?.textContent = `${stats.total_users || '1,250'}+`;
    document.getElementById('deptCount')?.textContent = stats.total_departments || '24';
    document.getElementById('campusCount')?.textContent = stats.total_campuses || '5';
    document.getElementById('leaveCount')?.textContent = stats.pending_leaves || '89';
}

// Keep all other utility functions from previous script.js
// (showToast, formatDate, calculateDaysBetween, etc.)
// ... [Include all the utility functions from the previous script.js file here]

// ========== KEEP ALL EXISTING UTILITY FUNCTIONS ==========
// Copy all the remaining functions from your previous script.js file here
// including: showToast, formatDate, calculateDaysBetween, initializeProfileFormInteractions,
// initializeLeaveForm, initializeCalendar, and all other supporting functions