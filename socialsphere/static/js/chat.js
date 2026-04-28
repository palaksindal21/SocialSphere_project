
let chatSocket = null;
let typingTimeout = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;


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


function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


function formatTimestamp(timestamp) {
    if (!timestamp) {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}


function addMessage(sender, message, timestamp, messageType, sharedPostData) {
    const messagesDiv = document.getElementById('messagesArea');
    if (!messagesDiv) return;

  
    const emptyState = messagesDiv.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const currentUser = document.querySelector('body').getAttribute('data-current-user') || 
                        document.getElementById('messageInput')?.getAttribute('data-current-user') || '';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender === currentUser ? 'sent' : 'received'}`;
    
    const timeDisplay = formatTimestamp(timestamp);
    
    if (messageType === 'post_share' && sharedPostData && sharedPostData.post_id) {
        
        const sharedPostHtml = `
            <div class="shared-post-card" onclick="window.open('/view-post/${sharedPostData.post_id}/', '_blank')">
                <img src="${sharedPostData.image || '/static/images/default-post.jpg'}" 
                     class="shared-post-image" 
                     alt="Shared post"
                     onerror="this.src='/static/images/default-post.jpg'">
                <div class="shared-post-info">
                    <div class="shared-post-header">
                        <i class="fas fa-share-alt"></i> Shared post from @${escapeHtml(sharedPostData.username || 'user')}
                    </div>
                    <div class="shared-post-caption">${escapeHtml((sharedPostData.caption || '').substring(0, 80))}</div>
                </div>
            </div>
            <div class="message-info">${timeDisplay}</div>
        `;
        messageDiv.innerHTML = sharedPostHtml;
    } else {
       
        const messageHtml = `
            <div class="message-bubble">${escapeHtml(message)}</div>
            <div class="message-info">${timeDisplay}</div>
        `;
        messageDiv.innerHTML = messageHtml;
    }
    
    messagesDiv.appendChild(messageDiv);
    
    
    scrollToBottom();
}


function scrollToBottom() {
    const messagesDiv = document.getElementById('messagesArea');
    if (messagesDiv) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}


function sendTypingIndicator() {
    if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
    
    chatSocket.send(JSON.stringify({
        'type': 'typing',
        'is_typing': true
    }));
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.send(JSON.stringify({
                'type': 'typing',
                'is_typing': false
            }));
        }
    }, 1000);
}


function sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (message === '') return;
    
    if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        showToast('Connection lost. Reconnecting...', 'error');
        reconnectWebSocket();
        return;
    }
    
    chatSocket.send(JSON.stringify({
        'type': 'chat',
        'message': message
    }));
    
    input.value = '';
    input.focus();
}


function showToast(message, type = 'info') {
    
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ef4444' : '#6c63ff'};
        color: white;
        padding: 10px 20px;
        border-radius: 30px;
        font-size: 0.85rem;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: fadeInUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


function connectWebSocket() {
    const roomName = document.querySelector('body').getAttribute('data-room-name') || 
                     window.roomName;
    
    if (!roomName) {
        console.error('No room name found');
        return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = `${protocol}${window.location.host}/ws/chat/${roomName}/`;
    
    chatSocket = new WebSocket(wsUrl);
    
    chatSocket.onopen = function(e) {
        console.log('✅ WebSocket connected');
        reconnectAttempts = 0;
  
        const errorDiv = document.querySelector('.connection-error');
        if (errorDiv) errorDiv.remove();
        
        const pendingInput = document.getElementById('messageInput');
        if (pendingInput && pendingInput.value.trim() !== '') {
        }
    };
    
    chatSocket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        
        if (data.type === 'chat') {
            addMessage(
                data.sender,
                data.message,
                data.timestamp,
                data.message_type,
                {
                    post_id: data.shared_post_id,
                    image: data.shared_post_image,
                    caption: data.shared_post_caption,
                    username: data.shared_post_username
                }
            );
        } else if (data.type === 'typing') {
            const typingDiv = document.getElementById('typingIndicator');
            if (typingDiv) {
                if (data.is_typing && data.sender !== getCurrentUser()) {
                    typingDiv.style.display = 'flex';
                } else {
                    typingDiv.style.display = 'none';
                }
            }
        }
    };
    
    chatSocket.onclose = function(e) {
        console.log('❌ WebSocket disconnected');
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(3000 * reconnectAttempts, 15000);
            console.log(`Reconnecting in ${delay/1000}s... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            setTimeout(connectWebSocket, delay);
            showToast(`Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`, 'info');
        } else {
            showToast('Connection failed. Please refresh the page.', 'error');
        }
    };
    
    chatSocket.onerror = function(e) {
        console.error('WebSocket error:', e);
    };
}


function getCurrentUser() {
    const userElement = document.querySelector('.chat-header-name');
    if (userElement) {
        const nameText = userElement.innerText;
        return nameText.replace('@', '').trim();
    }
    return '';
}

function reconnectWebSocket() {
    if (chatSocket && (chatSocket.readyState === WebSocket.OPEN || chatSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }
    connectWebSocket();
}

function initChatRoom() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const currentUser = getCurrentUser();
    document.body.setAttribute('data-current-user', currentUser);
    messageInput.setAttribute('data-current-user', currentUser);
    
    const roomNameElement = document.querySelector('body').getAttribute('data-room-name');
    if (!roomNameElement && window.roomName) {
        document.body.setAttribute('data-room-name', window.roomName);
    }
    
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
    
    messageInput.addEventListener('input', function() {
        sendTypingIndicator();
    });
    
    
    messageInput.focus();
    
    scrollToBottom();
    
    
    connectWebSocket();
}

function loadPeopleToConnect() {
    const container = document.getElementById('peopleList');
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; width: 100%; padding: 20px; color: #888;">
            <i class="fas fa-spinner fa-spin"></i> Loading...
        </div>
    `;
    
    fetch('/get-people-to-connect/')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.users && data.users.length > 0) {
                container.innerHTML = '';
                data.users.forEach(user => {
                    const avatarUrl = user.avatar || '/static/images/blankprofile.jpg';
                    container.innerHTML += `
                        <div class="person-card" data-username="${escapeHtml(user.username)}">
                            <img src="${escapeHtml(avatarUrl)}" 
                                 class="person-avatar" 
                                 alt="${escapeHtml(user.username)}"
                                 onerror="this.src='/static/images/blankprofile.jpg'">
                            <div class="person-username">@${escapeHtml(user.username)}</div>
                            <div class="person-bio">${escapeHtml((user.bio || '').substring(0, 30))}</div>
                            <button class="message-btn" onclick="event.stopPropagation(); startChat('${escapeHtml(user.username)}')">
                                <i class="fas fa-comment"></i> Message
                            </button>
                        </div>
                    `;
                });
                
                
                document.querySelectorAll('.person-card').forEach(card => {
                    card.addEventListener('click', function() {
                        const username = this.getAttribute('data-username');
                        if (username) startChat(username);
                    });
                });
            } else {
                container.innerHTML = `
                    <div style="text-align: center; width: 100%; padding: 30px; color: #888;">
                        <i class="fas fa-users" style="font-size: 36px; margin-bottom: 10px;"></i>
                        <p>No suggestions available</p>
                        <small>Follow more people to connect</small>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading people:', error);
            container.innerHTML = `
                <div style="text-align: center; width: 100%; padding: 30px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 36px; margin-bottom: 10px;"></i>
                    <p>Error loading suggestions</p>
                    <small>${escapeHtml(error.message)}</small>
                </div>
            `;
        });
}


function startChat(username) {
    if (!username) return;
    
    
    const buttons = document.querySelectorAll(`.message-btn, button[onclick*="startChat('${username}')"]`);
    buttons.forEach(btn => {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        btn.disabled = true;
    });
    
    fetch('/get-or-create-chat/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.location.href = `/chat/${encodeURIComponent(username)}/`;
        } else {
            showToast(data.error || 'Cannot start chat', 'error');
            
            buttons.forEach(btn => {
                btn.innerHTML = '<i class="fas fa-comment"></i> Message';
                btn.disabled = false;
            });
        }
    })
    .catch(error => {
        console.error('Error starting chat:', error);
        showToast('Network error. Please try again.', 'error');
        buttons.forEach(btn => {
            btn.innerHTML = '<i class="fas fa-comment"></i> Message';
            btn.disabled = false;
        });
    });
}


function refreshPeopleList() {
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        const originalHtml = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        refreshBtn.disabled = true;
        
        loadPeopleToConnect().finally(() => {
            refreshBtn.innerHTML = originalHtml;
            refreshBtn.disabled = false;
        });
    } else {
        loadPeopleToConnect();
    }
}


function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}


function initChatList() {
    
    loadPeopleToConnect();
    
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshPeopleList);
    }
    
   
    document.querySelectorAll('.chat-time').forEach(el => {
        const timeText = el.innerText;
        
    });
}

function addAnimationStyles() {
    if (document.getElementById('chat-animation-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'chat-animation-styles';
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .toast-notification {
            animation: fadeInUp 0.3s ease;
        }
        .fa-spinner {
            animation: spin 1s linear infinite;
        }
    `;
    document.head.appendChild(style);
}


document.addEventListener('DOMContentLoaded', function() {
    addAnimationStyles();
    
    
    const messagesArea = document.getElementById('messagesArea');
    const peopleList = document.getElementById('peopleList');
    const chatList = document.querySelector('.chat-list');
    
    if (messagesArea) {
        
        initChatRoom();
    } else if (peopleList || chatList) {
      
        initChatList();
    }
});


window.sendMessage = sendMessage;
window.startChat = startChat;
window.loadPeopleToConnect = loadPeopleToConnect;
window.refreshPeopleList = refreshPeopleList;
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.formatTimestamp = formatTimestamp;
window.formatRelativeTime = formatRelativeTime;
window.getCookie = getCookie;