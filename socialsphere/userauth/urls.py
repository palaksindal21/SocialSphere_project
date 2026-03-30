from django.contrib import admin
from django.urls import path
from . import views


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'),
    path('signup/',views.signup, name='signup'),
    path('signin',views.signin, name='signin'),
    path('logout/',views.logout, name='logout'),
    path('upload/',views.upload, name='upload'),
    path('follow/',views.follow,name='follow'),
    path('search/',views.search, name='search'),
    path('profile/<str:pk>',views.profile, name='profile'),
    path('like-post/',views.like_post, name='like-post'),
    path('settings/',views.settings, name='settings')

]