
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

function refreshCaptcha() {
    const captchaImage = document.getElementById('captchaImage');
    const captchaHashkey = document.getElementById('captchaHashkey');
    const captchaInput = document.getElementById('captchaInput');
    
    if (!captchaImage || !captchaHashkey || !captchaInput) return;
    
    captchaImage.style.opacity = '0.5';
    
    fetch('/captcha/refresh/')
        .then(response => response.json())
        .then(data => {
            
            captchaImage.src = data.image_url;
            captchaHashkey.value = data.key;
            captchaInput.value = ''; 
            captchaImage.style.opacity = '1';
        })
        .catch(error => {
            console.error('Error refreshing CAPTCHA:', error);
            captchaImage.style.opacity = '1';
            location.reload();
        });
}


function setupFormValidation() {
    const form = document.querySelector('form');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
    
        const username = document.getElementById('username');
        if (username && !username.value.trim()) {
            e.preventDefault();
            alert('Please enter your username');
            username.focus();
            return false;
        }
        
        
        const password = document.getElementById('password');
        if (password && !password.value) {
            e.preventDefault();
            alert('Please enter your password');
            password.focus();
            return false;
        }
        
        
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


let captchaTimeout;
function resetCaptchaTimer() {
    if (captchaTimeout) clearTimeout(captchaTimeout);
    captchaTimeout = setTimeout(() => {
        refreshCaptcha();
        showTemporaryMessage('CAPTCHA expired. New one generated.', 'info');
    }, 300000); 
}


function showTemporaryMessage(message, type) {
    
    let msgContainer = document.getElementById('tempMessage');
    if (!msgContainer) {
        msgContainer = document.createElement('div');
        msgContainer.id = 'tempMessage';
        msgContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 12px 20px; border-radius: 8px; color: white; animation: slideIn 0.3s ease;';
        document.body.appendChild(msgContainer);
    }
    
    
    if (type === 'info') {
        msgContainer.style.backgroundColor = '#3b82f6';
    } else if (type === 'success') {
        msgContainer.style.backgroundColor = '#10b981';
    } else {
        msgContainer.style.backgroundColor = '#ef4444';
    }
    
    msgContainer.textContent = message;
    msgContainer.style.display = 'block';
    
    setTimeout(() => {
        msgContainer.style.display = 'none';
    }, 3000);
}

function setupRememberMe() {
    const rememberCheckbox = document.querySelector('input[name="remember_me"]');
    const usernameInput = document.getElementById('username');
    
    if (!rememberCheckbox || !usernameInput) return;
    
    
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
        usernameInput.value = savedUsername;
        rememberCheckbox.checked = true;
    }
    
    
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

function clearPasswordOnError() {
    
    const errorMessage = document.querySelector('.error-message');
    if (errorMessage && errorMessage.style.display !== 'none') {
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.value = ''; 
        }
    }
}


document.addEventListener('DOMContentLoaded', function() {

    setupFormValidation();
    
    setupRememberMe();
    
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
    

    clearPasswordOnError();
    
  
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.focus();
    }
    
    if (captchaInput) {
        captchaInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const form = document.querySelector('form');
                if (form) form.submit();
            }
        });
    }
});


window.togglePassword = togglePassword;
window.refreshCaptcha = refreshCaptcha;