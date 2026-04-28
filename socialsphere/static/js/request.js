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
    const toast = document.getElementById('toastMessage');
    if (!toast) return;
    
    toast.textContent = message;
    toast.style.backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
    toast.style.display = 'block';
    
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

function handleRequest(requestId, action) {
    if (!requestId) return;
    
    const url = action === 'approve' 
        ? `/approve-request/${requestId}/` 
        : `/reject-request/${requestId}/`;
    
    const requestCard = document.getElementById(`request-${requestId}`);
    const approveBtn = requestCard?.querySelector('.approve-btn');
    const rejectBtn = requestCard?.querySelector('.reject-btn');
    
    if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    if (rejectBtn) {
        rejectBtn.disabled = true;
        rejectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
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
            if (requestCard) {
                requestCard.style.opacity = '0';
                requestCard.style.transform = 'translateX(100px)';
                requestCard.style.transition = 'all 0.3s ease';
                
                setTimeout(() => {
                    requestCard.remove();
                
                    const remainingRequests = document.querySelectorAll('.request-card').length;
                    if (remainingRequests === 0) {
                        const requestsList = document.getElementById('requestsList');
                        if (requestsList) {
                            requestsList.innerHTML = `
                                <div class="empty-state">
                                    <i class="fas fa-inbox"></i>
                                    <h3>No Pending Requests</h3>
                                    <p>When someone requests to follow you, they'll appear here.</p>
                                    <p style="margin-top: 20px;">
                                        <a href="/">← Back to Home</a>
                                    </p>
                                </div>
                            `;
                        }
                    }
                
                    updatePendingCount();
                    updateFollowersCount(action);
                }, 300);
            }
            
            showToast(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`, 'success');
        } else {
            showToast(data.message || 'Something went wrong. Please try again.', 'error');
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.innerHTML = '<i class="fas fa-check"></i> Approve';
            }
            if (rejectBtn) {
                rejectBtn.disabled = false;
                rejectBtn.innerHTML = '<i class="fas fa-times"></i> Reject';
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = '<i class="fas fa-check"></i> Approve';
        }
        if (rejectBtn) {
            rejectBtn.disabled = false;
            rejectBtn.innerHTML = '<i class="fas fa-times"></i> Reject';
        }
    });
}

function updatePendingCount() {
    const pendingCountElement = document.querySelector('.stat-card:nth-child(2) .stat-number');
    if (pendingCountElement) {
        const currentCount = parseInt(pendingCountElement.textContent);
        const newCount = Math.max(0, currentCount - 1);
        pendingCountElement.textContent = newCount;

        pendingCountElement.style.transform = 'scale(1.2)';
        setTimeout(() => {
            pendingCountElement.style.transform = 'scale(1)';
        }, 200);
    }
}


function updateFollowersCount(action) {
    if (action === 'approve') {
        const followersCountElement = document.querySelector('.stat-card:first-child .stat-number');
        if (followersCountElement) {
            const currentCount = parseInt(followersCountElement.textContent);
            const newCount = currentCount + 1;
            followersCountElement.textContent = newCount;
        
            followersCountElement.style.transform = 'scale(1.2)';
            followersCountElement.style.color = '#10b981';
            setTimeout(() => {
                followersCountElement.style.transform = 'scale(1)';
                followersCountElement.style.color = 'white';
            }, 500);
        }
    }
}


function approveAllRequests() {
    const requestCards = document.querySelectorAll('.request-card');
    if (requestCards.length === 0) return;
    
    if (!confirm(`Approve all ${requestCards.length} follow requests?`)) return;
    
    let processed = 0;
    let successCount = 0;
    
    requestCards.forEach(card => {
        const requestId = card.id.replace('request-', '');
        
        fetch(`/approve-request/${requestId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrftoken,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            processed++;
            if (data.success) {
                successCount++;
                card.remove();
            }
            
            if (processed === requestCards.length) {
                showToast(`Approved ${successCount} request${successCount !== 1 ? 's' : ''}`, 'success');
               
                updatePendingCountByAmount(requestCards.length - successCount);
                updateFollowersCountByAmount(successCount);
                
                if (document.querySelectorAll('.request-card').length === 0) {
                    const requestsList = document.getElementById('requestsList');
                    if (requestsList) {
                        requestsList.innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-inbox"></i>
                                <h3>No Pending Requests</h3>
                                <p>When someone requests to follow you, they'll appear here.</p>
                                <p style="margin-top: 20px;">
                                    <a href="/">← Back to Home</a>
                                </p>
                            </div>
                        `;
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error approving request:', error);
            processed++;
            if (processed === requestCards.length) {
                showToast(`Approved ${successCount} of ${requestCards.length} requests`, 'success');
            }
        });
    });
}

function updatePendingCountByAmount(amount) {
    const pendingCountElement = document.querySelector('.stat-card:nth-child(2) .stat-number');
    if (pendingCountElement) {
        const currentCount = parseInt(pendingCountElement.textContent);
        const newCount = Math.max(0, currentCount - amount);
        pendingCountElement.textContent = newCount;
    }
}

function updateFollowersCountByAmount(amount) {
    const followersCountElement = document.querySelector('.stat-card:first-child .stat-number');
    if (followersCountElement) {
        const currentCount = parseInt(followersCountElement.textContent);
        const newCount = currentCount + amount;
        followersCountElement.textContent = newCount;
    }
}


function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


function playNotificationSound() {
    // Optional: Play a subtle sound when new request arrives
    // Requires audio file in static folder
    /*
    const audio = new Audio('/static/sounds/notification.mp3');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio play failed:', e));
    */
}


let pollingInterval = null;
let isPolling = false;

function startPollingForRequests() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(() => {
        if (isPolling) return;
        isPolling = true;
        
        fetch('/api/pending-requests-count/', {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.count !== undefined) {
                const pendingCountElement = document.querySelector('.stat-card:nth-child(2) .stat-number');
                if (pendingCountElement) {
                    const currentCount = parseInt(pendingCountElement.textContent);
                    if (data.count > currentCount) {
                        playNotificationSound();
                        showToast(`${data.count - currentCount} new follow request${data.count - currentCount !== 1 ? 's' : ''}`, 'success');
                        if (data.count > document.querySelectorAll('.request-card').length) {
                            setTimeout(() => location.reload(), 2000);
                        }
                    }
                }
            }
        })
        .catch(error => console.error('Polling error:', error))
        .finally(() => {
            isPolling = false;
        });
    }, 30000); 
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'a' || e.key === 'A') {
            const firstApproveBtn = document.querySelector('.approve-btn');
            if (firstApproveBtn && !firstApproveBtn.disabled) {
                firstApproveBtn.click();
            }
        }
        
        if (e.key === 'r' || e.key === 'R') {
            const firstRejectBtn = document.querySelector('.reject-btn');
            if (firstRejectBtn && !firstRejectBtn.disabled) {
                firstRejectBtn.click();
            }
        }
       
        if (e.key === 'Escape') {
            const toast = document.getElementById('toastMessage');
            if (toast && toast.style.display === 'block') {
                toast.style.display = 'none';
            }
        }
    });
}


let hasChanges = false;

function markChanges() {
    hasChanges = true;
}

window.addEventListener('beforeunload', function(e) {
    if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'You have pending changes. Are you sure you want to leave?';
        return e.returnValue;
    }
});


function initFollowRequestsPage() {
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', scrollToTop);
    }
    
    initKeyboardShortcuts();

    const requestCards = document.querySelectorAll('.request-card');
    requestCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
    });
    
    setInterval(() => {
        const pendingCountElement = document.querySelector('.stat-card:nth-child(2) .stat-number');
        if (pendingCountElement) {
            const visibleCount = document.querySelectorAll('.request-card').length;
            pendingCountElement.textContent = visibleCount;
        }
    }, 5000);
}


document.addEventListener('DOMContentLoaded', function() {
    initFollowRequestsPage();
});


window.handleRequest = handleRequest;
window.approveAllRequests = approveAllRequests;
window.showToast = showToast;
window.scrollToTop = scrollToTop;
window.escapeHtml = escapeHtml;