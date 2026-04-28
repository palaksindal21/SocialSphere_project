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
    let toast = document.getElementById('toastMessage');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastMessage';
        toast.className = 'toast-message';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.backgroundColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#ff007f';
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}


function showTab(tabName, event) {
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    if (event && event.target) {
        const btn = event.target.closest('.tab-btn');
        if (btn) btn.classList.add('active');
    } else {
        
        const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');
    }
}


function followUser(username) {
    if (!username) return;
    
    const button = document.querySelector('.follow-btn');
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    fetch(`/follow/${username}/`, {
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
            showToast(`You are now following @${username}`, 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast(data.message || 'Something went wrong', 'error');
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
        }
    });
}

function unfollowUser(username) {
    if (!username) return;
    
    const button = document.querySelector('.unfollow-btn');
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    fetch(`/unfollow/${username}/`, {
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
            showToast(`You unfollowed @${username}`, 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast(data.message || 'Something went wrong', 'error');
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-user-check"></i> Following';
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-user-check"></i> Following';
        }
    });
}

function sendFollowRequest(username) {
    if (!username) return;
    
    const button = document.querySelector('.follow-btn');
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    }
    
    fetch(`/follow/${username}/`, {
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
            showToast(`Follow request sent to @${username}`, 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast(data.message || 'Request already sent or error occurred', 'error');
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-user-plus"></i> Request to Follow';
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-user-plus"></i> Request to Follow';
        }
    });
}


function showFollowersModal(username) {
    const modal = document.getElementById('followersModal');
    const modalBody = document.getElementById('followers-list');
    
    if (!modal || !modalBody) return;
    
    modalBody.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading followers...</div>';
    modal.style.display = 'block';
    
    fetch(`/get-followers/${username}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                modalBody.innerHTML = `<div class="empty-modal">⚠️ ${data.error}</div>`;
                return;
            }
            
            if (!data.followers || data.followers.length === 0) {
                modalBody.innerHTML = '<div class="empty-modal"><i class="fas fa-users"></i><br>No followers yet</div>';
                return;
            }
            
            let html = '';
            data.followers.forEach(follower => {
                const avatarUrl = follower.avatar || '/static/images/default-avatar.jpg';
                const bioText = follower.bio || 'No bio';
                html += `
                    <div class="modal-user-item">
                        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(follower.username)}" onerror="this.src='/static/images/default-avatar.jpg'">
                        <div class="modal-user-info">
                            <strong>@${escapeHtml(follower.username)}</strong>
                            <small>${escapeHtml(bioText.substring(0, 60))}</small>
                        </div>
                        <a href="/profile/${escapeHtml(follower.username)}" class="view-profile-btn">
                            <i class="fas fa-user"></i> View Profile
                        </a>
                    </div>
                `;
            });
            modalBody.innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading followers:', error);
            modalBody.innerHTML = '<div class="empty-modal"><i class="fas fa-exclamation-triangle"></i><br>Error loading followers</div>';
        });
}

function showFollowingModal(username) {
    const modal = document.getElementById('followingModal');
    const modalBody = document.getElementById('following-list');
    
    if (!modal || !modalBody) return;
    
    modalBody.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading following...</div>';
    modal.style.display = 'block';
    
    fetch(`/get-following/${username}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                modalBody.innerHTML = `<div class="empty-modal">⚠️ ${data.error}</div>`;
                return;
            }
            
            if (!data.following || data.following.length === 0) {
                modalBody.innerHTML = '<div class="empty-modal"><i class="fas fa-user-friends"></i><br>Not following anyone yet</div>';
                return;
            }
            
            let html = '';
            data.following.forEach(following => {
                const avatarUrl = following.avatar || '/static/images/default-avatar.jpg';
                const bioText = following.bio || 'No bio';
                html += `
                    <div class="modal-user-item">
                        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(following.username)}" onerror="this.src='/static/images/default-avatar.jpg'">
                        <div class="modal-user-info">
                            <strong>@${escapeHtml(following.username)}</strong>
                            <small>${escapeHtml(bioText.substring(0, 60))}</small>
                        </div>
                        <a href="/profile/${escapeHtml(following.username)}" class="view-profile-btn">
                            <i class="fas fa-user"></i> View Profile
                        </a>
                    </div>
                `;
            });
            modalBody.innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading following:', error);
            modalBody.innerHTML = '<div class="empty-modal"><i class="fas fa-exclamation-triangle"></i><br>Error loading following</div>';
        });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function deletePost(postId) {
    if (!confirm('⚠️ Are you sure you want to permanently delete this post? This action cannot be undone.')) {
        return;
    }
    
    fetch(`/delete-post/${postId}/`, {
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
            showToast('Post deleted successfully', 'success');
            // Remove post card from DOM
            const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            if (postCard) {
                postCard.style.opacity = '0';
                postCard.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    postCard.remove();
                    updatePostCount();
                }, 300);
            } else {
                location.reload();
            }
        } else {
            showToast(data.error || 'Failed to delete post', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
    });
}

function updatePostCount() {
    const remainingPosts = document.querySelectorAll('.post-card').length;
    const postCountElement = document.querySelector('.stat-item:first-child .stat-number');
    if (postCountElement) {
        postCountElement.textContent = remainingPosts;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function previewPostImage(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
        <div class="image-preview-content">
            <span class="image-preview-close">&times;</span>
            <img src="${escapeHtml(imageUrl)}" alt="Post preview">
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.style.display = 'flex';
    
    modal.querySelector('.image-preview-close').onclick = () => {
        modal.remove();
    };
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.parentElement) {
            modal.remove();
        }
    });
}

function initModalCloseOnClickOutside() {
    window.onclick = function(event) {
        const followersModal = document.getElementById('followersModal');
        const followingModal = document.getElementById('followingModal');
        
        if (event.target === followersModal) {
            followersModal.style.display = 'none';
        }
        if (event.target === followingModal) {
            followingModal.style.display = 'none';
        }
    };
}

let currentPage = 1;
let isLoading = false;
let hasMorePosts = true;

function loadMorePosts(username) {
    if (isLoading || !hasMorePosts) return;
    
    isLoading = true;
    const loadMoreBtn = document.querySelector('.load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }
    
    currentPage++;
    
    fetch(`/get-user-posts/${username}/?page=${currentPage}`, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.posts && data.posts.length > 0) {
            appendPosts(data.posts);
        }
        
        if (!data.has_next) {
            hasMorePosts = false;
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = 'No more posts';
                loadMoreBtn.disabled = true;
            }
        }
        
        isLoading = false;
        if (loadMoreBtn) {
            loadMoreBtn.innerHTML = '<i class="fas fa-arrow-down"></i> Load More';
        }
    })
    .catch(error => {
        console.error('Error loading more posts:', error);
        isLoading = false;
        if (loadMoreBtn) {
            loadMoreBtn.innerHTML = '<i class="fas fa-arrow-down"></i> Load More';
        }
    });
}

function appendPosts(posts) {
    const postsGrid = document.querySelector('.posts-grid');
    if (!postsGrid) return;
    
    posts.forEach(post => {
        const postHtml = `
            <div class="post-card" data-post-id="${post.id}">
                <div class="post-click-area" onclick="location.href='/comments/${post.id}/'"></div>
                <img src="${post.image}" alt="Post by ${escapeHtml(post.user)}" onclick="previewPostImage('${post.image}')">
                <div class="post-overlay">
                    <div class="post-stats-overlay">
                        <span><i class="fas fa-heart"></i> ${post.likes}</span>
                        <span><i class="fas fa-comment"></i> ${post.comments}</span>
                    </div>
                </div>
            </div>
        `;
        postsGrid.insertAdjacentHTML('beforeend', postHtml);
    });
}

function animateOnLoad() {
    const profileHeader = document.querySelector('.profile-header');
    if (profileHeader) {
        profileHeader.style.opacity = '0';
        profileHeader.style.transform = 'translateY(20px)';
        profileHeader.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(() => {
            profileHeader.style.opacity = '1';
            profileHeader.style.transform = 'translateY(0)';
        }, 100);
    }
    
    const postCards = document.querySelectorAll('.post-card');
    postCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
        }, index * 50);
    });
}

function copyProfileLink(username) {
    const url = `${window.location.origin}/profile/${username}/`;
    
    navigator.clipboard.writeText(url).then(() => {
        showToast('Profile link copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy link', 'error');
    });
}

function reportUser(username) {
    if (confirm(`Report @${username} for inappropriate behavior?`)) {
        fetch(`/report-user/${username}/`, {
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
                showToast('User reported successfully', 'success');
            } else {
                showToast(data.error || 'Failed to report user', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Network error', 'error');
        });
    }
}


function initProfilePage() {
    initModalCloseOnClickOutside();
    animateOnLoad();
   
    document.querySelectorAll('.post-card img').forEach(img => {
        img.addEventListener('click', function(e) {
            e.stopPropagation();
            previewPostImage(this.src);
        });
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.style.display === 'block' || modal.style.display === 'flex') {
                    modal.style.display = 'none';
                }
            });
        }
    });
}


document.addEventListener('DOMContentLoaded', function() {
    initProfilePage();
});


window.showTab = showTab;
window.followUser = followUser;
window.unfollowUser = unfollowUser;
window.sendFollowRequest = sendFollowRequest;
window.showFollowersModal = showFollowersModal;
window.showFollowingModal = showFollowingModal;
window.closeModal = closeModal;
window.deletePost = deletePost;
window.previewPostImage = previewPostImage;
window.copyProfileLink = copyProfileLink;
window.reportUser = reportUser;
window.loadMorePosts = loadMorePosts;
window.showToast = showToast;
window.escapeHtml = escapeHtml;