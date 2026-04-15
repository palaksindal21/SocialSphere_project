from django.contrib import admin
from django.urls import path
from . import views


urlpatterns = [
    path('', views.landing, name='landing'),
    path('home/',views.home, name='home'),
    path('signup/',views.signup, name='signup'),
    path('signin',views.signin, name='signin'),
    path('logout/',views.logout, name='logout'),
    path('upload/',views.upload, name='upload'),
    path('follow/',views.follow,name='follow'),
    path('search/',views.search, name='search'),
    path('profile/<str:pk>',views.profile, name='profile'),
    path('like-post/', views.like_post, name='like_post'),
    path('settings/',views.settings, name='settings'),
    path('post/<uuid:post_id>/comments/', views.view_comments, name='view_comments'),
    path('comment/add/<uuid:post_id>/', views.add_comment, name='add_comment'),
    path('comment/reply/<uuid:comment_id>/', views.add_reply, name='add_reply'),
    path('comment/delete/<uuid:comment_id>/', views.delete_comment, name='delete_comment'),
    path('comment/edit/<uuid:comment_id>/', views.edit_comment, name='edit_comment'),
    path('save-post/<uuid:post_id>/', views.save_post, name='save_post'),
    path('saved/', views.saved_posts, name='saved_posts'),

]