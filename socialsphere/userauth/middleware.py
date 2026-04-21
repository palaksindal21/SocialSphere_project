from django.shortcuts import redirect
from django.contrib import messages
from django.utils import timezone
from .models import Profile, ActiveSession
from django.contrib.auth import logout

class TimeTrackingMiddleware:
    def __init__(self, get_response):
        # Called once when the server starts.
        # Stores the get_response function for later use.
        self.get_response = get_response

    def __call__(self, request):
        #Called on EVERY request.
        # This is the main method that runs for each HTTP request.
        if not request.user.is_authenticated:
            return self.get_response(request)
        
         # Don't track time for these paths (avoids unnecessary checks)
        if request.path.startswith('/admin/'):
            return self.get_response(request)
        
        excluded_paths = ['/logout/', '/signin/', '/signup/', '/static/', '/media/','/auto-logout/',]

        if any(request.path.startswith(path) for path in excluded_paths):
            return self.get_response(request)
        
         # If user already exceeded limit, block them immediately
         try:
            profile = Profile.objects.get(user=request.user)
             # Only check for minors (under 20)
            if profile.is_minor and profile.has_exceeded_daily_limit():
                logout(request)
                messages.error(request, 'You have reached your daily limit of 4 hours. Please come back tomorrow!')
                return redirect('signin')
        
             # Track when user started their current browsing session
            active_session, created = ActiveSession.objects.get_or_create(user=request.user,defaults={'session_start': timezone.now(), 'is_active': True})

            if not active_session.is_active:
                active_session.is_active = True
                active_session.session_start = timezone.now()
                active_session.save()

            request.active_session = active_session

        except Profile.DoesNotExist:
            pass

        # This is where Django calls the actual view function
        response = self.get_response(request)

        # Calculate and save time spent on this page load
        if hasattr(request, 'active_session'):
            try:
                active_session = request.active_session
                
                if active_session.is_active:
                    # Get minutes spent since last tracking
                    duration_minutes = active_session.get_session_duration_minutes()
                    
                    # Only track if at least 1 minute passed
                    if duration_minutes >= 1:
                        profile = Profile.objects.get(user=request.user)

                        # Add minutes to today's total
                        profile.add_usage_minutes(duration_minutes)
                        
                        # Reset session start time for next page load
                        active_session.session_start = timezone.now()
                        active_session.save()
                        
                        # Check if limit was just exceeded
                        if profile.has_exceeded_daily_limit():
                            # Force logout
                            from django.contrib.auth import logout
                            logout(request)
                            messages.error(
                                request, 
                                'Daily time limit reached. You have been logged out.'
                            )
                            return redirect('signin')
            except Exception as e:
                # Log error but don't break the site
                print(f"Time tracking error: {e}")
        
        return response