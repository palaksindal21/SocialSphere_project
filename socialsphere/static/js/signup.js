// =============== SIGNUP PAGE JAVASCRIPT ===============

// Toggle password visibility
function togglePassword(id) {
    let input = document.getElementById(id);
    let icon = event.target;
    
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    }
}

// Refresh CAPTCHA using server-side endpoint
function refreshCaptcha() {
    const captchaImage = document.getElementById('captchaImage');
    const captchaHashkey = document.getElementById('captchaHashkey');
    const captchaInput = document.getElementById('captchaInput');
    
    if (!captchaImage || !captchaHashkey || !captchaInput) return;
    
    // Show loading state on image
    captchaImage.style.opacity = '0.5';
    
    fetch('/captcha/refresh/')
        .then(response => response.json())
        .then(data => {
            // Update CAPTCHA image and hashkey
            captchaImage.src = data.image_url;
            captchaHashkey.value = data.key;
            captchaInput.value = ''; // Clear the input field
            captchaImage.style.opacity = '1';
        })
        .catch(error => {
            console.error('Error refreshing CAPTCHA:', error);
            captchaImage.style.opacity = '1';
            // Fallback: reload the page to get new CAPTCHA
            location.reload();
        });
}

// Calculate age from birth date
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    
    if (isNaN(birth.getTime())) return null;
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const dayDiff = today.getDate() - birth.getDate();
    
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
    }
    
    return age;
}

// Validate age on client side
function validateAge() {
    const birthDateInput = document.getElementById('birth_date');
    const ageErrorDiv = document.getElementById('ageError');
    
    if (!birthDateInput || !ageErrorDiv) return false;
    
    if (!birthDateInput.value) {
        ageErrorDiv.textContent = '';
        ageErrorDiv.className = 'age-error';
        return false;
    }
    
    const age = calculateAge(birthDateInput.value);
    const MIN_AGE = 18;
    
    if (age === null) {
        ageErrorDiv.textContent = ' Invalid date format';
        ageErrorDiv.className = 'age-error';
        return false;
    }
    
    if (age < MIN_AGE) {
        ageErrorDiv.textContent = ` You must be at least ${MIN_AGE} years old to register. Your age: ${age}`;
        ageErrorDiv.className = 'age-error';
        return false;
    } else {
        ageErrorDiv.textContent = `✅ Age verified: ${age} years old`;
        ageErrorDiv.className = 'age-success';
        return true;
    }
}

// Set date input restrictions
function setDateRestrictions() {
    const birthDateInput = document.getElementById('birth_date');
    if (!birthDateInput) return;
    
    const today = new Date();
    
    // Set max date to 18 years ago (user must be at least 18)
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    const maxDateString = maxDate.toISOString().split('T')[0];
    birthDateInput.setAttribute('max', maxDateString);
    
    // Set min date to 100 years ago (optional)
    const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
    const minDateString = minDate.toISOString().split('T')[0];
    birthDateInput.setAttribute('min', minDateString);
}

// Validate password strength
function validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < minLength) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!hasUpperCase) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!hasLowerCase) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!hasNumbers) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    
    return { valid: true, message: 'Password is strong' };
}

// Real-time password strength indicator (optional)
function addPasswordStrengthIndicator() {
    const passwordInput = document.getElementById('password');
    if (!passwordInput) return;
    
    // Create strength indicator element
    const strengthDiv = document.createElement('div');
    strengthDiv.className = 'password-strength';
    strengthDiv.style.cssText = 'font-size: 12px; margin-top: -15px; margin-bottom: 15px; padding-left: 10px;';
    passwordInput.parentNode.insertAdjacentElement('afterend', strengthDiv);
    
    passwordInput.addEventListener('input', function() {
        const result = validatePasswordStrength(this.value);
        if (this.value.length === 0) {
            strengthDiv.textContent = '';
            strengthDiv.style.color = '';
        } else if (result.valid) {
            strengthDiv.textContent = '✓ ' + result.message;
            strengthDiv.style.color = '#10b981';
        } else {
            strengthDiv.textContent = '⚠ ' + result.message;
            strengthDiv.style.color = '#f59e0b';
        }
    });
}

// Form validation on submit
function setupFormValidation() {
    const form = document.querySelector('form');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        // Validate age
        if (!validateAge()) {
            e.preventDefault();
            alert('You must be at least 18 years old to register.');
            const birthDateInput = document.getElementById('birth_date');
            if (birthDateInput) birthDateInput.focus();
            return false;
        }
        
        // Validate password match
        const password = document.getElementById('password');
        const password2 = document.getElementById('password2');
        
        if (!password || !password2) return true;
        
        if (password.value !== password2.value) {
            e.preventDefault();
            alert('Passwords do not match!');
            password2.focus();
            return false;
        }
        
        // Validate password strength
        const passwordStrength = validatePasswordStrength(password.value);
        if (!passwordStrength.valid) {
            e.preventDefault();
            alert(passwordStrength.message);
            password.focus();
            return false;
        }
        
        // Validate CAPTCHA is not empty
        const captchaInput = document.getElementById('captchaInput');
        if (captchaInput && !captchaInput.value.trim()) {
            e.preventDefault();
            alert('Please enter the CAPTCHA code');
            captchaInput.focus();
            return false;
        }
        
        return true;
    });
}

// Auto-refresh CAPTCHA timer (5 minutes)
let captchaTimeout;
function resetCaptchaTimer() {
    if (captchaTimeout) clearTimeout(captchaTimeout);
    captchaTimeout = setTimeout(() => {
        refreshCaptcha();
        showTemporaryMessage('CAPTCHA expired. New one generated.', 'info');
    }, 300000); // 5 minutes
}

// Show temporary message
function showTemporaryMessage(message, type) {
    // Check if message container exists, if not create one
    let msgContainer = document.getElementById('tempMessage');
    if (!msgContainer) {
        msgContainer = document.createElement('div');
        msgContainer.id = 'tempMessage';
        msgContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 12px 20px; border-radius: 8px; color: white; animation: slideIn 0.3s ease;';
        document.body.appendChild(msgContainer);
    }
    
    // Set style based on type
    if (type === 'info') {
        msgContainer.style.backgroundColor = '#3b82f6';
    } else if (type === 'success') {
        msgContainer.style.backgroundColor = '#10b981';
    } else {
        msgContainer.style.backgroundColor = '#ef4444';
    }
    
    msgContainer.textContent = message;
    msgContainer.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        msgContainer.style.display = 'none';
    }, 3000);
}

// Initialize all functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set date restrictions
    setDateRestrictions();
    
    // Setup form validation
    setupFormValidation();
    
    // Setup age validation with real-time checking
    const birthDateInput = document.getElementById('birth_date');
    if (birthDateInput) {
        birthDateInput.addEventListener('change', validateAge);
        birthDateInput.addEventListener('input', validateAge);
    }
    
    // Add password strength indicator
    addPasswordStrengthIndicator();
    
    // Setup CAPTCHA refresh timer
    const captchaInput = document.getElementById('captchaInput');
    const captchaImage = document.getElementById('captchaImage');
    
    if (captchaInput) {
        captchaInput.addEventListener('focus', resetCaptchaTimer);
        resetCaptchaTimer();
    }
    
    if (captchaImage) {
        captchaImage.addEventListener('click', function() {
            refreshCaptcha();
            resetCaptchaTimer();
        });
    }
    
    // Auto-focus on first input
    const firstInput = document.querySelector('.input-group input');
    if (firstInput && !firstInput.value) {
        firstInput.focus();
    }
    
    // Optional: Load any existing birth_date value (for form errors)
    if (birthDateInput && birthDateInput.value) {
        validateAge();
    }
});

// Make functions globally available
window.togglePassword = togglePassword;
window.refreshCaptcha = refreshCaptcha;