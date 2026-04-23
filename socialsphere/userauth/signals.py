# userauth/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import LikePost, Comment, FollowersCount, SharedPost, FollowRequest, ChatMessage, Notifications

def send_realtime_notification(user, notification_id, message, notification_type, from_user):
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'notifications_{user.username}',
            {
                'type': 'send_notification',
                'notification_id': notification_id,
                'message': message,
                'notification_type': notification_type,
                'from_user': from_user
            }
        )
        print(f"Real-time notification sent to {user.username}")
    except Exception as e:
        print(f"WebSocket send error: {e}")

def update_badge_count(user):
    try:
        channel_layer = get_channel_layer()
        unread_count = Notifications.objects.filter(user=user, is_read=False).count()
        async_to_sync(channel_layer.group_send)(
            f'notifications_{user.username}',
            {
                'type': 'update_badge',
                'unread_count': unread_count
            }
        )
    except Exception as e:
        print(f"Badge update error: {e}")

def create_notification(user, from_user, notification_type, message, related_id=None, related_type=None):
    try:
        if from_user == user.username:
            return None
        
        notification = Notifications.objects.create(
            user=user,
            from_user=from_user,
            notification_type=notification_type,
            message=message,
        )
        
        if related_type == 'post' and related_id:
            notification.related_post_id = related_id
        elif related_type == 'comment' and related_id:
            notification.related_comment_id = related_id
        elif related_type == 'request' and related_id:
            notification.related_request_id = related_id
        elif related_type == 'message' and related_id:
            notification.related_message_id = related_id
        
        notification.save()
        
        send_realtime_notification(user, notification.id, message, notification_type, from_user)
        update_badge_count(user)
        
        return notification
    except Exception as e:
        print(f"Error creating notification: {e}")
        return None


@receiver(post_save, sender=LikePost)
def create_like_notification(sender, instance, created, **kwargs):
    if created:
        try:
            from django.contrib.auth.models import User
            from .models import Post
            
            post = Post.objects.get(id=instance.post_id)
            post_owner = User.objects.get(username=post.user)
            
            if instance.username != post.user:
                create_notification(
                    user=post_owner,
                    from_user=instance.username,
                    notification_type='like',
                    message=f" @{instance.username} liked your post",
                    related_id=post.id,
                    related_type='post'
                )
        except Exception as e:
            print(f"Like notification error: {e}")

@receiver(post_save, sender=Comment)
def create_comment_notification(sender, instance, created, **kwargs):
    if created and not instance.is_deleted:
        try:
            from django.contrib.auth.models import User
            
            post = instance.post
            post_owner = User.objects.get(username=post.user)
            
            if instance.user != post.user:
                create_notification(
                    user=post_owner,
                    from_user=instance.user,
                    notification_type='comment',
                    message=f" @{instance.user} commented: '{instance.text[:40]}...'",
                    related_id=post.id,
                    related_type='post'
                )
        except Exception as e:
            print(f"Comment notification error: {e}")

@receiver(post_save, sender=FollowersCount)
def create_follow_notification(sender, instance, created, **kwargs):
    if created and instance.is_accepted:
        try:
            from django.contrib.auth.models import User
            
            followed_user = User.objects.get(username=instance.user)
            
            if instance.follower != instance.user:
                create_notification(
                    user=followed_user,
                    from_user=instance.follower,
                    notification_type='follow',
                    message=f" @{instance.follower} started following you"
                )
        except Exception as e:
            print(f"Follow notification error: {e}")

@receiver(post_save, sender=FollowRequest)
def create_follow_request_notification(sender, instance, created, **kwargs):
    if created and instance.status == 'pending':
        try:
            from django.contrib.auth.models import User
            
            target_user = User.objects.get(username=instance.to_user)
            
            create_notification(
                user=target_user,
                from_user=instance.from_user,
                notification_type='follow_request',
                message=f" @{instance.from_user} wants to follow you",
                related_id=instance.id,
                related_type='request'
            )
        except Exception as e:
            print(f"Follow request notification error: {e}")

@receiver(post_save, sender=FollowRequest)
def create_follow_approved_notification(sender, instance, **kwargs):
    try:
        old_instance = FollowRequest.objects.get(id=instance.id)
        old_status = old_instance.status
    except:
        old_status = None
    
    if old_status != instance.status and instance.status == 'approved':
        try:
            from django.contrib.auth.models import User
            
            requester = User.objects.get(username=instance.from_user)
            
            create_notification(
                user=requester,
                from_user=instance.to_user,
                notification_type='follow_approved',
                message=f" @{instance.to_user} approved your follow request"
            )
        except Exception as e:
            print(f"Follow approved notification error: {e}")

@receiver(post_save, sender=SharedPost)
def create_share_notification(sender, instance, created, **kwargs):
    if created:
        try:
            from django.contrib.auth.models import User
            
            original_owner = User.objects.get(username=instance.original_post.user)
            
            if instance.shared_by.username != instance.original_post.user:
                create_notification(
                    user=original_owner,
                    from_user=instance.shared_by.username,
                    notification_type='share',
                    message=f" @{instance.shared_by.username} shared your post",
                    related_id=instance.original_post.id,
                    related_type='post'
                )
        except Exception as e:
            print(f"Share notification error: {e}")

@receiver(post_save, sender=ChatMessage)
def create_message_notification(sender, instance, created, **kwargs):
    if created:
        try:
            from django.contrib.auth.models import User
            
            room = instance.room
            
            for participant in room.participants.all():
                if participant.username != instance.sender:
                    create_notification(
                        user=participant,
                        from_user=instance.sender,
                        notification_type='message',
                        message=f" @{instance.sender} sent you a message",
                        related_id=instance.message_id,
                        related_type='message'
                    )
        except Exception as e:
            print(f"Message notification error: {e}")
