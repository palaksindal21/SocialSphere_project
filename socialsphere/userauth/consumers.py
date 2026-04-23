import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

class ChatConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        self.user = self.scope['user']
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Load previous messages
        await self.send_previous_messages()
        
        print(f"✅ WebSocket connected: {self.user.username}")
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        data = json.loads(text_data)  # FIXED: changed 'load' to 'loads'
        message = data.get('message', '')
        message_type = data.get('type', 'chat')

        if message_type == 'chat':
            saved_message = await self.save_message(message)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender': self.user.username,
                    'timestamp': saved_message['timestamp'],
                    'message_id': saved_message['message_id']
                }
            )

        elif message_type == 'typing':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'typing_indicator',
                    'sender': self.user.username,
                    'is_typing': data.get('is_typing', False)
                }
            )

        elif message_type == 'mark_read':
            await self.mark_message_read(data.get('message_id'))
    
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat',
            'message': event['message'],
            'sender': event['sender'],
            'timestamp': event['timestamp'],
            'message_id': event['message_id']
        }))
    
    async def typing_indicator(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'sender': event['sender'],
            'is_typing': event['is_typing']
        }))
    
    async def send_previous_messages(self):
        messages = await self.get_previous_messages()
        
        for msg in messages:
            await self.send(text_data=json.dumps({
                'type': 'chat',
                'message': msg['message'],
                'sender': msg['sender'],
                'timestamp': msg['timestamp'],
                'message_id': msg['message_id'],
                'is_old': True
            }))
    
    @database_sync_to_async
    def save_message(self, message):
        from .models import ChatRoom, ChatMessage
        
        room = ChatRoom.objects.get(room_name=self.room_name)
        
        chat_message = ChatMessage.objects.create(
            room=room,
            sender=self.user.username,
            message=message,
            message_type='text'
        )
        
        room.update_last_message(message, self.user.username)
        
        return {
            'message_id': str(chat_message.message_id),
            'timestamp': chat_message.created_at.isoformat()
        }
    
    @database_sync_to_async
    def get_previous_messages(self):
        from .models import ChatRoom, ChatMessage
        
        try:
            room = ChatRoom.objects.get(room_name=self.room_name)
            messages = ChatMessage.objects.filter(room=room).order_by('created_at')[:50]
            
            return [{
                'message_id': str(msg.message_id),
                'message': msg.message,
                'sender': msg.sender,
                'timestamp': msg.created_at.isoformat()
            } for msg in messages]
        except ChatRoom.DoesNotExist:
            return []
    
    @database_sync_to_async
    def mark_message_read(self, message_id):
        from .models import ChatMessage
        
        try:
            message = ChatMessage.objects.get(message_id=message_id)
            if message.sender != self.user.username:
                message.mark_as_read()
        except ChatMessage.DoesNotExist:
            pass


    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
        'type': 'chat',
        'message': event.get('message', ''),
        'sender': event['sender'],
        'timestamp': event.get('timestamp'),
        'message_id': event.get('message_id'),
        'message_type': event.get('message_type', 'text'),
        'shared_post_id': event.get('shared_post_id'),
        'shared_post_image': event.get('shared_post_image'),
        'shared_post_caption': event.get('shared_post_caption'),
        'shared_post_username': event.get('shared_post_username')
    }))
        

class NotificationConsumer(AsyncWebsocketConsumer):

    
    async def connect(self):
        self.user = self.scope['user']
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.room_name = f'notifications_{self.user.username}'
        self.room_group_name = self.room_name
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        print(f"Notification WebSocket connected for {self.user.username}")


    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print(f" Notification WebSocket disconnected for {self.user.username}")
    
    async def send_notification(self, event):
    
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'notification_id': event['notification_id'],
            'message': event['message'],
            'notification_type': event['notification_type'],
            'from_user': event['from_user']
        }))


    async def update_badge(self, event):
        """Update unread count badge"""
        await self.send(text_data=json.dumps({
            'type': 'badge_update',
            'unread_count': event['unread_count']
        }))