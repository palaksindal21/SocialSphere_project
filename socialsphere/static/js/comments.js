
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

function showToast(message, type = 'success') {
    
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 10px 20px;
        border-radius: 30px;
        font-size: 14px;
        z-index: 10000;
        animation: fadeInUp 0.3s ease;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${escapeHtml(message)}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}


function toggleReplyForm(commentId) {
    const form = document.getElementById(`replyForm-${commentId}`);
    if (form) {
        form.classList.toggle('hidden');
        
        if (!form.classList.contains('hidden')) {
            const input = form.querySelector('.reply-input');
            if (input) input.focus();
        }
    }
}

function submitReply(commentId, event) {
    event.preventDefault();
    
    const form = document.getElementById(`replyForm-${commentId}`);
    const input = form.querySelector('.reply-input');
    const replyText = input.value.trim();
    
    if (replyText === '') {
        showToast('Please enter a reply', 'error');
        return;
    }
    
    const csrfToken = getCookie('csrftoken');
    const submitBtn = form.querySelector('.reply-submit');
    const originalBtnText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;
    
    fetch(`/api/add-reply/${commentId}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ reply_text: replyText })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            input.value = '';
            form.classList.add('hidden');
            
            addReplyToDOM(commentId, data.reply);
            showToast('Reply added successfully', 'success');
        } else {
            showToast(data.error || 'Failed to add reply', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
    })
    .finally(() => {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    });
}

function addReplyToDOM(commentId, replyData) {
    const commentCard = document.getElementById(`comment-${commentId}`);
    if (!commentCard) return;
    
    let repliesSection = commentCard.querySelector('.replies-section');
    
    if (!repliesSection) {
        repliesSection = document.createElement('div');
        repliesSection.className = 'replies-section';
        commentCard.appendChild(repliesSection);
    }
    
    const replyHtml = `
        <div class="reply-card" id="reply-${replyData.id}">
            <div class="reply-header">
                <span class="reply-user">@${escapeHtml(replyData.user)}</span>
                ${replyData.can_delete ? `<a href="javascript:void(0)" onclick="deleteReply(${replyData.id}, ${commentId})" class="reply-delete"><i class="fas fa-trash"></i></a>` : ''}
            </div>
            <div class="reply-text">${escapeHtml(replyData.text)}</div>
            <div class="comment-time" style="margin-top: 4px;">Just now</div>
        </div>
    `;
    
    repliesSection.insertAdjacentHTML('beforeend', replyHtml);
}

function deleteReply(replyId, commentId) {
    if (!confirm('Delete this reply?')) return;
    
    const csrfToken = getCookie('csrftoken');
    
    fetch(`/api/delete-reply/${replyId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': csrfToken
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            
            const replyElement = document.getElementById(`reply-${replyId}`);
            if (replyElement) replyElement.remove();
            showToast('Reply deleted', 'success');
        } else {
            showToast(data.error || 'Failed to delete reply', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
    });
}


function addComment(event) {
    event.preventDefault();
    
    const form = event.target;
    const input = form.querySelector('.comment-input');
    const commentText = input.value.trim();
    
    if (commentText === '') {
        showToast('Please enter a comment', 'error');
        return;
    }
    
    const postId = window.currentPostId || document.querySelector('input[name="post_id"]')?.value;
    const csrfToken = getCookie('csrftoken');
    const submitBtn = form.querySelector('.post-comment-btn');
    const originalBtnText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    submitBtn.disabled = true;
    
    fetch(`/api/add-comment/${postId}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ comment_text: commentText })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            input.value = '';

            addCommentToDOM(data.comment);
            updateCommentCount();
            showToast('Comment added successfully', 'success');
        } else {
            showToast(data.error || 'Failed to add comment', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
    })
    .finally(() => {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    });
}

function addCommentToDOM(commentData) {
    const commentsSection = document.querySelector('.comments-section');
    const commentsContainer = document.querySelector('.comments-section .comments-container') || commentsSection;

    const emptyState = commentsSection.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    let commentsList = commentsSection.querySelector('.comments-list');
    if (!commentsList) {
        commentsList = document.createElement('div');
        commentsList.className = 'comments-list';
        
        const header = commentsSection.querySelector('.comments-header');
        if (header) {
            header.insertAdjacentElement('afterend', commentsList);
        } else {
            commentsSection.appendChild(commentsList);
        }
    }
    
    const canEdit = commentData.user === window.currentUserId;
    
    const commentHtml = `
        <div class="comment-card" id="comment-${commentData.id}">
            <div class="comment-header">
                <div class="comment-user-info">
                    <img src="${commentData.avatar || '/static/images/blankprofile.jpg'}" class="comment-user-avatar" alt="${escapeHtml(commentData.user)}">
                    <div>
                        <span class="comment-user">@${escapeHtml(commentData.user)}</span>
                        <span class="comment-time">Just now</span>
                    </div>
                </div>
                <div class="comment-actions">
                    ${canEdit ? `<a href="/edit-comment/${commentData.id}/" class="edit-link"><i class="fas fa-edit"></i> Edit</a>` : ''}
                    ${canEdit ? `<a href="javascript:void(0)" onclick="deleteComment(${commentData.id})" class="delete-link"><i class="fas fa-trash"></i> Delete</a>` : ''}
                </div>
            </div>
            <div class="comment-text">${escapeHtml(commentData.text)}</div>
            <button onclick="toggleReplyForm(${commentData.id})" class="reply-btn">
                <i class="fas fa-reply"></i> Reply
            </button>
            <form method="POST" action="/add-reply/${commentData.id}/" id="replyForm-${commentData.id}" class="reply-form hidden" onsubmit="event.preventDefault(); submitReply(${commentData.id}, event)">
                <input type="text" name="reply_text" class="reply-input" placeholder="Write a reply..." autocomplete="off">
                <button type="submit" class="reply-submit"><i class="fas fa-paper-plane"></i> Reply</button>
            </form>
            <div class="replies-section"></div>
        </div>
    `;
    
    commentsList.insertAdjacentHTML('afterbegin', commentHtml);
    
    const newComment = document.getElementById(`comment-${commentData.id}`);
    if (newComment) {
        newComment.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function deleteComment(commentId) {
    if (!confirm('Delete this comment?')) return;
    
    const csrfToken = getCookie('csrftoken');
    
    fetch(`/api/delete-comment/${commentId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': csrfToken
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {

            const commentElement = document.getElementById(`comment-${commentId}`);
            if (commentElement) commentElement.remove();
            updateCommentCount();
            showToast('Comment deleted', 'success');
            
            const remainingComments = document.querySelectorAll('.comment-card');
            if (remainingComments.length === 0) {
                const commentsSection = document.querySelector('.comments-section');
                const commentsList = commentsSection.querySelector('.comments-list');
                if (commentsList) commentsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-comment-slash"></i>
                        <p>No comments yet</p>
                        <small>Be the first to comment on this post!</small>
                    </div>
                `;
            }
        } else {
            showToast(data.error || 'Failed to delete comment', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
    });
}


function updateCommentCount() {
    const countSpan = document.querySelector('.comments-header span');
    const commentCount = document.querySelectorAll('.comment-card').length;
    if (countSpan) {
        countSpan.textContent = commentCount;
    }
}

function initCharCounter() {
    const textarea = document.querySelector('.comment-input');
    const charCountSpan = document.getElementById('charCount');
    
    if (textarea && charCountSpan) {
        charCountSpan.textContent = textarea.value.length;
        
        textarea.addEventListener('input', function() {
            charCountSpan.textContent = this.value.length;
            
            if (this.value.length > 750) {
                charCountSpan.style.color = '#f59e0b';
            } else if (this.value.length > 780) {
                charCountSpan.style.color = '#ef4444';
            } else {
                charCountSpan.style.color = '#666';
            }
        });
    }
}

function autoResizeTextarea() {
    const textarea = document.querySelector('.comment-input');
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        });
    }
}

function initLeaveConfirmation() {
    const form = document.querySelector('form');
    const textarea = document.querySelector('.comment-input');
    let originalValue = '';
    
    if (form && textarea) {
        originalValue = textarea.value;
        
        window.addEventListener('beforeunload', function(e) {
            if (textarea.value !== originalValue) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
        
        form.addEventListener('submit', function() {
            window.removeEventListener('beforeunload', () => {});
        });
    }
}


function initCommentPage() {
    const postElement = document.querySelector('.post-preview');
    if (postElement) {
        const postLink = postElement.querySelector('.post-user')?.getAttribute('data-post-id');
        const urlParts = window.location.pathname.split('/');
        const postIdIndex = urlParts.indexOf('comments') + 1;
        if (postIdIndex > 0 && urlParts[postIdIndex]) {
            window.currentPostId = urlParts[postIdIndex];
        }
    }
    
    const userAvatar = document.querySelector('.comment-avatar