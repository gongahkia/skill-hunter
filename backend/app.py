from flask import Flask, request, jsonify
import requests
import os
import logging
from urllib.parse import urlparse
from blend_logic import create_multi_blend
from tournament import generate_tournament_bracket
from dotenv import load_dotenv
from flask_cors import CORS

# Initialize Flask
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False
load_dotenv()
CORS(app, resources={
    r"/callback": {"origins": ["http://localhost:5173", "http://127.0.0.1:5000"], "methods": ["GET", "POST"]},
    r"/api/*": {"origins": "*"}
})

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class SpotifyAPI:
    def __init__(self):
        self.client_id = os.getenv('SPOTIFY_CLIENT_ID')
        self.client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
    
    def get_user_top_tracks(self, user_url, token):
        """Fetch user's top tracks with error handling"""
        try:
            user_id = self._extract_user_id(user_url)
            headers = {'Authorization': f'Bearer {token}'}
            response = requests.get(
                f'https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term',
                headers=headers
            )
            response.raise_for_status()
            return response.json().get('items', [])
        except requests.exceptions.HTTPError as err:
            app.logger.error(f"Spotify API error: {err}")
            return []

    def _extract_user_id(self, url):
        """Extract user ID from various URL formats"""
        parsed = urlparse(url)
        if parsed.scheme == 'spotify':
            return parsed.path.split(':')[-1]
        return parsed.path.split('/')[-1]

@app.route('/callback', methods=['GET', 'POST'])
def handle_callback():
    """Handle Spotify OAuth callback with PKCE"""
    try:
        if request.method == 'GET':
            # Return HTML page to handle frontend token exchange
            return """
            <script>
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');
                if (code) {
                    window.opener.postMessage({ type: 'spotify-auth-code', code }, '*');
                    window.close();
                }
            </script>
            """
        
        # Handle POST request from frontend
        data = request.json
        code = data.get('code')
        code_verifier = data.get('code_verifier')
        
        if not code or not code_verifier:
            return jsonify({"error": "Missing code or code_verifier"}), 400

        token_url = "https://accounts.spotify.com/api/token"
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "http://127.0.0.1:5000/callback",
            "client_id": os.getenv("SPOTIFY_CLIENT_ID"),
            "code_verifier": code_verifier
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        response = requests.post(token_url, data=payload, headers=headers)
        response.raise_for_status()
        
        tokens = response.json()
        return jsonify({
            "access_token": tokens['access_token'],
            "expires_in": tokens['expires_in'],
            "refresh_token": tokens.get('refresh_token')
        })

    except requests.exceptions.HTTPError as err:
        app.logger.error(f"Token exchange failed: {err.response.text}")
        return jsonify({"error": "Authentication failed", "details": err.response.text}), err.response.status_code
    except Exception as e:
        app.logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/blend', methods=['POST'])
def handle_blend():
    """Create blended playlist endpoint"""
    try:
        data = request.json
        token = data.get('auth_token')
        users = data.get('users', [])
        
        if not token or not users:
            return jsonify({"error": "Missing required parameters"}), 400

        sp = SpotifyAPI()
        all_tracks = []
        
        for user_url in users:
            tracks = sp.get_user_top_tracks(user_url, token)
            all_tracks.append({
                'user': user_url,
                'tracks': [t['id'] for t in tracks],
                'weights': [1/len(users)] * len(tracks)
            })

        blended = create_multi_blend(all_tracks, data.get('filters', {}))
        return jsonify(blended)

    except Exception as e:
        app.logger.error(f"Blend creation error: {str(e)}")
        return jsonify({"error": "Blend creation failed"}), 500

@app.route('/api/tournament', methods=['POST'])
def handle_tournament():
    """Generate tournament bracket endpoint"""
    try:
        data = request.json
        token = data.get('auth_token')
        users = data.get('users', [])
        
        if not token or not users:
            return jsonify({"error": "Missing required parameters"}), 400

        sp = SpotifyAPI()
        all_tracks = []
        
        for user_url in users:
            tracks = sp.get_user_top_tracks(user_url, token)
            all_tracks.extend([{
                'id': t['id'],
                'name': t['name'],
                'artist': t['artists'][0]['name'],
                'user': user_url
            } for t in tracks])

        bracket = generate_tournament_bracket(all_tracks)
        return jsonify(bracket)

    except Exception as e:
        app.logger.error(f"Tournament error: {str(e)}")
        return jsonify({"error": "Tournament creation failed"}), 500

@app.route('/callback', methods=['GET'])
def handle_callback_get():
    code = request.args.get('code')
    return f"""
    <script>
        window.opener.postMessage({{ 
            type: 'spotify-auth', 
            code: '{code}' 
        }}, 'http://localhost:5173');  // Match frontend origin
        window.close();
    </script>
    """

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)