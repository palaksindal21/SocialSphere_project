from django.shortcuts import render,redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.contrib.auth.models import User, auth
from django.contrib import messages
from itertools import chain
from django.contrib.auth.decorators import login_required
from . models import *
import random
import json
from datetime import date, datetime
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from captcha.models import CaptchaStore
from captcha.helpers import captcha_image_url
from .follow_utils import (follow_user, unfollow_user, send_follow_request, 
                           approve_follow_request, reject_follow_request,
                        cancel_follow_request, get_pending_requests,
                        check_follow_status,get_follow_relationship_status)
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
# Create your views here.

#Landig Page 
def landing(request):
    if request.user.is_authenticated:
        return redirect('home')
    
    return render(request, 'landing.html')

# Home page
@login_required(login_url='signin')
def home(request):
    user_object = request.user
    user_profile = Profile.objects.filter(user=user_object).first()

    if user_profile is None:
        user_profile = Profile.objects.create(user=user_object, id_user=user_object.id)

    user_following_list = []
    feed = []

    user_following = FollowersCount.objects.filter(follower=request.user.username, is_accepted=True)
    user_followers = FollowersCount.objects.filter(user=request.user.username, is_accepted=True).count()
    user_following_count = FollowersCount.objects.filter(follower=request.user.username, is_accepted=True).count()
    user_posts_count = Post.objects.filter(user=request.user.username).count()
    
    for users in user_following:
        user_following_list.append(users.user)

    for usernames in user_following_list:
        feed_lists = Post.objects.filter(user=usernames)
        feed.append(feed_lists) 
    
    feed_list = list(chain(*feed))

    #user suggestion starts
    all_users = User.objects.all()
    user_following_all = []

    for user in user_following:
        try:    
            user_list = User.objects.get(username=user.user)
            user_following_all.append(user_list)
        except User.DoesNotExist:
            continue

    new_suggestions_list = [x for x in list(all_users) if (x not in list(user_following_all))]
    current_user = User.objects.filter(username = request.user.username)
    final_suggestions_list = [x for x in list(new_suggestions_list) if (x not in list(current_user))]
    random.shuffle(final_suggestions_list)

    username_profile = []
    username_profile_list = []

    for users in final_suggestions_list:
        username_profile.append(users.id)

    for ids in username_profile:
        profile_lists = Profile.objects.filter(id_user=ids)
        username_profile_list.append(profile_lists)

    suggestions_username_profile_list = list(chain(*username_profile_list))

    # user activity 
    today = timezone.now().date()
    today_record = DailyTimeSpent.objects.filter(user=request.user.username, date=today).first()
    today_minutes = today_record.total_minutes if today_record else 0
    today_hours = today_minutes // 60
    today_remaining_minutes = today_minutes % 60

    all_records = DailyTimeSpent.objects.filter(user=request.user.username)
    total_minutes = 0
    for record in all_records:
        total_minutes += record.total_minutes

    total_hours = total_minutes // 60
    total_remaining_minutes = total_minutes % 60

    # Get pending requests count for notification
    pending_requests = FollowRequest.objects.filter(to_user=request.user.username, status='pending')
    pending_requests_count = pending_requests.count()


    context = {
        'user_profile': user_profile,
        'posts': feed_list,
        'suggestions_username_profile_list': suggestions_username_profile_list[:5],
        'user_followers': user_followers,
        'user_following': user_following_count,
        'user_posts_count': user_posts_count,
        'today_hours': today_hours,
        'today_minutes': today_remaining_minutes,
        'total_hours': total_hours,
        'total_minutes': total_remaining_minutes,
        'pending_requests': pending_requests,
        'pending_requests_count': pending_requests_count,
        
    }

    return render(request, 'home.html', context)

# Signup Page
def signup(request):
    if request.method == 'POST':
        captcha_key = request.POST.get('captcha_0')
        captcha_value = request.POST.get('captcha_1')

        try:
            captcha = CaptchaStore.objects.get(hashkey=captcha_key)
            if captcha.response != captcha_value.lower():
                messages.error(request,'Invalid CAPTCHA. Please try again.')
                return redirect('signup')
            
        except CaptchaStore.DoesNotExist:
            messages.error(request, 'Invalid CAPTCHA. Please try again.')
            return redirect('signup')

        username = request.POST['username']
        email = request.POST['email']
        password = request.POST['password']
        password2 = request.POST['password2']
        birth_date = request.POST.get('birth_date')

        if not birth_date:
            messages.error(request, 'Birth date is required!!')
            return redirect('signup')
        
        try:
            dob = datetime.strptime(birth_date, '%Y-%m-%d').date()
            today = date.today()

            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            MINIMUM_AGE = 14

            if age < MINIMUM_AGE:
                messages.error(request, f'You must be at least {MINIMUM_AGE} years old to register. Your age: {age}')
                return redirect('signup')
            
        except ValueError:
            messages.error(request, 'Invalid date format. Please use YYYY-MM-DD.')
            return redirect('signup')
        
        if password == password2:
            if User.objects.filter(email=email).exists():
                messages.info(request, 'Email Taken')
                return redirect('signup')
            elif User.objects.filter(username=username).exists():
                messages.info(request, 'Username Taken')
                return redirect('signup')
            else:
                user = User.objects.create_user(username=username, email=email, password=password)
                user.save()

                #log user in and redirect to setting page
                user_login = auth.authenticate(username=username, password=password)
                auth.login(request, user_login)

                #create a Profile object for the new user
                user_model = User.objects.get(username=username)
                new_profile = Profile.objects.create(user=user_model, id_user=user_model.id, birth_date=dob, account_created_at=timezone.now())
                new_profile.save()

                UserSession.objects.create(user=username, login_time=timezone.now())

                if new_profile.is_minor:
                    limit_hours = new_profile.get_daily_limit_minutes() // 60
                    messages.info(request, f'Account created successfully! Note: As a minor (under 20), 'f'you have a daily limit of {limit_hours} hours.')
                else:    
                    messages.success(request, 'Account created successfully!')

                return redirect('settings')
        
        else:
            messages.info(request, 'Password Not Matching.')
            return redirect('signup')
    else:
        hashkey = CaptchaStore.generate_key()
        captcha_image = captcha_image_url(hashkey)
        return render(request, 'signup.html', {'captcha_hashkey': hashkey, 'captcha_image': captcha_image})

# Signin page
def signin(request):
    if request.method == 'POST':
        captcha_key = request.POST.get('captcha_0')
        captcha_value = request.POST.get('captcha_1')
        try:
            captcha = CaptchaStore.objects.get(hashkey=captcha_key)
            if captcha.response != captcha_value.lower():
                messages.error(request, 'Invalid CAPTCHA')
                return redirect('signin')
        except CaptchaStore.DoesNotExist:
            messages.error(request, 'Invalid CAPTCHA')
            return redirect('signin')
        
        
        username = request.POST['username']
        password = request.POST['password']
        user = auth.authenticate(username=username, password=password)

        if user is not None:
            try:
                profile = Profile.objects.get(user=user)
            
                if profile.is_minor and profile.has_exceeded_daily_limit():
                    remaining = profile.get_remaining_minutes_today()
                    limit_hours = profile.get_daily_limit_minutes() // 60
                    
                    messages.error(request, f'⏰ You have reached your daily limit of {limit_hours} hours.\n'f'Please come back tomorrow. (Limit resets at midnight)')
                    return redirect('signin')
                elif profile.is_minor:
                    remaining = profile.get_remaining_minutes_today()
                    if remaining < 30 and remaining > 0:
                        messages.warning(request,f'⚠️ You have only {remaining} minutes left today!')
                    
            except Profile.DoesNotExist:
                pass

            auth.login(request, user)
 # Create active session for time tracking (for middleware)
            try:
                from .models import ActiveSession
                ActiveSession.objects.get_or_create(user=user,defaults={'session_start': timezone.now(), 'is_active': True})
            except:
                pass 

            UserSession.objects.create(user=username,login_time=timezone.now())         

            # Show welcome message with time info for minors
            try:
                profile = Profile.objects.get(user=user)
                if profile.is_minor:
                    remaining = profile.get_remaining_minutes_today()
                    limit_hours = profile.get_daily_limit_minutes() // 60
                    if remaining > 0:
                        messages.success(
                            request, 
                            f'Welcome back! You have {remaining} minutes remaining today (out of {limit_hours} hours)'
                        )
                    else:
                        messages.success(request, f'Welcome back!')
                else:
                    messages.success(request, f'Welcome back, {username}!')
            except:
                messages.success(request, f'Welcome back, {username}!')
            
            return redirect('home')
            
        else:
            messages.error(request, 'Invalid username or password!')
            return redirect('signin')
    else:
        hashkey = CaptchaStore.generate_key()
        captcha_image = captcha_image_url(hashkey)
        return render(request, 'signin.html', {'captcha_hashkey': hashkey, 'captcha_image': captcha_image})
 
    

# Logout
@login_required(login_url='signin')
def logout(request):
    username = request.user.username
    #  NEW: Track final session time from ActiveSession 
    try:
        from .models import ActiveSession
        active_session = ActiveSession.objects.get(user=request.user)
        
        if active_session.is_active:
            final_minutes = active_session.get_session_duration_minutes()
            
            if final_minutes > 0:
                profile = Profile.objects.get(user=request.user)
                profile.add_usage_minutes(final_minutes)

            active_session.is_active = False
        active_session.save()
        
    except ActiveSession.DoesNotExist:
        pass
    except Profile.DoesNotExist:
        pass

    current_session = UserSession.objects.filter(user=username, logout_time__isnull=True).first()

    if current_session:
        current_session.logout_time = timezone.now()
        current_session.save()

        minutes_spent = current_session.get_minutes_spent()

        if minutes_spent > 0:
            today = timezone.now().date()
            daily_record, created_at = DailyTimeSpent.objects.get_or_create(
                user=username,
                date=today,
                defaults={'total_minutes': 0}
            )
            daily_record.total_minutes += minutes_spent
            daily_record.save()

    auth.logout(request)
    return redirect('signin')

# Auto logout when user leaves browser
@csrf_exempt
def auto_logout(request):
    if request.user.is_authenticated:
        username = request.user.username
        
        try:
            from .models import ActiveSession
            active_session = ActiveSession.objects.get(user=request.user)
            
            if active_session.is_active:
                final_minutes = active_session.get_session_duration_minutes()
                
                if final_minutes > 0:
                    profile = Profile.objects.get(user=request.user)
                    profile.add_usage_minutes(final_minutes)
            
            active_session.is_active = False
            active_session.save()
            
        except ActiveSession.DoesNotExist:
            pass
        except Profile.DoesNotExist:
            pass

        current_session = UserSession.objects.filter(
            user=username,
            logout_time__isnull=True
        ).first()
        
        if current_session:
            current_session.logout_time = timezone.now()
            current_session.save()
            
            minutes_spent = current_session.get_minutes_spent()
            
            if minutes_spent > 0:
                today = timezone.now().date()
                daily_record, created = DailyTimeSpent.objects.get_or_create(
                    user=username,
                    date=today,
                    defaults={'total_minutes': 0}
                )
                daily_record.total_minutes += minutes_spent
                daily_record.save()
        
        auth.logout(request)
    
    return JsonResponse({'status': 'ok'})


# Create post
@login_required(login_url='signin')
def upload(request):
    if request.method == 'POST':
        user = request.user.username
        image = request.FILES.get('image_upload')
        caption = request.POST['caption']

        new_post = Post.objects.create(user=user, image=image, caption=caption)
        new_post.save()

        return redirect('/')
    else:
        return redirect('/')

    # Delete Post
@login_required(login_url='signin')    
def delete_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    if post.user != request.user.username:
        messages.error(request,"You can't delete someone else's post!!")
        return redirect('home')
    
    LikePost.objects.filter(post_id=post_id).delete()
    Comment.objects.filter(post=post).delete()

    if post.image:
        post.image.delete(save=False)

    post.delete()

    messages.success(request, 'Post deleted permanently!!')
    return redirect(request.META.get('HTTP_REFERER', 'home'))
    
# Search User
@login_required(login_url='signin')
def search(request):
    user_object = User.objects.get(username=request.user.username)
    user_profile = Profile.objects.filter(user=user_object).first()

    username_profile_list = []
    username = ''

    if request.method == 'POST':
        username = request.POST['username']
        username_object = User.objects.filter(username__icontains=username)

        username_profile = []
        username_profile_list = []

        for users in username_object:
            username_profile.append(users.id)

        for ids in username_profile:
            profile_lists = Profile.objects.filter(id_user=ids)
            username_profile_list.append(profile_lists)

        username_profile_list = list(chain(*username_profile_list))
    return render(request, 'search.html', {
        'user_profile': user_profile, 
        'username_profile_list': username_profile_list, 
        'username': username
    })


# Profile page
@login_required(login_url='signin')
def profile(request, pk):
    user_object = User.objects.get(username=pk)
    user_profile = Profile.objects.get(user=user_object)
    
    can_view_content = False

    if request.user == user_object:
        can_view_content = True
    elif not user_profile.is_private:
        can_view_content = True
    elif FollowersCount.objects.filter(follower = request.user.username, user = pk, is_accepted = True).exists():
        can_view_content = True
 
#   Get relationship status using helper
    relationship = get_follow_relationship_status(request.user, user_object)

    user_followers = FollowersCount.objects.filter(user=pk, is_accepted=True).count()
    user_following = FollowersCount.objects.filter(follower=pk, is_accepted=True).count()

    if can_view_content:
        user_posts = Post.objects.filter(user=pk)
        user_post_length = len(user_posts)
    else:
        user_posts = []
        user_post_length = 0

    saved_posts = []
    if request.user.username == pk:
        saved_items = SavedPost.objects.filter(user=request.user.username)
        saved_posts = [item.post for item in saved_items]

    context = {
        'user_object': user_object,
        'user_profile': user_profile,
        'user_posts': user_posts,
        'user_post_length': user_post_length,
        'button_text': relationship['button_text'],
        'button_action': relationship['button_action'],
        'user_followers': user_followers,
        'user_following': user_following,
        'saved_posts': saved_posts,
        'can_view_content': can_view_content,
        'is_private': user_profile.is_private,
        'is_following': relationship['is_following'],
        'has_pending_request': relationship['has_pending_request_from_me'],
    }

    return render(request, 'profile.html', context)

# Followers List
@login_required(login_url='signin')
def get_followers(request, username):
    try:
        user = User.objects.get(username=username)

        if user.profile.is_private and request.user.username != username:
            return JsonResponse({'error': 'This account is private'}, status=403)
        
        follower_records = FollowersCount.objects.filter(user=username, is_accepted=True)
        followers_list = []

        for record in follower_records:
            try:
                follower_username = record.follower
                follower_user = User.objects.get(username=follower_username)
                follower_profile = Profile.objects.filter(user=follower_user).first()
                followers_list.append({
                    'username': follower_user.username,
                    'bio': follower_profile.bio if follower_profile else 'No bio',
                    'avatar': follower_profile.profileimage.url if follower_profile else '/static/images/default-avatar.jpg'})
            except User.DoesNotExist:
                continue

            return JsonResponse({'followers': followers_list, 'count': len(followers_list)})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
    

# Following list
@login_required(login_url='signin')
def get_following(request, username):
    try:
        user = User.objects.get(username=username)
        
        if user.profile.is_private and request.user.username != username:
            return JsonResponse({'error': 'This account is private'}, status=403)
        
        following_records = FollowersCount.objects.filter(follower=username, is_accepted=True)
        following_list = []

        for record in following_records:
            try:
                followed_username = record.user
                followed_user = User.objects.get(username=followed_username)
                followed_profile = Profile.objects.filter(user=followed_user).first()
                following_list.append({
                    'username': followed_user.username,
                    'bio': followed_profile.bio if followed_profile else 'No bio',
                    'avatar': followed_profile.profileimage.url if followed_profile else '/static/images/default-avatar.jpg'
                })
            except User.DoesNotExist:
                continue

        return JsonResponse({'following': following_list, 'count': len(following_list)})
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

# Like post  
@login_required(login_url='signin')
def like_post(request):
    username = request.user.username
    post_id = request.GET.get('post_id')

    post = Post.objects.get(id=post_id)

    like_filter = LikePost.objects.filter(post_id=post_id, username=username).first()

    if like_filter == None:
        new_like = LikePost.objects.create(post_id=post_id, username=username)
        new_like.save()
        post.no_of_likes = post.no_of_likes+1
        post.save()
        return redirect('/')
    
    else:
        like_filter.delete()
        post.no_of_likes = post.no_of_likes-1
        post.save()
        return redirect('/')

# Settings page
@login_required(login_url='signin')      
def settings(request):
    user_profile = Profile.objects.filter(user=request.user).first()

    if request.method == 'POST':
        if 'toggle_privacy' in request.POST:
            user_profile.is_private = not user_profile.is_private
            user_profile.save()
            messages.success(request, f"Account is now {'Private' if user_profile.is_private else 'Public'}")
            return redirect('settings')
        
        bio = request.POST.get('bio', '')
        location = request.POST.get('location', '')
        birth_date = request.POST.get('birth_date', '')
        
        if request.FILES.get('image'):
            user_profile.profileimage = request.FILES.get('image')

        user_profile.bio = bio
        user_profile.location = location

        if birth_date:
            try:
                dob = datetime.strptime(birth_date, '%Y-%m-%d').date()
                today = timezone.now().date()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                
                if age >= 14:
                    user_profile.birth_date = dob
                    messages.success(request, f"Birth date updated! Your age is {age} years.")
                else:
                    messages.warning(request, "Birth date not updated. Minimum age requirement is 14 years.")
            except ValueError:
                messages.error(request, "Invalid date format. Please use YYYY-MM-DD.")
    
        user_profile.save()
        
        messages.success(request, 'Profile updated successfully!')
        return redirect('settings')

    pending_requests = FollowRequest.objects.filter(to_user=request.user.username, status='pending')
    pending_requests_count = pending_requests.count()

    for req in pending_requests:
        try:
            req.requester_profile = Profile.objects.filter(user__username=req.from_user).first()
        except:
            req.requester_profile = None

    unread_notifications_count = Notifications.objects.filter(user=request.user, is_read=False).count()

    today = timezone.now().date()
    today_record = DailyTimeSpent.objects.filter(user=request.user.username, date=today).first()
    today_minutes = today_record.total_minutes if today_record else 0
    today_hours = today_minutes // 60
    today_remaining_minutes = today_minutes % 60
    
    all_records = DailyTimeSpent.objects.filter(user=request.user.username)
    total_minutes = 0
    for record in all_records:
        total_minutes += record.total_minutes
    total_hours = total_minutes // 60
    total_remaining_minutes = total_minutes % 60
    
    followers_count = FollowersCount.objects.filter(user=request.user.username, is_accepted=True).count()
    following_count = FollowersCount.objects.filter(follower=request.user.username, is_accepted=True).count()
    
    context = {
        'user_profile': user_profile,
        'pending_count': pending_requests_count,
        'pending_requests': pending_requests,
        'pending_requests_count': pending_requests_count,
        'unread_notifications_count': unread_notifications_count,
        'followers_count': followers_count,
        'following_count': following_count,
        'today_hours': today_hours,
        'today_minutes': today_remaining_minutes,
        'total_hours': total_hours,
        'total_minutes': total_remaining_minutes,
    }
    
    return render(request, 'settings.html', context)

# Add comment on post
@login_required(login_url='signin')
def add_comment(request, post_id):
    post = get_object_or_404(Post, id=post_id)

    if request.method == 'POST':
        comment_text = request.POST.get('comment_text')

        if comment_text:
            Comment.objects.create(post=post, user=request.user.username, text=comment_text)
            messages.success(request, "Comment added successfully!!")
        else:
            messages.error(request, "Comment cannot be empty!!")

    return redirect(request.META.get('HTTP_REFERER', '/'))


# Add reply to the comment
@login_required(login_url='signin')
def add_reply(request, comment_id):
    parent_comment = get_object_or_404(Comment, id=comment_id)

    if request.method == 'POST':
        reply_text = request.POST.get('reply_text')

        if reply_text:
            Comment.objects.create(post=parent_comment.post, user=request.user.username, text=reply_text, parent=parent_comment)
            messages.success(request, "Reply added successfully!!")
        else:
            messages.error(request, "Reply can not be empty!!")

    return redirect(request.META.get('HTTP_REFERER', '/'))

# Delete comment
@login_required(login_url='signin')
def delete_comment(request, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)

    if comment.user == request.user.username:
        comment.is_deleted = True
        comment.save()
        messages.success(request, "Comment deleted successfully!!")
    else:
        messages.error(request,"You can not delete someone else's comment")

    return redirect(request.META.get('HTTP_REFERER', '/'))

# View comments
@login_required(login_url='signin')
def view_comments(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    comments = Comment.objects.filter(
        post=post,
        parent=None,
        is_deleted=False
    ).order_by('-created_at')
    
    for comment in comments:
        comment.replies_list = Comment.objects.filter(
            parent=comment,
            is_deleted=False
        ).order_by('created_at')
    
    return render(request, 'view_comments.html', {
        'post': post,
        'comments': comments
    })

# Edit comment
@login_required(login_url='signin')
def edit_comment(request, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)
    if comment.user != request.user.username:
        messages.error(request, "You can't edit someone else's comment!")
        return redirect('view_comments', post_id=comment.post.id)
    
    if comment.is_deleted:
        messages.error(request, "Cannot edit a deleted comment!")
        return redirect('view_comments', post_id=comment.post.id)
    
    if request.method == 'POST':
        new_text = request.POST.get('comment_text')
        
        if new_text and new_text.strip():
            comment.text = new_text.strip()
            comment.save()
            messages.success(request, 'Comment updated successfully!')
            return redirect('view_comments', post_id=comment.post.id)
        else:
            messages.error(request, 'Comment cannot be empty!')
    
    return render(request, 'edit_comment.html', {
        'comment': comment,
        'post': comment.post
    })


# save unsave post
@login_required(login_url='signin')
def save_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    saved = SavedPost.objects.filter(post=post, user=request.user.username).first()

    if saved:
        saved.delete()
        messages.success(request, "Post removed from saved!!")
        is_saved = False

    else:
        SavedPost.objects.create(post=post, user=request.user.username)
        messages.success(request, "Post saved successfully!!")
        is_saved = True

    return redirect(request.META.get('HTTP_REFERER', 'home'))


# view saved posts
@login_required(login_url='signin')
def saved_posts(request):
    user_profile = Profile.objects.filter(user=request.user).first()
    if not user_profile:
        user_profile = Profile.objects.create(
            user=request.user,
            id_user=request.user.id
        )

    saved_items = SavedPost.objects.filter(
        user=request.user.username  # Filter by username string
    ).select_related('post').order_by('-saved_at')

    saved_posts = []
    for item in saved_items:
            saved_posts.append(item.post)
    
    context = {
        'user_profile': user_profile,
        'saved_posts': saved_posts,
        'saved_count': len(saved_posts)
    }
    
    return render(request, 'saved_posts.html', context)

# Follow user
@login_required(login_url='signin')
def follow_or_request_view(request, username):
    if request.method == 'POST':
        try:
            user_to_interact = User.objects.get(username=username)

            if user_to_interact.profile.is_private:
                result = send_follow_request(request, username)
            else:
                result = follow_user(request, username)

            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': result if isinstance(result, bool) else False})
            
            return redirect(request.META.get('HTTP_REFERER', 'home'))
        
        except User.DoesNotExist:
            messages.error(request, 'User does not found!!')
            return redirect('home')
        
# Unfollow user
@login_required(login_url='signin')
def unfollow_view(request, username):
    if request.method == 'POST':
        result = unfollow_user(request, username)

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': result})
        
        return redirect(request.META.get('HTTP_REFERER', 'home'))
    return redirect('home')

# Approve request
@login_required(login_url='signin')
def approve_request_view(request, request_id):
    if request.method == 'POST':
        result = approve_follow_request(request, request_id)

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': result})
        
        return redirect('pending_requests')
    return redirect('pending_requests')

# Reject follow request
@login_required(login_url='signin')
def reject_request_view(request, request_id):
    if request.method == 'POST':
        result = reject_follow_request(request, request_id)

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': result})
        
        return redirect('pending_requests')
    return redirect('pending_requests')

# Pending requests
@login_required(login_url='signin')
def pending_requests_view(request):
    pending_requests = get_pending_requests(request.user)
    user_profile = Profile.objects.filter(user=request.user).first()

    for req in pending_requests:
        try:
            req.requester_profile = Profile.objects.filter(user__username=req.from_user).first()
        except:
            req.requester_profile = None
    
   
    user_followers = FollowersCount.objects.filter(user=request.user.username, is_accepted=True).count()
    user_following = FollowersCount.objects.filter(follower=request.user.username, is_accepted=True).count()

    context = {
        'pending_requests': pending_requests,
        'user_profile': user_profile,
        'pending_count': pending_requests.count(),
        'user_followers': user_followers,      
        'user_following': user_following,     
    }

    return render(request, 'pending_requests.html', context)

# Toggle privacy private account or public account
@login_required(login_url='signin')
def toggle_privacy_view(request):
    if request.method == 'POST':
        profile = request.user.profile
        profile.is_private = not profile.is_private
        profile.save()

        messages.success(request, f"Your account is now {'Private' if profile.is_private else 'Public'}")

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'is_private': profile.is_private})
        
        return redirect('settings')
    return redirect('settings')

@login_required(login_url='signin')
def pending_requests_count(request):
    count = FollowRequest.objects.filter(to_user=request.user.username, status='pending').count()
    return JsonResponse({'count': count})


@login_required(login_url='signin')
def get_remaining_time(request):
    try:
        profile = Profile.objects.get(user=request.user)

        if profile.is_minor:
            remaining_minutes = profile.get_remaining_minutes_today()
            used_minutes = profile.get_today_usage_minutes()
            limit_minutes = profile.get_daily_limit_minutes()

            remaining_hours = remaining_minutes // 60
            remaining_mins = remaining_minutes % 60
            used_hours = used_minutes // 60
            used_mins = used_minutes % 60

            percent_used = (used_minutes / limit_minutes * 100) if limit_minutes > 0 else 0

            return JsonResponse({
                'success': True,
                'has_limit': True,
                'is_minor': True,
                'age': profile.age,
                'remaining_minutes': remaining_minutes,
                'remaining_hours': remaining_hours,
                'remaining_mins': remaining_mins,
                'used_minutes': used_minutes,
                'used_hours': used_hours,
                'used_mins': used_mins,
                'limit_minutes': limit_minutes,
                'limit_hours': limit_minutes // 60,
                'percent_used': round(percent_used, 1),
            })
        
        else:
            return JsonResponse({
                'success': True,
                'has_limit': False,
                'is_minor': False,
                'age': profile.age,
                'message': 'No time limit for users over 20'
            })
        
    except Profile.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Profile not found'
        }, status=404)



@login_required
def chat_list(request):
    chat_rooms = request.user.chat_rooms.all()

    chats_data = []
    for room in chat_rooms:
        other_user = None
        if room.room_type == 'direct':
            for user in room.participants.all():
                if user != request.user:
                    other_user = user
                    break

        chats_data.append({
            'room': room,
            'other_user': other_user,
            'last_message': room.last_message,
            'last_message_time': room.last_message_time,
            'last_message_sender': room.last_message_sender,
        })
    return render(request, 'chat_list.html', {'chats': chats_data})


@login_required
def chat_room(request, username):
    other_user = get_object_or_404(User, username=username)
    usernames = sorted([request.user.username, username])
    room_name = f"{usernames[0]}_{usernames[1]}"

    room, created = ChatRoom.objects.get_or_create(
        room_name=room_name,
        defaults={'room_type': 'direct'}
    )

    if created:
        room.participants.add(request.user, other_user)
    else:
        if request.user not in room.participants.all():
            room.participants.add(request.user)
        if other_user not in room.participants.all():
            room.participants.add(other_user)

    messages = ChatMessage.objects.filter(room=room).order_by('created_at')[:50]
    
    print(f"=" * 50)
    print(f"Chat Room: {room_name}")
    print(f"Current User: {request.user.username}")
    print(f"Other User: {other_user.username}")
    print(f"Messages Found: {messages.count()}")
    for msg in messages:
        print(f"  - {msg.sender}: {msg.message[:50]}")
    print(f"=" * 50)
    context = {
        'room_name': room_name,
        'other_user': other_user,
        'messages': messages,
        'room': room,
    }
    
    return render(request, 'chat_room.html', context)

@login_required
def get_or_create_chat(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')

        try:
            other_user = User.objects.get(username=username)
            usernames = sorted([request.user.username, username])
            room_name = f"{usernames[0]}_{usernames[1]}"
            
            room, created = ChatRoom.objects.get_or_create(
                room_name=room_name,
                defaults={'room_type': 'direct'}
            )
            
            if created:
                room.participants.add(request.user, other_user)
            
            return JsonResponse({
                'success': True,
                'room_name': room_name,
                'created': created
            })
        
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'User not found'})
    
    return JsonResponse({'success': False, 'error': 'Invalid request'})


@login_required
def get_user_chats(request):
    """Get list of users the current user has chatted with"""
    chat_rooms = request.user.chat_rooms.filter(room_type='direct')
    users = []
    for room in chat_rooms:
        for participant in room.participants.all():
            if participant != request.user:
                users.append({
                    'username': participant.username,
                    'room_name': room.room_name
                })
    return JsonResponse({'chats': users})


@login_required
def get_people_to_connect(request):
    existing_chat_users = set()
    chat_rooms = request.user.chat_rooms.filter(room_type='direct')
    for room in chat_rooms:
        for participant in room.participants.all():
            if participant != request.user:
                existing_chat_users.add(participant.username)
    
    print(f"Existing chat users: {existing_chat_users}")
    all_users = User.objects.exclude(username=request.user.username)
    all_users = all_users.exclude(username__in=existing_chat_users)
    
    print(f"Total other users: {all_users.count()}")
    
    # If no users found, get any 5 users (for testing)
    if all_users.count() == 0:
        # Get any 5 users except current user
        all_users = User.objects.exclude(username=request.user.username)[:5]
        print(f"Fallback: showing {all_users.count()} users")
    
    # Limit to 10 suggestions
    suggested_users = all_users[:10]
    
    # Get profile data
    users_data = []
    for user in suggested_users:
        profile = Profile.objects.filter(user=user).first()
        users_data.append({
            'username': user.username,
            'bio': profile.bio if profile and profile.bio else 'No bio',
            'avatar': profile.profileimage.url if profile and profile.profileimage else '/static/images/blankprofile.jpg',
            'is_private': profile.is_private if profile else False
        })
    
    print(f"Returning {len(users_data)} users")
    
    return JsonResponse({'users': users_data})



@login_required
@csrf_exempt
def share_post_to_chat(request):
    if request.method != 'POST':
        return JsonResponse({'error':'Method are not allowed!'}, status=405)
    
    try:
        data = json.loads(request.body)
        post_id = data.get('post_id')
        username = data.get('username')
        caption = data.get('caption','')

        # Get the post
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return JsonResponse({'error': 'Post not found'}, status=404)
        
         # Get the user to share with
        try:
            other_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return JsonResponse({'error': 'User not found'}, status=404)
        
        # Create or get chat room
        usernames = sorted([request.user.username, username])
        room_name = f"{usernames[0]}_{usernames[1]}"

        room, created = ChatRoom.objects.get_or_create(
            room_name=room_name,
            defaults={'room_type': 'direct'})
        
        if created:
            room.participants.add(request.user, other_user)

        # Create message with shared post
        chat_message = ChatMessage.objects.create(
            room=room,
            sender=request.user.username,
            message_type='post_share',
            message=f"📷 Shared a post" + (f": {caption}" if caption else ""),
            shared_post_id=str(post.id),
            shared_post_image=post.image.url,
            shared_post_caption=post.caption,
            shared_post_username=post.user
        )

        # Update room last message
        room.last_message = f"📷 {request.user.username} shared a post"
        room.last_message_time = timezone.now()
        room.last_message_sender = request.user.username
        room.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{room_name}',
            {
                'type': 'chat_message',
                'message_id': str(chat_message.message_id),
                'message': chat_message.message,
                'sender': request.user.username,
                'message_type': 'post_share',
                'shared_post_id': str(post.id),
                'shared_post_image': post.image.url,
                'shared_post_caption': post.caption,
                'shared_post_username': post.user,
                'timestamp': timezone.now().isoformat()
            }
        )

        return JsonResponse({
            'success': True,
            'message': 'Post shared in chat!',
            'room_name': room_name
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def get_friends_list(request):
    
    user = request.user
    followers = FollowersCount.objects.filter(user=user.username, is_accepted=True).values_list('follower', flat=True)
    following = FollowersCount.objects.filter(follower=user.username, is_accepted=True).values_list('user', flat=True)
    friends_usernames = set(list(followers) + list(following))
    if user.username in friends_usernames:
        friends_usernames.remove(user.username)
    
    friends = []
    for username in friends_usernames:
        try:
            friend_user = User.objects.get(username=username)
            profile = Profile.objects.get(user=friend_user)
            friends.append({
                'username': friend_user.username,
                'name': friend_user.get_full_name() or friend_user.username,
                'avatar': profile.profileimage.url if profile.profileimage else '/static/images/blankprofile.jpg',
                'bio': profile.bio[:50] if profile.bio else ''
            })
        except:
            pass
    
    return JsonResponse({'friends': friends})


@login_required
def view_post(request, post_id):
    try:
        post = Post.objects.get(id=post_id)
        return render(request, 'view_post.html', {'post': post})
    except Post.DoesNotExist:
        messages.error(request, 'Post not found')
        return redirect('home')
    

@login_required
def get_notifications(request):
    notifications = Notifications.objects.filter(user=request.user).order_by('-created_at')[:30]

    notification_list = []
    for notif in notifications:
        notification_list.append({
            'id': notif.id,
            'message': notif.message,
            'type': notif.notification_type,
            'is_read': notif.is_read,
            'created_at': notif.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'related_post_id': notif.related_post_id,
            'from_user': notif.from_user
        })

    return JsonResponse({'notifications': notification_list,
        'unread_count': Notifications.objects.filter(user=request.user, is_read=False).count()})


@login_required
def mark_notification_read(request, notification_id):
    try:
        notification = Notifications.objects.get(id=notification_id, user=request.user)
        notification.is_read = True
        notification.save()

        unread_count = Notifications.objects.filter(user=request.user, is_read=False).count()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'notifications_{request.user.username}',
            {
                'type': 'update_badge',
                'unread_count': unread_count
            }
        )

        return JsonResponse({'success': True})
    except:
        return JsonResponse({'success': False})
    


@login_required
def mark_all_notifications_read(request):
    Notifications.objects.filter(user=request.user, is_read=False).update(is_read=True)
    
    # Update badge count via WebSocket
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'notifications_{request.user.username}',
        {
            'type': 'update_badge',
            'unread_count': 0
        }
    )
    
    return JsonResponse({'success': True})



@login_required
@csrf_exempt
def delete_account(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        confirmation = data.get('confirmation', '')

        if confirmation != 'DELETE':
            return JsonResponse({
                'success': False, 
                'error': 'Type "DELETE" to confirm account deletion'
            })
        
        profile = request.user.profile
        profile.delete_account_permanently()

        return JsonResponse({
            'success': True,
            'message': 'Account deleted permanently'
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    