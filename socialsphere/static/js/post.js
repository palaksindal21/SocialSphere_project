let currentPostId = null;

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


function showToast(message, isSuccess = true) {
    let toast = document.getElementById('toast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.borderLeftColor = isSuccess ? '#ff007f' : '#ef4444';
    toast.className = 'toast show';
    
    setTimeout(function() {
        toast.className = toast.className.replace('show', '');
    }, 3000);
}


function openImageModal(imageUrl) {
    let modal = document.getElementById('imageModal');
    let modalImg = document.getElementById('modalImage');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.className = 'modal';
        modal.onclick = closeModal;
        modal.innerHTML = '<span class="close-modal">&times;</span><img class="modal-content" id="modalImage">';
        document.body.appendChild(modal);
    }
    
    modalImg = document.getElementById('modalImage');
    modal.style.display = 'block';
    modalImg.src = imageUrl;
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

function addComment(postId) {
    const commentInput = document.getElementById('commentInput');
    const commentText = commentInput.value.trim();
    
    if (commentText === '') {
        showToast('Please enter a comment', false);
        return;
    }
    
    const submitBtn = document.querySelector('.comment-input-wrapper button');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    submitBtn.disabled = true;
    
    fetch(`/add-comment/${postId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `comment_text=${encodeURIComponent(commentText)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            commentInput.value = '';
            addCommentToDOM(data.comment);
            updateCommentCount();
            showToast('Comment added successfully', true);
        } else {
            showToast(data.error || 'Failed to add comment', false);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', false);
    })
    .finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

function addCommentToDOM(commentData) {
    const commentList = document.getElementById('commentList');
    const emptyDiv = commentList.querySelector('div[style*="text-align: center"]');
    
    if (emptyDiv) emptyDiv.remove();
    
    const commentHtml = `
        <div class="comment-item" id="comment-${commentData.id}">
            <div class="comment-user">@${escapeHtml(commentData.user)}</div>
            <div class="comment-text">${escapeHtml(commentData.text)}</div>
            <div class="comment-time">Just now</div>
            <div class="comment-actions">
                <button onclick="editComment(${commentData.id})" class="comment-edit-btn"><i class="fas fa-edit"></i> Edit</button>
                <button onclick="deleteComment(${commentData.id})" class="comment-delete-btn"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `;
    
    commentList.insertAdjacentHTML('afterbegin', commentHtml);
}

function updateCommentCount() {
    const commentCountSpan = document.querySelector('.action-btn:last-child');
    const commentCount = document.querySelectorAll('.comment-item').length;
    
    if (commentCountSpan) {
        commentCountSpan.innerHTML = `💬 ${commentCount}`;
    }
}

function deleteComment(commentId) {
    if (!confirm('Delete this comment?')) return;
    
    fetch(`/delete-comment/${commentId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': csrftoken,
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const commentElement = document.getElementById(`comment-${commentId}`);
            if (commentElement) {
                commentElement.remove();
                updateCommentCount();
                showToast('Comment deleted', true);
                
                if (document.querySelectorAll('.comment-item').length === 0) {
                    const commentList = document.getElementById('commentList');
                    commentList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No comments yet. Be the first to comment!</div>';
                }
            }
        } else {
            showToast(data.error || 'Failed to delete comment', false);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', false);
    });
}

function editComment(commentId) {
    const commentElement = document.getElementById(`comment-${commentId}`);
    const commentTextDiv = commentElement.querySelector('.comment-text');
    const originalText = commentTextDiv.innerText;
    
    const editForm = document.createElement('div');
    editForm.className = 'comment-edit-form';
    editForm.innerHTML = `
        <input type="text" class="comment-edit-input" value="${escapeHtml(originalText)}">
        <button onclick="saveCommentEdit(${commentId})" class="comment-save-btn"><i class="fas fa-save"></i> Save</button>
        <button onclick="cancelCommentEdit(${commentId}, '${escapeHtml(originalText)}')" class="comment-cancel-btn"><i class="fas fa-times"></i> Cancel</button>
    `;
    
    commentTextDiv.style.display = 'none';
    commentTextDiv.insertAdjacentElement('afterend', editForm);
}

function saveCommentEdit(commentId) {
    const editForm = document.querySelector(`#comment-${commentId} .comment-edit-form`);
    const newText = editForm.querySelector('.comment-edit-input').value.trim();
    
    if (newText === '') {
        showToast('Comment cannot be empty', false);
        return;
    }
    
    fetch(`/edit-comment/${commentId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment_text: newText })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const commentElement = document.getElementById(`comment-${commentId}`);
            const commentTextDiv = commentElement.querySelector('.comment-text');
            commentTextDiv.innerText = newText;
            commentTextDiv.style.display = 'block';
            editForm.remove();
            showToast('Comment updated', true);
        } else {
            showToast(data.error || 'Failed to update comment', false);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', false);
    });
}

function cancelCommentEdit(commentId, originalText) {
    const commentElement = document.getElementById(`comment-${commentId}`);
    const commentTextDiv = commentElement.querySelector('.comment-text');
    const editForm = commentElement.querySelector('.comment-edit-form');
    
    commentTextDiv.innerText = originalText;
    commentTextDiv.style.display = 'block';
    editForm.remove();
}

function likePost(postId) {
    const likeBtn = document.querySelector('.action-btn:first-child');
    const likeCountSpan = likeBtn.querySelector('span') || likeBtn;
    
    fetch(`/like-post/${postId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken,
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const currentCount = parseInt(likeBtn.innerText.match(/\d+/)?.[0] || 0);
            if (data.liked) {
                likeBtn.innerHTML = `❤️ ${currentCount + 1}`;
                likeBtn.classList.add('liked');
                animateHeart();
            } else {
                likeBtn.innerHTML = `❤️ ${currentCount - 1}`;
                likeBtn.classList.remove('liked');
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function animateHeart() {
    const likeBtn = document.querySelector('.action-btn:first-child');
    likeBtn.style.transform = 'scale(1.2)';
    setTimeout(() => {
        likeBtn.style.transform = 'scale(1)';
    }, 200);
}

function removeSavedPost(postId, element) {
    if (!confirm('⚠️ Remove this post from saved?')) return;
    
    const card = element.closest('.post-card');
    const button = element;
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';
    button.disabled = true;
    
    fetch(`/unsave-post/${postId}/`, {
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
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.remove();
                updateSavedCount();
                showToast('Post removed from saved', true);
                
                if (document.querySelectorAll('.post-card').length === 0) {
                    location.reload();
                }
            }, 300);
        } else {
            showToast(data.error || 'Failed to remove post', false);
            button.innerHTML = originalText;
            button.disabled = false;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', false);
        button.innerHTML = originalText;
        button.disabled = false;
    });
}

function updateSavedCount() {
    const countSpan = document.querySelector('.header-info p');
    if (countSpan) {
        const currentCount = parseInt(countSpan.textContent.match(/\d+/)?.[0] || 0);
        countSpan.textContent = `${currentCount - 1} post${(currentCount - 1) !== 1 ? 's' : ''} saved`;
    }
}


function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

function animateCardsOnLoad() {
    const cards = document.querySelectorAll('.post-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 50);
    });
}

function initImageLoadingEffect() {
    document.querySelectorAll('.post-image, .single-post-image').forEach(img => {
        img.addEventListener('load', function() {
            this.style.opacity = '1';
        });
        if (img.complete) {
            img.style.opacity = '1';
        } else {
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.3s';
        }
    });
}


function initEnterKeyHandler() {
    const commentInput = document.getElementById('commentInput');
    if (commentInput) {
        commentInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const postId = this.getAttribute('data-post-id') || window.location.pathname.split('/').pop();
                addComment(postId);
            }
        });
    }
}


document.addEventListener('DOMContentLoaded', function() {
    const urlParts = window.location.pathname.split('/');
    const postIdIndex = urlParts.indexOf('post') + 1;
    if (postIdIndex > 0 && urlParts[postIdIndex]) {
        currentPostId = urlParts[postIdIndex];
        const commentInput = document.getElementById('commentInput');
        if (commentInput) {
            commentInput.setAttribute('data-post-id', currentPostId);
        }
    }
    
    animateCardsOnLoad();
    initImageLoadingEffect();
    initEnterKeyHandler();
    
    const likeBtn = document.querySelector('.action-btn:first-child');
    if (likeBtn && likeBtn.getAttribute('onclick') === null) {
        likeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPostId) {
                likePost(currentPostId);
            }
        });
    }
    
    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Uncomment for AJAX smooth removal
            // e.preventDefault();
            // const card = this.closest('.post-card');
            // const postId = card.getAttribute('data-post-id');
            // if (postId) removeSavedPost(postId, this);
        });
    });
});


window.openImageModal = openImageModal;
window.closeModal = closeModal;
window.addComment = addComment;
window.likePost = likePost;
window.deleteComment = deleteComment;
window.editComment = editComment;
window.saveCommentEdit = saveCommentEdit;
window.cancelCommentEdit = cancelCommentEdit;
window.removeSavedPost = removeSavedPost;
window.showToast = showToast;
window.escapeHtml = escapeHtml;