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
    let toast = document.getElementById('search-toast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'search-toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${escapeHtml(message)}`;
    toast.style.borderLeftColor = type === 'success' ? '#10b981' : '#ef4444';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

let searchTimeout = null;
let isSearching = false;

function performLiveSearch(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        clearResults();
        return;
    }
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
        if (isSearching) return;
        isSearching = true;
        
        showLoadingState();
        
        fetch('/api/search-users/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrftoken,
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ query: searchTerm })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateSearchResults(data.users);
                updateResultsHeader(searchTerm, data.count || data.users.length);
            } else {
                showToast(data.error || 'Search failed', 'error');
            }
        })
        .catch(error => {
            console.error('Search error:', error);
            showToast('Network error. Please try again.', 'error');
        })
        .finally(() => {
            isSearching = false;
        });
    }, 300);
}


function showLoadingState() {
    const resultsContainer = document.getElementById('searchResultsContainer');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Searching...</p>
        </div>
    `;
}


function updateSearchResults(users) {
    const resultsContainer = document.getElementById('searchResultsContainer');
    if (!resultsContainer) return;
    
    if (!users || users.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-slash"></i>
                <h3>No users found</h3>
                <p>Try searching with a different username</p>
            </div>
        `;
        return;
    }
    
    let resultsHtml = '';
    users.forEach(user => {
        resultsHtml += `
            <div class="user-card" data-username="${escapeHtml(user.username)}">
                <div class="user-info">
                    <img src="${user.avatar || '/static/images/default-avatar.jpg'}" 
                         class="user-avatar" 
                         alt="${escapeHtml(user.username)}"
                         onerror="this.src='/static/images/default-avatar.jpg'">
                    <div class="user-details">
                        <div class="user-username">
                            <a href="/profile/${escapeHtml(user.username)}/">@${escapeHtml(user.username)}</a>
                        </div>
                        <div class="user-location">
                            <i class="fas fa-map-marker-alt"></i> ${escapeHtml(user.location || 'Location not set')}
                        </div>
                        <div class="user-bio">
                            ${escapeHtml((user.bio || 'No bio yet').substring(0, 60))}
                        </div>
                    </div>
                </div>
                <a href="/profile/${escapeHtml(user.username)}/" class="view-btn">
                    <i class="fas fa-user"></i> View Profile
                </a>
            </div>
        `;
    });
    
    resultsContainer.innerHTML = resultsHtml;
    animateResults();
}

function updateResultsHeader(searchTerm, resultCount) {
    const resultsHeader = document.querySelector('.results-header');
    if (resultsHeader) {
        const countText = resultCount === 1 ? '1 result' : `${resultCount} results`;
        resultsHeader.innerHTML = `
            <h2><i class="fas fa-search"></i> Search Results</h2>
            <p>Showing ${countText} for "<strong>${escapeHtml(searchTerm)}</strong>"</p>
        `;
    }
}


function clearResults() {
    const resultsContainer = document.getElementById('searchResultsContainer');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Search for users</h3>
                <p>Enter a username to find people</p>
            </div>
        `;
    }
    
    const resultsHeader = document.querySelector('.results-header');
    if (resultsHeader) {
        resultsHeader.innerHTML = `
            <h2><i class="fas fa-search"></i> Search Results</h2>
            <p>Enter a username to search</p>
        `;
    }
}

function animateResults() {
    const cards = document.querySelectorAll('.user-card');
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


function initSearchPage() {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.focus();
        
        // Optional: Live search (uncomment to enable)
        // searchInput.addEventListener('input', function(e) {
        //     performLiveSearch(e.target.value);
        // });
    }
    
    animateResults();
    
}


let suggestionsCache = {};

function getSearchSuggestions(prefix) {
    if (!prefix || prefix.length < 2) return [];
    
    if (suggestionsCache[prefix]) {
        return suggestionsCache[prefix];
    }
    
    return [];
}

function showSuggestions(suggestions) {
  
}


document.addEventListener('DOMContentLoaded', function() {
    initSearchPage();
});


window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.performLiveSearch = performLiveSearch;
window.animateResults = animateResults;