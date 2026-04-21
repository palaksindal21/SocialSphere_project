"""
ASGI config for socialsphere project.
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsphere.settings')

# Initialize Django ASGI application
django_asgi_app = get_asgi_application()

# Import WebSocket URL patterns
from userauth.routing import websocket_urlpatterns   # ← YEH LINE UNCOMMENT KARO

# ASGI application
application = ProtocolTypeRouter({
    # Handle traditional HTTP requests
    'http': django_asgi_app,
    
    # Handle WebSocket connections
    'websocket': AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                websocket_urlpatterns   # ← YEH ADD KARO (imported URL patterns)
            )
        )
    ),
})