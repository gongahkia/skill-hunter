from dotenv import load_dotenv  # Add this at the VERY TOP
load_dotenv()  # Load .env before other imports
import os
import requests
from flask import Flask, redirect, request, session, jsonify
from urllib.parse import urlencode
from flask_cors import CORS

app = Flask(__name__)
CORS(
    app,
    origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    supports_credentials=True,
    expose_headers=["Set-Cookie"]
)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "supersecret")
app.config.update(
    SESSION_COOKIE_DOMAIN="localhost",  # Add this line
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=False
)

# Spotify credentials (now loaded from .env)
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")  # Use getenv() instead of os.environ[]
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = "http://localhost:5000/callback"  # Changed from 127.0.0.1

# Rest of your code remains unchanged...
SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_SCOPE = "user-read-private user-read-email"

@app.route("/login")
def login():
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "scope": SPOTIFY_SCOPE,
    }
    url = f"{SPOTIFY_AUTH_URL}?{urlencode(params)}"
    return redirect(url)

@app.route("/callback")
def callback():
    code = request.args.get("code")
    if not code:
        return "No code provided", 400
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "client_id": SPOTIFY_CLIENT_ID,
        "client_secret": SPOTIFY_CLIENT_SECRET,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    r = requests.post(SPOTIFY_TOKEN_URL, data=data, headers=headers)
    if r.status_code != 200:
        return "Failed to get token", 400
    tokens = r.json()
    session["access_token"] = tokens["access_token"]
    session["refresh_token"] = tokens.get("refresh_token")
    session.modified = True
    return redirect("http://localhost:5173/?login=success")

@app.route("/me")
def me():
    access_token = session.get("access_token")
    if not access_token:
        return jsonify({"error": "Not logged in"}), 401
    headers = {"Authorization": f"Bearer {access_token}"}
    r = requests.get("https://api.spotify.com/v1/me", headers=headers)
    return jsonify(r.json())

if __name__ == "__main__":
    app.run(debug=True)