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
    
    
    let notificationSocket = null;
    
    function connectNotificationWebSocket() {
        try {
            notificationSocket = new WebSocket(
                'ws://' + window.location.host + '/ws/notifications/'
            );
            
            notificationSocket.onopen = function() {
                console.log(' Notification WebSocket connected');
            };
            
            notificationSocket.onmessage = function(e) {
                const data = JSON.parse(e.data);
                console.log(' Real-time notification:', data);
                
                if (data.type === 'notification') {
                    showToast(data.message, 'info');
                    loadNotifications();
                } else if (data.type === 'badge_update') {
                    updateNotificationBadge(data.unread_count);
                }
            };
            
            notificationSocket.onclose = function() {
                console.log(' Notification WebSocket disconnected. Reconnecting...');
                setTimeout(connectNotificationWebSocket, 3000);
            };
            
            notificationSocket.onerror = function(error) {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('WebSocket connection error:', error);
        }
    }
    
    function updateNotificationBadge(count) {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    function loadNotifications() {
        fetch('/get-notifications/')
            .then(response => response.json())
            .then(data => {
                updateNotificationBadge(data.unread_count);
                
                const container = document.getElementById('notificationList');
                if (container) {
                    if (data.notifications && data.notifications.length > 0) {
                        container.innerHTML = '';
                        data.notifications.forEach(notif => {
                            const timeAgo = getTimeAgo(notif.created_at);
                            container.innerHTML += `
                                <div class="notification-item ${notif.is_read ? '' : 'unread'}" 
                                     data-id="${notif.id}" 
                                     data-type="${notif.type}" 
                                     data-post-id="${notif.related_post_id || ''}"
                                     data-from-user="${notif.from_user || ''}"
                                     onclick="handleNotificationClick(this)">
                                    <div class="notification-content">
                                        <div class="notification-text">${escapeHtml(notif.message)}</div>
                                        <div class="notification-time">${timeAgo}</div>
                                    </div>
                                </div>
                            `;
                        });
                    } else {
                        container.innerHTML = `
                            <div class="empty-notifications">
                                <i class="fas fa-bell-slash"></i>
                                <p>No notifications yet</p>
                                <small>When someone likes, comments, or follows you, you'll see it here</small>
                            </div>
                        `;
                    }
                }
            })
            .catch(error => console.error('Error loading notifications:', error));
    }
    
    function getTimeAgo(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffSeconds = Math.floor((now - date) / 1000);
        
        if (diffSeconds < 60) return 'Just now';
        if (diffSeconds < 3600) return Math.floor(diffSeconds / 60) + 'm ago';
        if (diffSeconds < 86400) return Math.floor(diffSeconds / 3600) + 'h ago';
        return Math.floor(diffSeconds / 86400) + 'd ago';
    }
    
    function handleNotificationClick(element) {
        const notifId = element.getAttribute('data-id');
        const type = element.getAttribute('data-type');
        const postId = element.getAttribute('data-post-id');
        const fromUser = element.getAttribute('data-from-user');
        
        fetch(`/mark-notification-read/${notifId}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrftoken }
        });
        
        if (type === 'like' || type === 'comment' || type === 'share') {
            if (postId) window.location.href = `/view-comments/${postId}/`;
        } else if (type === 'follow') {
            window.location.href = `/profile/${fromUser}/`;
        } else if (type === 'follow_request') {
            window.location.href = `/pending-requests/`;
        } else if (type === 'message') {
            window.location.href = `/chat_list/`;
        }
    }
    
    function markAllNotificationsRead() {
        fetch('/mark-all-notifications-read/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrftoken }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadNotifications();
                showToast('All notifications marked as read', 'success');
            }
        });
    }
    
    
    let currentSharePostId = null;
    let currentSharePostImage = null;
    let currentSharePostCaption = null;
    let currentSharePostUser = null;
    
    function openShareModal(postId, postUser, postImage, postCaption) {
        currentSharePostId = postId;
        currentSharePostImage = postImage;
        currentSharePostCaption = postCaption;
        currentSharePostUser = postUser;
        
        document.getElementById('sharePostImage').src = postImage;
        document.getElementById('sharePostUser').innerHTML = '@' + postUser;
        let shortCaption = postCaption.length > 80 ? postCaption.substring(0, 80) + '...' : postCaption;
        document.getElementById('sharePostCaption').innerHTML = shortCaption;
        
        document.getElementById('shareCaption').value = '';
        document.getElementById('friendSearch').value = '';
        document.getElementById('shareModal').style.display = 'flex';
        
        loadFriendsList();
    }
    
    function closeShareModal() {
        document.getElementById('shareModal').style.display = 'none';
    }
    
    function loadFriendsList() {
        const container = document.getElementById('friendsList');
        container.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading friends...</div>';
        
        fetch('/get-friends-list/')
            .then(response => response.json())
            .then(data => {
                if (data.friends && data.friends.length > 0) {
                    container.innerHTML = '';
                    data.friends.forEach(friend => {
                        container.innerHTML += `
                            <div class="friend-item" data-username="${friend.username}">
                                <div class="friend-info">
                                    <img src="${friend.avatar}" class="friend-avatar" onerror="this.src='/static/images/blankprofile.jpg'">
                                    <div>
                                        <div class="friend-name">${escapeHtml(friend.name || friend.username)}</div>
                                        <div class="friend-username">@${escapeHtml(friend.username)}</div>
                                    </div>
                                </div>
                                <button class="send-btn-chat" onclick="shareToChat('${friend.username}')">
                                    <i class="fas fa-paper-plane"></i> Send
                                </button>
                            </div>
                        `;
                    });
                } else {
                    container.innerHTML = `
                        <div class="no-friends">
                            <i class="fas fa-users" style="font-size: 48px; margin-bottom: 15px;"></i>
                            <p>No friends to share with</p>
                            <small>Follow people to share posts with them</small>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                container.innerHTML = `
                    <div class="no-friends">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px;"></i>
                        <p>Could not load friends</p>
                        <button class="retry-btn" onclick="loadFriendsList()">
                            <i class="fas fa-sync-alt"></i> Retry
                        </button>
                    </div>
                `;
            });
    }
    
    function filterFriends() {
        const searchTerm = document.getElementById('friendSearch').value.toLowerCase();
        const friends = document.querySelectorAll('.friend-item');
        friends.forEach(friend => {
            const username = friend.getAttribute('data-username').toLowerCase();
            if (username.includes(searchTerm)) {
                friend.style.display = 'flex';
            } else {
                friend.style.display = 'none';
            }
        });
    }
    
    function shareToChat(username) {
        const caption = document.getElementById('shareCaption').value;
        
        fetch('/share-post-to-chat/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrftoken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                post_id: currentSharePostId,
                username: username,
                caption: caption
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Post shared to @' + username + '!', 'success');
                closeShareModal();
            } else {
                showToast(data.error || 'Error sharing post', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Network error. Please try again.', 'error');
        });
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    
    function showToast(message, type) {
        let toast = document.getElementById('toastMessage');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toastMessage';
            toast.style.cssText = `position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: white; z-index: 9999; animation: slideIn 0.3s ease;`;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 3000);
    }
    
    
    function toggleNotifications() {
        const dropdown = document.getElementById('notificationDropdown');
        dropdown.classList.toggle('show');
        if (dropdown.classList.contains('show')) {
            loadNotifications();
        }
    }
    
    document.addEventListener('click', function(event) {
        const notificationIcon = document.querySelector('.notification-icon');
        const dropdown = document.getElementById('notificationDropdown');
        const modal = document.getElementById('shareModal');
        
        if (notificationIcon && !notificationIcon.contains(event.target)) {
            if (dropdown) dropdown.classList.remove('show');
        }
        if (modal && event.target === modal) {
            closeShareModal();
        }
    });
    
    function handleRequestFromNotif(requestId, action) {
        const url = action === 'approve' ? `/approve-request/${requestId}/` : `/reject-request/${requestId}/`;
        
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
                const notifItem = document.getElementById(`notif-${requestId}`);
                if (notifItem) notifItem.remove();
                const badge = document.querySelector('.notification-badge');
                if (badge) {
                    const currentCount = parseInt(badge.textContent || 0);
                    if (currentCount > 1) badge.textContent = currentCount - 1;
                    else badge.style.display = 'none';
                }
                showToast(`Request ${action === 'approve' ? 'approved' : 'rejected'}!`, 'success');
            } else {
                showToast(data.message || 'Something went wrong', 'error');
            }
        });
    }
    
    
    function updateTimeDisplay() {
        fetch('/api/remaining-time/')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.has_limit) {
                    const usedElement = document.getElementById('usedTime');
                    if (usedElement) usedElement.innerHTML = data.used_hours > 0 ? `${data.used_hours}h ${data.used_mins}m` : `${data.used_mins}m`;
                    const remainingElement = document.getElementById('remainingTime');
                    if (remainingElement) remainingElement.innerHTML = data.remaining_hours > 0 ? `${data.remaining_hours}h ${data.remaining_mins}m` : `${data.remaining_mins}m`;
                    const progressFill = document.getElementById('progressFill');
                    if (progressFill) progressFill.style.width = `${data.percent_used}%`;
                    const warningDiv = document.getElementById('timeWarning');
                    if (warningDiv) {
                        if (data.remaining_minutes <= 0) {
                            warningDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Daily limit reached! Come back tomorrow.';
                            warningDiv.className = 'time-warning exhausted';
                        } else if (data.remaining_minutes < 30) {
                            warningDiv.innerHTML = '<i class="fas fa-hourglass-end"></i> Less than 30 minutes remaining!';
                            warningDiv.className = 'time-warning low';
                        }
                    }
                }
            });
    }
    
    {% if user_profile.is_minor %}
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 60000);
    {% endif %}
    
    
    document.addEventListener('DOMContentLoaded', function() {
        connectNotificationWebSocket();
        loadNotifications();
        setInterval(loadNotifications, 30000);
    });
    
    document.querySelector('input[type="file"]')?.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            let preview = document.createElement('span');
            preview.style.cssText = 'font-size:12px;color:#ff007f;margin-left:10px;';
            preview.textContent = ' ✓ ' + e.target.files[0].name;
            e.target.parentNode.appendChild(preview);
            setTimeout(() => preview.remove(), 2000);
        }
    });
    
    document.querySelector('.logo')?.addEventListener('click', () => window.scrollTo({top: 0, behavior: 'smooth'}));
    
    document.querySelector('.logout')?.addEventListener('click', function(e) {
        if (!confirm('Are you sure you want to logout?')) e.preventDefault();
    });


    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
    
    const cards = document.querySelectorAll('.card');
    const observerOptions = {
        threshold: 0.3,
        rootMargin: '0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s ease';
        observer.observe(card);
    });
    
    
    document.querySelector('.logo')?.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });