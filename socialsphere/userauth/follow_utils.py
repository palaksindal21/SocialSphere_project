from django.contrib import messages
from django.contrib.auth.models import User
from .models import FollowersCount, FollowRequest

def follow_user(request, username_to_follow):
    try:
        user_to_follow = User.objects.get(username=username_to_follow)
         # Cannot follow yourself
        if request.user == user_to_follow:
            messages.error(request, "You cannot follow yourself!!")
            return False
        
        # Check if already following (approved follow)
        if FollowersCount.objects.filter(follower = request.user.username, user = username_to_follow,is_accepted = True).exists():
            messages.info(request, f"You already follow {username_to_follow}")
            return False
        
        # Check if there's a pending request
        pending_request = FollowRequest.objects.filter(from_user=request.user.username, to_user=username_to_follow, status='pending').exists()

        if pending_request:
            messages.info(request, "Follow request already sent!!")

        # Create follow relationship
        FollowersCount.objects.create(
            follower=request.user.username,
            user=username_to_follow,
            is_accepted=True
        )
        messages.success(request, f"You are now following {username_to_follow}")
        return True
    
    except User.DoesNotExist:
        messages.error(request, "User not found!")
        return False
    
    
def unfollow_user(request, username_to_unfollow):
    try:
        user_to_unfollow = User.objects.get(username=username_to_unfollow)
        
        # Delete follow relationship
        deleted_count, _ = FollowersCount.objects.filter(
            follower=request.user.username, 
            user=username_to_unfollow
        ).delete()

        # Also delete any pending requests
        FollowRequest.objects.filter(
            from_user=request.user.username,
            to_user=username_to_unfollow
        ).delete()

        if deleted_count > 0:
            messages.success(request, f"You unfollowed {username_to_unfollow}")
        else:
            messages.info(request, f"You were not following {username_to_unfollow}")
        
        return True
        
    except User.DoesNotExist:
        messages.error(request, "User not found!")
        return False


def send_follow_request(request, username):
     try:
        user_to_request = User.objects.get(username=username)

         # Cannot request yourself
        if request.user == user_to_request:
            messages.error(request, "You cannot send follow request to yourself!")
            return False
        
        # Check if already following
        if FollowersCount.objects.filter(
            follower=request.user.username, 
            user=username, 
            is_accepted=True
        ).exists():
            messages.info(request, f"You already follow {username}")
            return False
        
         # Check if request already exists (pending)
        if FollowRequest.objects.filter(
            from_user=request.user.username,
            to_user=username,
            status='pending'
        ).exists():
            messages.info(request, "Follow request already sent!")
            return False
        
        # Check if request was previously rejected
        if FollowRequest.objects.filter(
            from_user=request.user.username,
            to_user=username,
            status='rejected'
        ).exists():
            messages.error(request, "Your follow request was rejected. You cannot send another request.")
            return False
        
         # Check if request was previously approved (should not happen, but just in case)
        if FollowRequest.objects.filter(
            from_user=request.user.username,
            to_user=username,
            status='approved'
        ).exists():
            messages.info(request, "You already have an approved follow relationship.")
            return False
        
        # Create follow request
        FollowRequest.objects.create(
            from_user=request.user.username,
            to_user=username,
            status='pending'
        )
        
        messages.success(request, f"Follow request sent to {username}")
        return True
     
     except User.DoesNotExist:
        messages.error(request, "User not found!")
        return False
     

def cancel_follow_request(request, username):
    try:
        user = User.objects.get(username=username)
        
        follow_request = FollowRequest.objects.get(
            from_user=request.user.username,
            to_user=username,
            status='pending'
        )
        follow_request.delete()
        
        messages.success(request, f"Follow request to {username} cancelled")
        return True
    
    except User.DoesNotExist:
        messages.error(request, "User not found!")
        return False
    
    except FollowRequest.DoesNotExist:
        messages.error(request, "No pending request found!")
        return False


def approve_follow_request(request, request_id):
    try:
        follow_request = FollowRequest.objects.get(
            id=request_id, 
            to_user=request.user.username,
            status='pending'
        )
        
        # Create follow relationship
        FollowersCount.objects.create(
            follower=follow_request.from_user,
            user=follow_request.to_user,
            is_accepted=True
        )

        # Update request status
        follow_request.status = 'approved'
        follow_request.save()
        
        messages.success(request, f"You approved {follow_request.from_user}'s follow request")
        return True
        
    except FollowRequest.DoesNotExist:
        messages.error(request, "Follow request not found or already processed!")
        return False
    except Exception as e:
        messages.error(request, f"Error approving request: {str(e)}")
        return False
    

def reject_follow_request(request, request_id):
    try:
        follow_request = FollowRequest.objects.get(
            id=request_id, 
            to_user=request.user.username,
            status='pending'
        )
        
        # Update request status
        follow_request.status = 'rejected'
        follow_request.save()
        
        messages.success(request, f"You rejected {follow_request.from_user}'s follow request")
        return True
    
    except FollowRequest.DoesNotExist:
        messages.error(request, "Follow request not found or already processed!")
        return False
    except Exception as e:
        messages.error(request, f"Error rejecting request: {str(e)}")
        return False
    

def get_pending_requests(user):
    return FollowRequest.objects.filter(to_user=user.username, status='pending')


def get_followers(user):
    return FollowersCount.objects.filter(user=user.username, is_accepted=True)


def get_following(user):
    return FollowersCount.objects.filter(follower=user.username, is_accepted=True)


def check_follow_status(follower_username, following_username):
    return FollowersCount.objects.filter(
        follower=follower_username,
        user=following_username,
        is_accepted=True
    ).exists()


def get_follow_relationship_status(request_user, target_user):
    if not request_user.is_authenticated:
        return {
            'is_following': False,
            'is_follower': False,
            'has_pending_request_from_me': False,
            'has_pending_request_to_me': False,
            'can_send_request': False,
            'button_text': 'Follow',
            'button_action': 'follow'
        }
    
    # Get profiles
    try:
        target_profile = target_user.profile
    except:
        target_profile = None
    
    # Check relationships
    is_following = check_follow_status(request_user.username, target_user.username)
    is_follower = check_follow_status(target_user.username, request_user.username)
    
    has_pending_request_from_me = FollowRequest.objects.filter(
        from_user=request_user.username,
        to_user=target_user.username,
        status='pending'
    ).exists()

    has_pending_request_to_me = FollowRequest.objects.filter(
        from_user=target_user.username,
        to_user=request_user.username,
        status='pending'
    ).exists()
    
    was_request_rejected = FollowRequest.objects.filter(
        from_user=request_user.username,
        to_user=target_user.username,
        status='rejected'
    ).exists()

    # Determine button state
    if request_user == target_user:
        button_text = 'Edit Profile'
        button_action = 'edit'
    elif is_following:
        button_text = 'Unfollow'
        button_action = 'unfollow'
    elif has_pending_request_from_me:
        button_text = 'Request Sent'
        button_action = 'pending'
    elif has_pending_request_to_me:
        button_text = 'Respond to Request'
        button_action = 'respond'
    elif target_profile and target_profile.is_private:
        if was_request_rejected:
            button_text = 'Request Rejected'
            button_action = 'rejected'
            can_send_request = False
        else:
            button_text = 'Request to Follow'
            button_action = 'request'
            can_send_request = True
    else:
        button_text = 'Follow'
        button_action = 'follow'
        can_send_request = True

    return {
        'is_following': is_following,
        'is_follower': is_follower,
        'has_pending_request_from_me': has_pending_request_from_me,
        'has_pending_request_to_me': has_pending_request_to_me,
        'can_send_request': not was_request_rejected if target_profile and target_profile.is_private else True,
        'was_request_rejected': was_request_rejected,
        'button_text': button_text,
        'button_action': button_action,
    }


def get_mutual_followers(user):
    followers = set(FollowersCount.objects.filter(user=user.username, is_accepted=True).values_list('follower', flat=True))
    following = set(FollowersCount.objects.filter(follower=user.username, is_accepted=True).values_list('user', flat=True))
    
    mutual = followers.intersection(following)
    return list(mutual)

def get_follow_suggestions(user, limit=5):
    # Get users you follow
    following = FollowersCount.objects.filter(follower=user.username, is_accepted=True).values_list('user', flat=True)
    
    # Get users followed by people you follow
    suggestions = []
    for followed_user in following:
        second_level = FollowersCount.objects.filter(
            follower=followed_user, 
            is_accepted=True
        ).exclude(user=user.username).values_list('user', flat=True)
        suggestions.extend(second_level)

    # Remove duplicates and users already followed
    suggestions = list(set(suggestions))
    existing_following = set(following)
    suggestions = [s for s in suggestions if s not in existing_following and s != user.username]
    
    # Get User objects
    from django.contrib.auth.models import User
    suggested_users = User.objects.filter(username__in=suggestions)[:limit]
    
    return suggested_users