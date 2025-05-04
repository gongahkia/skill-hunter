import threading
import subprocess
import time
import requests
from flask import Flask
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24).hex())
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax'
)

def run_flask():
    app.run(
        host='0.0.0.0',
        port=5000,
        threaded=True,
        use_reloader=False
    )

def wait_for_backend(url, timeout=30):
    """Wait until the backend is up and responding."""
    start = time.time()
    while True:
        try:
            r = requests.get(url)
            if r.status_code < 500:  # Backend is up
                print("Backend is up!")
                break
        except Exception:
            pass
        if time.time() - start > timeout:
            raise RuntimeError("Backend did not start in time!")
        time.sleep(0.5)

def run_frontend():
    frontend_path = './../sato-app'
    subprocess.Popen(
        'npm run dev',
        shell=True,
        cwd=frontend_path
    )

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()
    wait_for_backend("http://127.0.0.1:5000")  # Wait until Flask is up
    run_frontend()
