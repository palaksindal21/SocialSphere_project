from django.shortcuts import redirect
from django.contrib import messages
from django.utils import timezone
from .models import Profile, ActiveSession
from django.contrib.auth import logout

class TimeTrackingMiddleware:
    def __init__(self, get_response):
        
        self.get_response = get_response

    def __call__(self, request):
        
        if not request.user.is_authenticated:
            return self.get_response(request)
        
        if request.path.startswith('/admin/'):
            return self.get_response(request)
        
        excluded_paths = ['/logout/', '/signin/', '/signup/', '/static/', '/media/','/auto-logout/',]

        if any(request.path.startswith(path) for path in excluded_paths):
            return self.get_response(request)
        
         try:
            profile = Profile.objects.get(user=request.user)
            
            if profile.is_minor and profile.has_exceeded_daily_limit():
                logout(request)
                messages.error(request, 'You have reached your daily limit of 4 hours. Please come back tomorrow!')
                return redirect('signin')
        
            active_session, created = ActiveSession.objects.get_or_create(user=request.user,defaults={'session_start': timezone.now(), 'is_active': True})

            if not active_session.is_active:
                active_session.is_active = True
                active_session.session_start = timezone.now()
                active_session.save()

            request.active_session = active_session

        except Profile.DoesNotExist:
            pass

        response = self.get_response(request)

        if hasattr(request, 'active_session'):
            try:
                active_session = request.active_session
                
                if active_session.is_active:
                    duration_minutes = active_session.get_session_duration_minutes()
                    
                    if duration_minutes >= 1:
                        profile = Profile.objects.get(user=request.user)

                        profile.add_usage_minutes(duration_minutes)
                        
                        active_session.session_start = timezone.now()
                        active_session.save()
                        
                        if profile.has_exceeded_daily_limit():
                            from django.contrib.auth import logout
                            logout(request)
                            messages.error(
                                request, 
                                'Daily time limit reached. You have been logged out.'
                            )
                            return redirect('signin')
            except Exception as e:
                print(f"Time tracking error: {e}")
        
        return response