# Dorso Badge Worker

Serves signed, cacheable SVG badges at:

```text
GET /badge/<base64url-state>.svg?sig=<base64url-hmac>
```

`state` is base64url-encoded JSON:

```json
{
  "score": 87,
  "longestRun": 14,
  "installIdHash": "anonymous-install-hash",
  "timestamp": 1782499200000
}
```

## Signing

The extension builds `canonicalState` with stable key order:

```json
{
  "score": 87,
  "longestRun": 14,
  "installIdHash": "anonymous-install-hash",
  "timestamp": 1782499200000
}
```

Then it computes:

```text
state = base64url(JSON.stringify(canonicalState))
sig = base64url(HMAC-SHA256(secret, state))
```

The worker reads `secret` from the Cloudflare environment variable `CF_HMAC_SECRET` and recomputes the signature over the exact `state` URL segment. The extension reads the same secret from a build-injected constant populated from the repo secret `CF_HMAC_SECRET`.

Invalid signatures return `401`. Malformed state returns `400`. State older than 90 days returns `410`.

Responses use:

```text
Content-Type: image/svg+xml; charset=utf-8
Cache-Control: public, max-age=86400
```

## Rotation

1. Set a new `CF_HMAC_SECRET` in Cloudflare.
2. Update the repo secret `CF_HMAC_SECRET`.
3. Build and ship a new extension package with the injected secret.
4. Add a cache-bust query param to newly generated badge URLs, for example `?sig=<sig>&v=<rotation-id>`.
5. Keep the previous secret only until the old extension build is no longer expected to generate fresh badge URLs.
