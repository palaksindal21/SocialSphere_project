function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const csrftoken = getCookie('csrftoken');

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${escapeHtml(message)}`;
    toast.style.display = 'block';
    toast.style.borderLeftColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#ff007f';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}


function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


function togglePrivacy() {
    const checkbox = document.getElementById('privacyToggle');
    if (!checkbox) return;
    
    const isPrivate = checkbox.checked;
    
    fetch('/toggle-privacy/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken,
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_private: isPrivate })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success || data.is_private !== undefined) {
            const newStatus = data.is_private !== undefined ? data.is_private : isPrivate;
            showToast(`Account is now ${newStatus ? 'Private' : 'Public'}`, 'success');
            
            if (data.message) {
                showToast(data.message, 'info');
            }
        } else {
            checkbox.checked = !isPrivate;
            showToast(data.error || 'Error toggling privacy', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        checkbox.checked = !isPrivate;
        showToast('Network error. Please try again.', 'error');
    });
}

function handleRequest(requestId, action) {
    if (!requestId) return;
    
    const url = action === 'approve' 
        ? `/approve-request/${requestId}/` 
        : `/reject-request/${requestId}/`;
    
    const button = action === 'approve' 
        ? document.querySelector(`#request-${requestId} .approve-small`)
        : document.querySelector(`#request-${requestId} .reject-small`);
    
    if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
    }
    
    fetch(url, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken,
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const requestItem = document.getElementById(`request-${requestId}`);
            if (requestItem) {
                requestItem.remove();
                showToast(`Request ${action === 'approve' ? 'approved' : 'rejected'}!`, 'success');
                
                updateBadgeCount();
                
                const remainingRequests = document.querySelectorAll('.request-item').length;
                if (remainingRequests === 0) {
                    const requestContainer = document.querySelector('.setting-card:nth-child(4)');
                    if (requestContainer) {
                        const requestSection = requestContainer.querySelector('div:not(.toggle-item)');
                        if (requestSection && !requestSection.querySelector('.request-item')) {
                            requestSection.innerHTML = '<p style="color: #aaa; text-align: center; padding: 20px;"><i class="fas fa-inbox"></i> No pending follow requests</p>';
                        }
                    }
                }
                
                updateStats();
            }
        } else {
            showToast(data.message || 'Something went wrong', 'error');
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
        if (button) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    });
}


function updateBadgeCount() {
    const badge = document.querySelector('.badge');
    if (badge) {
        const currentCount = parseInt(badge.textContent);
        if (currentCount > 1) {
            badge.textContent = currentCount - 1;
        } else {
            badge.remove();
        }
    }
}


function updateStats() {
    const followersCount = document.querySelector('.stat-card:first-child .stat-number');
    if (followersCount) {
        
        fetch('/api/user-stats/')
            .then(response => response.json())
            .then(data => {
                if (data.followers_count !== undefined) {
                    followersCount.textContent = data.followers_count;
                }
                if (data.following_count !== undefined) {
                    const followingCount = document.querySelector('.stat-card:nth-child(2) .stat-number');
                    if (followingCount) followingCount.textContent = data.following_count;
                }
            })
            .catch(error => console.error('Error updating stats:', error));
    }
}


function initAgeValidation() {
    const birthDateInput = document.getElementById('birthDate');
    if (!birthDateInput) return;
    
    birthDateInput.addEventListener('change', function() {
        const birthDate = this.value;
        if (!birthDate) return;
        
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        if (age < 14) {
            showToast("Minimum age is 14 years", "error");
            this.value = "";
        } else if (age < 20) {
            showToast("Note: Daily usage limit of 4 hours applies for users under 20", "info");
        } else {
            showToast("Birth date updated! Click Save to confirm changes.", "success");
        }
    });
}


function initProfileImagePreview() {
    const imageUpload = document.getElementById('imageUpload');
    const profilePreview = document.getElementById('profilePreview');
    
    if (imageUpload && profilePreview) {
        imageUpload.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                
                if (file.size > 5 * 1024 * 1024) {
                    showToast('Image size should be less than 5MB', 'error');
                    this.value = '';
                    return;
                }
                
                if (!file.type.startsWith('image/')) {
                    showToast('Please select an image file', 'error');
                    this.value = '';
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(loadEvent) {
                    profilePreview.src = loadEvent.target.result;
                    showToast('New profile image selected. Click Save to update.', 'success');
                };
                reader.readAsDataURL(file);
            }
        });
    }
}


function showDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('deleteConfirmInput');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'none';
        const input = document.getElementById('deleteConfirmInput');
        if (input) {
            input.value = '';
        }
    }
}

function confirmDeleteAccount() {
    const input = document.getElementById('deleteConfirmInput');
    if (!input) return;
    
    const confirmation = input.value.trim();
    
    if (confirmation !== 'DELETE') {
        showToast('Type "DELETE" to confirm account deletion', 'error');
        input.value = '';
        input.focus();
        return;
    }
    
    const confirmDelete = confirm('⚠️ FINAL WARNING: This will permanently delete your account and all your data. This cannot be undone. Continue?');
    
    if (!confirmDelete) {
        closeDeleteModal();
        return;
    }
    
    const deleteBtn = document.querySelector('.delete-confirm-btn');
    if (deleteBtn) {
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        deleteBtn.disabled = true;
    }
    
    fetch('/delete-account/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmation: 'DELETE' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Account deleted permanently. Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = '/signup/';
            }, 2000);
        } else {
            showToast(data.error || 'Error deleting account', 'error');
            closeDeleteModal();
            if (deleteBtn) {
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Permanently Delete';
                deleteBtn.disabled = false;
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
        closeDeleteModal();
        if (deleteBtn) {
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Permanently Delete';
            deleteBtn.disabled = false;
        }
    });
}

function initModalCloseOnClickOutside() {
    window.onclick = function(event) {
        const modal = document.getElementById('deleteModal');
        if (event.target === modal) {
            closeDeleteModal();
        }
    };
}


function initDeleteInputEnterKey() {
    const deleteInput = document.getElementById('deleteConfirmInput');
    if (deleteInput) {
        deleteInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                confirmDeleteAccount();
            }
        });
    }
}


let autoSaveTimeout = null;

function autoSaveSettings() {
    const form = document.querySelector('form');
    if (!form) return;
    
    const formData = new FormData(form);
    
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
   
    autoSaveTimeout = setTimeout(() => {
        fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': csrftoken,
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Changes auto-saved', 'success');
            }
        })
        .catch(error => console.error('Auto-save error:', error));
    }, 3000);
}


function initSettingsPage() {
    // Initialize all functions
    initAgeValidation();
    initProfileImagePreview();
    initModalCloseOnClickOutside();
    initDeleteInputEnterKey();
    
    // Optional: Auto-save on input change (uncomment if needed)
    // const formInputs = document.querySelectorAll('form input, form textarea, form select');
    // formInputs.forEach(input => {
    //     input.addEventListener('input', autoSaveSettings);
    // });
}


document.addEventListener('DOMContentLoaded', function() {
    initSettingsPage();
});


window.togglePrivacy = togglePrivacy;
window.handleRequest = handleRequest;
window.showDeleteModal = showDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDeleteAccount = confirmDeleteAccount;
window.showToast = showToast;
window.escapeHtml = escapeHtml;