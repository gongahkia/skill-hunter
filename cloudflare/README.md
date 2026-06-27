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

The worker recomputes `HMAC-SHA256(CF_HMAC_SECRET, state)` and rejects mismatches or states older than 90 days.

Responses use:

```text
Content-Type: image/svg+xml; charset=utf-8
Cache-Control: public, max-age=86400
```
