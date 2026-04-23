from django.contrib import admin
from .models import *
# Register your models here.

admin.site.register(Profile)
admin.site.register(Post)
admin.site.register(LikePost)
admin.site.register(FollowersCount)
admin.site.register(Comment)
admin.site.register(UserSession)
admin.site.register(DailyTimeSpent)
admin.site.register(FollowRequest)
admin.site.register(SavedPost)
admin.site.register(ActiveSession)
admin.site.register(ChatRoom)
admin.site.register(ChatMessage)
admin.site.register(Notifications)
