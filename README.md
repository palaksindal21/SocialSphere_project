SocialSphere

SocialSphere is a modern, feature-rich social networking web application built with Django. It allows users to connect, share content, and interact in real-time with a beautiful dark-themed interface.

Features

Authentication
Signup - New users register with username, email, password, and birth date. CAPTCHA prevents bots. Minimum age 14 years.
Login/Logout - Secure session management.

Profile
Update bio, location, and profile picture
Toggle Public/Private Account
View followers and following lists
Delete account with confirmation

Posts
Create posts with images
Like posts
Save posts to view later
Share posts directly to chat
Comment and Reply on posts
Edit or delete your own comments

Social Interactions
Follow/Unfollow users
Follow Requests - Private accounts require approval
User Suggestions - Recommended people to follow

Real-Time Chat
One-on-one direct messaging
Real-time message delivery (WebSockets)
Message history
Share posts in chat

Real-Time Notifications
Instant alerts for:
Likes, comments, shares on your posts
Follows and follow requests
New messages

Time Tracking (Minors)
Automatic age detection from birth date
4-hour daily limit for users under 20
Real-time usage tracking
Progress bar showing remaining time
Auto-logout when limit reached

Privacy
Public Account - Anyone can see posts
Private Account - Only approved followers can see content
Followers list hidden from non-followers

Search
Search users by username
View profiles with privacy respect

Design
Dark theme
Fully responsive
Smooth animations

Technology Stack-
Backend
Django - Web framework
Django Channels - WebSocket support for real-time features
In-Memory Channel Layer - Alternative to Redis for development
SQLite - Database
Daphne - ASGI server

Frontend
HTML5 - Structure
CSS3 - Styling, animations
JavaScript - Interactive elements, AJAX, WebSocket client
Font Awesome - Icons

Libraries & Packages
django-simple-captcha - CAPTCHA protection
Pillow - Image upload and processing
