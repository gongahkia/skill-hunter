from dotenv import load_dotenv
load_dotenv()
import os
import requests
from flask import Flask, redirect, request, session, jsonify
from urllib.parse import urlencode
from flask_cors import CORS

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "supersecret")

# CORS Configuration
CORS(
    app,
    origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    supports_credentials=True,
    expose_headers=["Set-Cookie"]
)

# Session Configuration
app.config.update(
    SESSION_COOKIE_NAME="spotify_blend_session",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False
)

# Spotify Credentials
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = "http://127.0.0.1:5000/callback"

# Spotify API Endpoints
SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

@app.route("/login")
def login():
    """Initiate Spotify OAuth flow"""
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "scope": "user-read-private user-read-email",
        "show_dialog": "true"
    }
    auth_url = f"{SPOTIFY_AUTH_URL}?{urlencode(params)}"
    return redirect(auth_url)

@app.route("/callback")
def callback():
    """Handle Spotify OAuth callback"""
    if 'code' not in request.args:
        return jsonify({"error": "Missing authorization code"}), 400
    
    # Exchange authorization code for tokens
    token_data = {
        "grant_type": "authorization_code",
        "code": request.args['code'],
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "client_id": SPOTIFY_CLIENT_ID,
        "client_secret": SPOTIFY_CLIENT_SECRET
    }
    
    response = requests.post(SPOTIFY_TOKEN_URL, data=token_data)
    if response.status_code != 200:
        return jsonify({"error": "Token exchange failed"}), 400
    
    tokens = response.json()
    session.clear()
    session["access_token"] = tokens["access_token"]
    session["refresh_token"] = tokens.get("refresh_token")
    
    return redirect("http://127.0.0.1:5173/?login=success")

@app.route("/me")
def get_user_profile():
    """Get current user's Spotify profile"""
    if "access_token" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    headers = {"Authorization": f"Bearer {session['access_token']}"}
    response = requests.get(f"{SPOTIFY_API_BASE}/me", headers=headers)
    
    if response.status_code != 200:
        return jsonify({"error": "Failed to fetch user data"}), 500
    
    return jsonify(response.json())

@app.route("/logout")
def logout():
    """Clear session data"""
    session.clear()
    return jsonify({"status": "logged out"})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)