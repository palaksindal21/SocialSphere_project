from django.shortcuts import render,redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.contrib.auth.models import User, auth
from django.contrib import messages
from itertools import chain
from django.contrib.auth.decorators import login_required
from . models import *
import random
from datetime import date, datetime
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from captcha.models import CaptchaStore
from captcha.helpers import captcha_image_url
# Create your views here.

def landing(request):
    if request.user.is_authenticated:
        return redirect('home')
    
    return render(request, 'landing.html')

@login_required(login_url='signin')
def home(request):
    user_object = request.user
    # user_profile = Profile.objects.get(user=user_object)
    user_profile = Profile.objects.filter(user=user_object).first()

    if user_profile is None:
        user_profile = Profile.objects.create(user=user_object, id_user=user_object.id)

    user_following_list = []
    feed = []

    user_following = FollowersCount.objects.filter(follower=request.user.username)
    user_followers = FollowersCount.objects.filter(user=request.user.username).count()
    user_following_count = FollowersCount.objects.filter(follower=request.user.username).count()
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
    }

    return render(request, 'home.html', context)


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
                messages.success(request, 'Account created successfully!')
                return redirect('settings')
        
        else:
            messages.info(request, 'Password Not Matching.')
            return redirect('signup')
    else:
        hashkey = CaptchaStore.generate_key()
        captcha_image = captcha_image_url(hashkey)
        return render(request, 'signup.html', {'captcha_hashkey': hashkey, 'captcha_image': captcha_image})


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
            auth.login(request, user)

            UserSession.objects.create(
                user=username,
                login_time=timezone.now()
            )
            return redirect('home')

        else:
            messages.info(request, 'Credentials Invalid!!')
            return redirect('signin')
    else:
        hashkey = CaptchaStore.generate_key()
        captcha_image = captcha_image_url(hashkey)
        return render(request, 'signin.html',{'captcha_hashkey': hashkey, 'captcha_image': captcha_image}) 
    

@login_required(login_url='signin')
def logout(request):
    username = request.user.username
    current_session = UserSession.objects.filter(user=username, logout_time__isnull=True).first()

    if current_session:
        current_session.logout_time = timezone.now()
        current_session.save()

        minutes_spent = current_session.get_minutes_spent()

        if minutes_spent > 0:
            today = timezone.now().date()
            daily_record, created_at = DailyTimeSpent.objects.get_or_create(
                user = username,
                date = today,
                defaults={'total_minutes': 0}
            )
            daily_record.total_minutes += minutes_spent
            daily_record.save()

    auth.logout(request)
    return redirect('signin')

@csrf_exempt
def auto_logout(request):
    if request.user.is_authenticated:
        username = request.user.username
        
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


@login_required(login_url='signin')
def follow(request):
    if request.method == 'POST':
        follower = request.POST.get('follower')
        user = request.POST.get('user')

        if not follower or not user:              
           return redirect('/')
        
        if FollowersCount.objects.filter(follower=follower, user=user).exists():
            FollowersCount.objects.filter(follower=follower, user=user).delete()
        else:
            FollowersCount.objects.create(follower=follower, user=user)

            return redirect('profile', pk=user)

    return redirect('/')


@login_required(login_url='signin')
def search(request):
    user_object = User.objects.get(username=request.user.username)
    # user_profile = Profile.objects.get(user=user_object)
    user_profile = Profile.objects.filter(user=user_object).first()

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
    return render(request, 'search.html', {'user_profile':user_profile, 'username_profile_list':username_profile_list, 'username': username})


@login_required(login_url='signin')
def profile(request, pk):
    user_object = User.objects.get(username=pk)
    user_profile = Profile.objects.get(user=user_object)
    user_posts = Post.objects.filter(user=pk)
    user_post_length = len(user_posts)

    follower = request.user.username
    user = pk

    if FollowersCount.objects.filter(follower=follower, user=user).first():
        button_text = 'Unfollow'

    else:
        button_text = 'Follow'

    user_followers = FollowersCount.objects.filter(user=pk).count()
    user_following = FollowersCount.objects.filter(follower=pk).count()

    saved_posts = []
    if request.user.username == pk:
        saved_items = SavedPost.objects.filter(user=request.user.username)
        saved_posts = [item.post for item in saved_items]

    context = {
        'user_object': user_object,
        'user_profile': user_profile,
        'user_posts': user_posts,
        'user_post_length': user_post_length,
        'button_text': button_text,
        'user_followers': user_followers,
        'user_following': user_following,
        'saved_posts': saved_posts,

    }

    return render(request, 'profile.html', context)

@login_required(login_url='signin')
def get_followers(request, username):
    try:
        follower_records = FollowersCount.objects.filter(user=username)
        followers_list = []

        for record in follower_records:
            try:
                follower_username = record.follower
                follower_user = User.objects.get(username=follower_username)
                follower_profile = Profile.objects.filter(user=follower_user).first()
                followers_list.append({'username':follower_user.username,
                                       'bio':follower_profile.bio if follower_profile else 'No bio',
                                       'avatar': follower_profile.profileimage.url if follower_profile else 'static/images/default-avatar.jpg'})
            except User.DoesNotExist:
                continue

            return JsonResponse({'followers':followers_list,
                                 'count':len(followers_list)})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
    


@login_required(login_url='signin')
def get_following(request, username):
    try:
        following_records = FollowersCount.objects.filter(follower=username)
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

        return JsonResponse({
            'following': following_list,
            'count': len(following_list)
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)



   
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

@login_required(login_url='signin')      
def settings(request):
    user_profile = Profile.objects.filter(user=request.user).first()

    if request.method == 'POST':
        if request.FILES.get('image') == None:
            image = request.FILES.get('image') or user_profile.profileimage
            bio = request.POST['bio']
            location = request.POST['location']

            user_profile.profileimage = image
            user_profile.bio = bio
            user_profile.location = location
            user_profile.save()
        
        if request.FILES.get('image') != None:
            image = request.FILES.get('image')
            bio = request.POST['bio']
            location = request.POST['location']

            user_profile.profileimage = image
            user_profile.bio = bio
            user_profile.location = location
            user_profile.save()

        return redirect('settings')
    return render(request, 'settings.html', {'user_profile':user_profile})

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


