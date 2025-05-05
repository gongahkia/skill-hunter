from diagrams import Diagram, Cluster
from diagrams.programming.language import Python
from diagrams.onprem.compute import Server
from diagrams.onprem.inmemory import Redis
from diagrams.onprem.network import Internet
from diagrams.onprem.client import User
from diagrams.custom import Custom

VUE_LOGO = "vue-logo.png"

with Diagram("Sato Architecture", show=False, direction="LR"):
    user = User("Spotify User")
    with Cluster("Frontend"):
        vue_app = Custom("Vue.js App", VUE_LOGO)
    with Cluster("Backend"):
        python_code = Python("app.py")
        flask_app = Server("Flask API\n(127.0.0.1:5000)")
        redis_cache = Redis("Session Store")
        python_code >> flask_app
        flask_app << redis_cache
    spotify_api = Internet("Spotify Web API")
    user >> vue_app >> flask_app
    flask_app >> spotify_api
    spotify_api >> flask_app >> vue_app >> user