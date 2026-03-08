[![](https://img.shields.io/badge/sato_1.0.0-passing-light_green)](https://github.com/gongahkia/sato/releases/tag/1.0.0)
[![](https://img.shields.io/badge/sato_2.0.0-passing-green)](https://github.com/gongahkia/sato/releases/tag/2.0.0)
![](https://github.com/gongahkia/sato/actions/workflows/ci.yml/badge.svg)

# `Sato`

Web app for building collaborative [Spotify Blends](https://community.spotify.com/t5/FAQs/Blend-playlists-Overview/ta-p/5246498) with [host-managed weights](#architecture) and [custom Blend Wrapped recaps](#architecture).

## Stack

* *Backend*: [Flask](https://flask.palletsprojects.com/en/stable/), [Redis](https://redis.io/), [Python](https://www.python.org/)
* *Frontend*: [Vue.js](https://vuejs.org/)
* *Auth*: [OAuth 2.0](https://oauth.net/2/)
* *API*: [Spotify Developer Web API](https://developer.spotify.com/documentation/web-api)
* *Deploy*: [Netlify](https://www.netlify.com/), [Heroku](https://www.heroku.com/)

## Screenshots

![](./asset/reference/v2/1.png)
![](./asset/reference/v2/2.png)
![](./asset/reference/v2/3.png)
![](./asset/reference/v2/4.png)

## Architecture

![](./asset/reference/v2/architecture.png)

## Usage

First [register](https://developer.spotify.com/) as a Spotify Developer.

Then create an app on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add **http://127.0.0.1:5000/api/auth/callback** under *Redirect URIs*.

The app credentials can now be pasted directly into the web UI, so a local `.env` file is optional. Server-side env vars still work as a fallback if you prefer them.

Run the below.

```console
$ git clone https://github.com/gongahkia/sato
$ cd backend && python3 -m venv .venv && source .venv/bin/activate
$ cd backend && pip install -r requirements.txt
$ cd sato-app && npm install
$ ./dev.sh
```

* See the frontend at [127.0.0.1:5173](http://127.0.0.1:5173/).  
* The frontend proxies API requests to the backend at [127.0.0.1:5000](http://127.0.0.1:5000/).
* Paste your Spotify app credentials into the Session panel, sign in, create a room, invite other members, save contributions, then let the host preview, create, and open the Blend Wrapped deck.

## Testing

Run the full verification pass from the repo root.

```console
$ ./verify.sh
```

That script runs the backend syntax check, backend pytest suite, frontend unit tests, frontend build, and the browser end-to-end suite.

Run the frontend unit suite from `sato-app/`.

```console
$ npm test -- --run
```

Run the backend API/client suite from the repo root with the repo-local virtualenv.

```console
$ backend/.venv/bin/pytest backend/tests/test_api.py backend/tests/test_spotify_client.py
```

Run the browser end-to-end suite from `sato-app/`. It starts an isolated Flask E2E backend on `127.0.0.1:5001` and a Vite frontend on `127.0.0.1:41731`, using a fake Spotify service and debug routes so the suite does not depend on real Spotify OAuth.

```console
$ npm run test:e2e
```

## Other notes

I probably spent 75% of my time wrangling with [Spotify's](https://developer.spotify.com/documentation/web-api/concepts/authorization) janky [OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749) implementation and 25% of the time actually developing `Sato`.

## Reference

The name `Sato` is in reference to [Satō](https://ajin.fandom.com/wiki/Sat%C5%8D) (佐藤), the chief antagonist who opposes [Kei Nagai](https://ajin.fandom.com/wiki/Kei_Nagai) in the completed manga series [Ajin](https://ajin.fandom.com/wiki/Ajin_Wiki).

![](./asset/logo/sato.jpg)
