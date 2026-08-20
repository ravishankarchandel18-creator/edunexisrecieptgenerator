/**
 * EDUNEXIS - Authentication Module
 * Handles registration, login, session, password management
 * Login Password and Master Password are completely separate.
 */

const SESSION_KEY = 'edunexis_session';
const REMEMBER_KEY = 'edunexis_remember';

/**
 * Simple hash for client-side password storage (NOT server-grade security)
 * Note: For a real production system, use proper backend hashing.
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'EDUNEXIS_SALT_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Password strength checker
 */
function checkPasswordStrength(password) {
    let score = 0;
    if (!password) return { score: 0, label: 'None', color: '#666' };
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
        { score: 0, label: 'Very Weak', color: '#ff4444' },
        { score: 1, label: 'Weak', color: '#ff8800' },
        { score: 2, label: 'Fair', color: '#ffbb00' },
        { score: 3, label: 'Good', color: '#88cc00' },
        { score: 4, label: 'Strong', color: '#00cc66' },
        { score: 5, label: 'Very Strong', color: '#00ffaa' }
    ];
    return levels[Math.min(score, 5)];
}

/**
 * Register a new user
 */
async function registerUser(formData) {
    const {
        fullName, mobile, email, userId, loginPassword, confirmLoginPassword,
        instituteName, masterPassword, confirmMasterPassword
    } = formData;

    // Validations
    if (!fullName || !mobile || !email || !userId || !loginPassword || !instituteName || !masterPassword) {
        throw new Error('All required fields must be filled.');
    }

    if (loginPassword !== confirmLoginPassword) {
        throw new Error('Login passwords do not match.');
    }

    if (masterPassword !== confirmMasterPassword) {
        throw new Error('Master passwords do not match.');
    }

    if (loginPassword === masterPassword) {
        throw new Error('Login Password and Master Password must be different.');
    }

    if (loginPassword.length < 6) {
        throw new Error('Login Password must be at least 6 characters.');
    }

    if (masterPassword.length < 8) {
        throw new Error('Master Password must be at least 8 characters.');
    }

    // Check uniqueness
    const existing = await window.EDUNEXIS_DB.get(window.EDUNEXIS_DB.STORES.USERS, userId);
    if (existing) {
        throw new Error('User ID already exists. Please choose another.');
    }

    const allUsers = await window.EDUNEXIS_DB.getAll(window.EDUNEXIS_DB.STORES.USERS);
    if (allUsers.some(u => u.email === email)) {
        throw new Error('Email address is already registered.');
    }

    const loginHash = await hashPassword(loginPassword);
    const masterHash = await hashPassword(masterPassword);

    const user = {
        userId,
        fullName,
        mobile,
        email,
        instituteName: instituteName.trim().toUpperCase(),
        loginPasswordHash: loginHash,
        masterPasswordHash: masterHash,
        createdAt: new Date().toISOString(),
        lastLogin: null,
        status: 'ACTIVE',
        failedAttempts: 0,
        settings: {
            requiredFields: ['studentName', 'course'],
            receiptPrefix: 'EDX'
        }
    };

    await window.EDUNEXIS_DB.add(window.EDUNEXIS_DB.STORES.USERS, user);

    // Audit log
    await logAudit(userId, 'ACCOUNT_CREATED', null, `New account created for ${fullName}`);

    return user;
}

/**
 * Login
 */
async function loginUser(userId, password, remember = false) {
    const user = await window.EDUNEXIS_DB.get(window.EDUNEXIS_DB.STORES.USERS, userId);
    if (!user) {
        throw new Error('User ID or password is incorrect.');
    }

    if (user.status !== 'ACTIVE') {
        throw new Error('Account is not active. Contact administrator.');
    }

    const hash = await hashPassword(password);
    if (hash !== user.loginPasswordHash) {
        user.failedAttempts = (user.failedAttempts || 0) + 1;
        await window.EDUNEXIS_DB.put(window.EDUNEXIS_DB.STORES.USERS, user);
        throw new Error('User ID or password is incorrect.');
    }

    // Success
    user.failedAttempts = 0;
    user.lastLogin = new Date().toISOString();
    await window.EDUNEXIS_DB.put(window.EDUNEXIS_DB.STORES.USERS, user);

    const session = {
        userId: user.userId,
        fullName: user.fullName,
        instituteName: user.instituteName,
        email: user.email,
        loginAt: new Date().toISOString()
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (remember) {
        localStorage.setItem(REMEMBER_KEY, userId);
    } else {
        localStorage.removeItem(REMEMBER_KEY);
    }

    await logAudit(userId, 'LOGIN', null, 'User logged in');

    return session;
}

/**
 * Logout
 */
async function logoutUser() {
    const session = getCurrentSession();
    if (session) {
        await logAudit(session.userId, 'LOGOUT', null, 'User logged out');
    }
    sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Get current session
 */
function getCurrentSession() {
    try {
        const data = sessionStorage.getItem(SESSION_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

/**
 * Require authentication - redirect if not logged in
 */
function requireAuth() {
    const session = getCurrentSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

/**
 * Verify Master Password (for delete operations)
 */
async function verifyMasterPassword(userId, masterPassword) {
    const user = await window.EDUNEXIS_DB.get(window.EDUNEXIS_DB.STORES.USERS, userId);
    if (!user) return false;
    const hash = await hashPassword(masterPassword);
    return hash === user.masterPasswordHash;
}

/**
 * Change Login Password
 */
async function changeLoginPassword(userId, currentPassword, newPassword) {
    const user = await window.EDUNEXIS_DB.get(window.EDUNEXIS_DB.STORES.USERS, userId);
    if (!user) throw new Error('User not found.');

    const currentHash = await hashPassword(currentPassword);
    if (currentHash !== user.loginPasswordHash) {
        throw new Error('Current login password is incorrect.');
    }

    if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters.');
    }

    // Ensure different from master
    const newHash = await hashPassword(newPassword);
    if (newHash === user.masterPasswordHash) {
        throw new Error('Login Password and Master Password must be different.');
    }

    user.loginPasswordHash = newHash;
    await window.EDUNEXIS_DB.put(window.EDUNEXIS_DB.STORES.USERS, user);
    await logAudit(userId, 'PASSWORD_CHANGED', null, 'Login password changed');
    return true;
}

/**
 * Change Master Password
 */
async function changeMasterPassword(userId, currentMaster, newMaster, confirmMaster) {
    if (newMaster !== confirmMaster) {
        throw new Error('New master passwords do not match.');
    }
    if (newMaster.length < 8) {
        throw new Error('Master Password must be at least 8 characters.');
    }

    const user = await window.EDUNEXIS_DB.get(window.EDUNEXIS_DB.STORES.USERS, userId);
    if (!user) throw new Error('User not found.');

    const currentHash = await hashPassword(currentMaster);
    if (currentHash !== user.masterPasswordHash) {
        throw new Error('Current Master Password is incorrect.');
    }

    const newHash = await hashPassword(newMaster);
    if (newHash === user.loginPasswordHash) {
        throw new Error('Login Password and Master Password must be different.');
    }

    user.masterPasswordHash = newHash;
    await window.EDUNEXIS_DB.put(window.EDUNEXIS_DB.STORES.USERS, user);
    await logAudit(userId, 'MASTER_PASSWORD_CHANGED', null, 'Master password changed');
    return true;
}

/**
 * Audit logging helper
 */
async function logAudit(userId, action, receiptNo = null, details = '') {
    try {
        const entry = {
            userId,
            action,
            receiptNo,
            details,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('en-IN'),
            time: new Date().toLocaleTimeString('en-IN')
        };
        await window.EDUNEXIS_DB.add(window.EDUNEXIS_DB.STORES.AUDIT, entry);
    } catch (e) {
        console.warn('Audit log failed:', e);
    }
}

/**
 * Get remembered user ID
 */
function getRememberedUserId() {
    return localStorage.getItem(REMEMBER_KEY) || '';
}

// Expose
window.EDUNEXIS_AUTH = {
    register: registerUser,
    login: loginUser,
    logout: logoutUser,
    getSession: getCurrentSession,
    requireAuth,
    verifyMaster: verifyMasterPassword,
    changeLoginPassword,
    changeMasterPassword,
    checkStrength: checkPasswordStrength,
    logAudit,
    getRemembered: getRememberedUserId
};