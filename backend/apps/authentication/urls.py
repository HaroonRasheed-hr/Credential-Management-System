from django.urls import path
from .views import LoginView, TokenRefreshAPIView, LogoutView, MeView

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('refresh/', TokenRefreshAPIView.as_view(), name='auth-refresh'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', MeView.as_view(), name='auth-me'),
]
