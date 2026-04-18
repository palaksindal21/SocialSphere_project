// =============== LOGIN PAGE JAVASCRIPT ===============

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

// Form validation on submit
function setupFormValidation() {
    const form = document.querySelector('form');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        // Validate username is not empty
        const username = document.getElementById('username');
        if (username && !username.value.trim()) {
            e.preventDefault();
            alert('Please enter your username');
            username.focus();
            return false;
        }
        
        // Validate password is not empty
        const password = document.getElementById('password');
        if (password && !password.value) {
            e.preventDefault();
            alert('Please enter your password');
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

// Remember Me functionality
function setupRememberMe() {
    const rememberCheckbox = document.querySelector('input[name="remember_me"]');
    const usernameInput = document.getElementById('username');
    
    if (!rememberCheckbox || !usernameInput) return;
    
    // Check if there's a saved username
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
        usernameInput.value = savedUsername;
        rememberCheckbox.checked = true;
    }
    
    // Save username when form is submitted
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function() {
            if (rememberCheckbox.checked) {
                localStorage.setItem('rememberedUsername', usernameInput.value);
            } else {
                localStorage.removeItem('rememberedUsername');
            }
        });
    }
}

// Clear form fields on specific conditions
function clearPasswordOnError() {
    // Check if there's an error message
    const errorMessage = document.querySelector('.error-message');
    if (errorMessage && errorMessage.style.display !== 'none') {
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.value = ''; // Clear password field on error
        }
    }
}

// Initialize all functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Setup form validation
    setupFormValidation();
    
    // Setup Remember Me functionality
    setupRememberMe();
    
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
    
    // Clear password field if there's an error
    clearPasswordOnError();
    
    // Auto-focus on username input
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.focus();
    }
    
    // Add enter key support for CAPTCHA
    if (captchaInput) {
        captchaInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const form = document.querySelector('form');
                if (form) form.submit();
            }
        });
    }
});

// Make functions globally available
window.togglePassword = togglePassword;
window.refreshCaptcha = refreshCaptcha;