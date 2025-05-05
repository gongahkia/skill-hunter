# ----- required imports -----

import os
import re
import requests
from flask_cors import CORS
from dotenv import load_dotenv
from urllib.parse import urlencode, urlparse
from flask import Flask, redirect, request, session, jsonify

# ----- initialization code -----

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "supersecret")

CORS(
    app,
    origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    supports_credentials=True,
    expose_headers=["Set-Cookie"],
    allow_methods=["POST", "GET"]  
)

app.config.update(
    SESSION_COOKIE_NAME="spotify_blend_session",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False
)

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = "http://127.0.0.1:5000/callback"
SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"
SPOTIFY_SCOPE = " ".join([
    "user-read-private",
    "user-read-email",
    "user-top-read",
    "playlist-modify-public",
    "playlist-modify-private"
])

# ----- endpoint handlers -----

@app.route("/login")
def login():
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "scope": SPOTIFY_SCOPE,
        "show_dialog": "true"
    }
    auth_url = f"{SPOTIFY_AUTH_URL}?{urlencode(params)}"
    return redirect(auth_url)

@app.route("/callback")
def callback():
    if 'code' not in request.args:
        return jsonify({"error": "Missing authorization code"}), 400
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
    if "access_token" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    headers = {"Authorization": f"Bearer {session['access_token']}"}
    response = requests.get(f"{SPOTIFY_API_BASE}/me", headers=headers)
    if response.status_code != 200:
        return jsonify({"error": "Failed to fetch user data"}), 500
    return jsonify(response.json())

@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"status": "logged out"})

@app.route('/process-friends', methods=['POST'])
def process_friends():
    try:
        access_token = session.get("access_token")
        if not access_token:
            return jsonify({"error": "Not authenticated"}), 401
        profile_urls = request.json.get('urls', [])
        if not profile_urls:
            return jsonify({"error": "No URLs provided"}), 400
        friends_data = []
        for url in profile_urls:
            match = re.search(r'spotify\.com/user/([^/?]+)', url)
            if not match:
                continue
            user_id = match.group(1)
            profile_response = requests.get(
                f'https://api.spotify.com/v1/users/{user_id}',
                headers={'Authorization': f'Bearer {session["access_token"]}'}
            )
            if profile_response.status_code != 200:
                continue
            profile = profile_response.json()
            playlists_response = requests.get(
                f'https://api.spotify.com/v1/users/{user_id}/playlists',
                headers={'Authorization': f'Bearer {session["access_token"]}'}
            )
            playlists = playlists_response.json().get('items', []) if playlists_response.status_code == 200 else []
            friends_data.append({
                'id': user_id,
                'name': profile.get('display_name'),
                'image': profile.get('images', [{}])[0].get('url'),
                'followers': profile.get('followers', {}).get('total', 0),
                'playlist_count': len(playlists),
                'playlists': [p['id'] for p in playlists]
            })
        return jsonify(friends_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/generate-blend', methods=['POST'])
def generate_blend():
    weights = request.json.get('weights', {})
    blend_tracks = {}
    current_user_tracks = get_user_top_tracks(session['access_token'])
    for friend in session.get('friends_data', []):
        friend_tracks = []
        for playlist_id in friend['playlists']:
            tracks = requests.get(
                f'https://api.spotify.com/v1/playlists/{playlist_id}/tracks',
                headers={'Authorization': f'Bearer {session["access_token"]}'}
            ).json().get('items', [])
            friend_tracks.extend([t['track']['id'] for t in tracks])
        weight = weights.get(friend['id'], 0) / 100
        for track in set(friend_tracks):
            blend_tracks[track] = blend_tracks.get(track, 0) + weight
    for track in current_user_tracks:
        blend_tracks[track] = blend_tracks.get(track, 0) + 0.5
    sorted_tracks = sorted(blend_tracks.items(), key=lambda x: -x[1])[:50]
    playlist = requests.post(
        f'https://api.spotify.com/v1/users/{session["user_id"]}/playlists',
        headers={'Authorization': f'Bearer {session["access_token"]}'},
        json={
            'name': 'Custom Blend',
            'public': False,
            'description': 'Automatically generated blend'
        }
    ).json()
    requests.post(
        f'https://api.spotify.com/v1/playlists/{playlist["id"]}/tracks',
        headers={'Authorization': f'Bearer {session["access_token"]}'},
        json={'uris': [f'spotify:track:{t[0]}' for t in sorted_tracks]}
    )
    return jsonify(playlist)

def get_user_top_tracks(token):
    return requests.get(
        'https://api.spotify.com/v1/me/top/tracks?limit=50',
        headers={'Authorization': f'Bearer {token}'}
    ).json().get('items', [])

# ----- execution code -----    

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)