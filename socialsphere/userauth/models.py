from django.db import models
from django.contrib.auth import get_user_model
import uuid
from django.utils import timezone
from datetime import datetime, timedelta

User = get_user_model()

# Create your models here.
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    id_user = models.IntegerField(primary_key=True, default=0)
    bio = models.TextField(blank=True, default='')
    profileimage = models.ImageField(upload_to='profile_image',default='blankprofile.jpg')
    location = models.CharField(max_length=100, blank=True, default='')
    birth_date = models.DateField(null=True, blank=True)
    is_private = models.BooleanField(default=False)
    account_active = models.BooleanField(default=True)
    account_created_at = models.DateTimeField(default=datetime.now)

    def __str__(self):
        return self.user.username
    
    @property
    def age(self):
            if self.birth_date:
                today = timezone.now().date()
                return today.year - self.birth_date.year - ((today.month, today.day)>(self.birth_date.month, self.birth_date.day))
            return None
    
    @property
    def is_minor(self):
        return self.age and self.age<18

    
class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.CharField(max_length=100)
    image = models.ImageField(upload_to='post_images')
    caption = models.TextField()
    created_at = models.DateTimeField(default=datetime.now)
    no_of_likes = models.IntegerField(default=0)

    def __str__(self):
        return self.user
    
    def permanent_delete(self):
        self.delete()

class UserSession(models.Model):
    user = models.CharField(max_length=100)
    login_time = models.DateTimeField(default=timezone.now)
    logout_time = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user} - Login: {self.login_time}"
    
    def get_minutes_spent(self):
        if self.logout_time:
            duration = self.logout_time - self.login_time
            return int(duration.total_seconds()/60)
        return 0
    

class DailyTimeSpent(models.Model):
    user = models.CharField(max_length=100)  
    date = models.DateField(default=timezone.now)  
    total_minutes = models.IntegerField(default=0)  

    class Meta:
        unique_together = ('user', 'date')

    def __str__(self):
        hours = self.total_minutes // 60
        minutes = self.total_minutes % 60
        return f"{self.user}: {hours}h {minutes}m on {self.date}"

class LikePost(models.Model):
    post_id = models.CharField(max_length=500)
    username = models.CharField(max_length=100)

    def __str__(self):
        return self.username
    

class FollowersCount(models.Model):
    follower = models.CharField(max_length=100)
    user = models.CharField(max_length=100)
    created_at = models.DateTimeField(default=datetime.now)
    is_accepted = models.BooleanField(default=True)

    class Meta:
        unique_together = ('follower', 'user')

    def __str__(self):
        return f"{self.follower} follows {self.user}"

class FollowRequest(models.Model):
    from_user = models.CharField(max_length=100)
    to_user = models.CharField(max_length=100)
    created_at = models.DateTimeField(default=datetime.now)
    status = models.CharField(max_length=20, default='pending')

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f"{self.from_user} -> {self.to_user} ({self.status})"
    

class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='comments')
    user = models.CharField(max_length=100)
    text = models.TextField(max_length=800)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, related_name='replies')
    created_at = models.DateTimeField(default=datetime.now)
    is_deleted = models.BooleanField(default=False)
    likes = models.ManyToManyField(User, related_name='liked_comments', blank=True)

    def __str__(self):
        return f"{self.user} on {self.post.id}"
    
    @property
    def like_count(self):
        return self.likes.count()
    
    @property
    def reply_count(self):
        return self.replies.filter(is_deleted=False).count()


class SavedPost(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='saved_by')
    user = models.CharField(max_length=100)
    saved_at = models.DateTimeField(default=datetime.now)

    class Meta:
        unique_together = ('post', 'user') #prevent duplicate saves

    def __str__(self):
        return f"{self.user} saved {self.post.id}"
    

    
