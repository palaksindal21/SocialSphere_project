from django.db import models
from django.contrib.auth import get_user_model
import uuid
from datetime import datetime

User = get_user_model()

# Create your models here.
class Profile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    id_user = models.IntegerField(primary_key=True, default=0)
    bio = models.TextField(blank=True, default='')
    profileimage = models.ImageField(upload_to='profile_image',default='blankprofile.File')
    location = models.CharField(max_length=100, blank=True, default='')

    def __str__(self):
        return self.user.username
    
class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.CharField(max_length=100)
    image = models.ImageField(upload_to='post_images')
    caption = models.TextField()
    created_at = models.DateTimeField(default=datetime.now)
    no_of_likes = models.IntegerField(default=0)

    def __str__(self):
        return self.user


class LikePost(models.Model):
    post_id = models.CharField(max_length=500)
    username = models.CharField(max_length=100)

    def __str__(self):
        return self.username
    

class FollowersCount(models.Model):
    follower = models.CharField(max_length=100)
    user = models.CharField(max_length=100)

    def __str__(self):
        return self.user


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
    

    
