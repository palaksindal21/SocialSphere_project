from django.shortcuts import render,redirect
from django.http import HttpResponse
from django.contrib.auth.models import User
from django.contrib.auth import authenticate,login,logout
from . models import Profile

# Create your views here.
def home(request):
    print("------------")
    return render(request, 'home.html')

def signup(request):
    pass

def signin(request):
    pass

def logout(request):
    pass

def upload(request):
    pass

def follow(request):
    pass

def search(request):
    pass

def profile(request):
    pass

def like_post(request):
    pass
        
def settings(request):
    pass