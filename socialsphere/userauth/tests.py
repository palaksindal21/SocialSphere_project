from django.test import TestCase, Client
from django.contrib.auth.models import User
from .models import Profile, Post, LikePost, FollowersCount
from django.urls import reverse
from io import BytesIO
from django.core.files.uploadedfile import SimpleUploadedFile

class SocialSphereTests(TestCase):

    def setUp(self):
        # Create users
        self.user1 = User.objects.create_user(username='user1', password='pass123')
        self.user2 = User.objects.create_user(username='user2', password='pass123')
        self.client = Client()
        # Create profiles
        Profile.objects.create(user=self.user1, id_user=self.user1.id)
        Profile.objects.create(user=self.user2, id_user=self.user2.id)

    # Test login
 
    def test_login(self):
        response = self.client.post(reverse('signin'), {'username':'user1','password':'pass123'})
        self.assertEqual(response.status_code, 302)  # Redirect after login

    # Test signup
 
    def test_signup(self):
        response = self.client.post(reverse('signup'), {
            'username':'newuser',
            'email':'newuser@example.com',
            'password':'testpass',
            'password2':'testpass'
        })
        self.assertEqual(response.status_code, 302)  # Redirect to settings
        self.assertTrue(User.objects.filter(username='newuser').exists())

    # Test creating a post
 
    def test_create_post(self):
        self.client.login(username='user1', password='pass123')
        image = SimpleUploadedFile("test.jpg", b"file_content", content_type="image/jpeg")
        response = self.client.post(reverse('upload'), {'caption':'Hello Test','image_upload':image})
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Post.objects.filter(caption='Hello Test').exists())

    # Test like/unlike a post
  
    def test_like_post(self):
        post = Post.objects.create(user='user2', image='post_images/test.jpg', caption='Test Post')
        self.client.login(username='user1', password='pass123')
        response = self.client.get(reverse('like_post') + f"?post_id={post.id}")
        self.assertEqual(response.status_code, 302)
        self.assertTrue(LikePost.objects.filter(post_id=str(post.id), username='user1').exists())

    # Test follow/unfollow
 
    def test_follow_unfollow(self):
        self.client.login(username='user1', password='pass123')
        # Follow
        response = self.client.post(reverse('follow'), {'follower':'user1','user':'user2'})
        self.assertTrue(FollowersCount.objects.filter(follower='user1', user='user2').exists())
        # Unfollow
        response = self.client.post(reverse('follow'), {'follower':'user1','user':'user2'})
        self.assertFalse(FollowersCount.objects.filter(follower='user1', user='user2').exists())

    # Test profile update
  
    def test_profile_update(self):
        self.client.login(username='user1', password='pass123')
        response = self.client.post(reverse('settings'), {'bio':'New Bio','location':'New York'})
        self.assertEqual(response.status_code, 302)
        profile = Profile.objects.get(user=self.user1)
        self.assertEqual(profile.bio, 'New Bio')
        self.assertEqual(profile.location, 'New York')

    # Test home page feed
    def test_home_feed(self):
        self.client.login(username='user1', password='pass123')
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'home.html')