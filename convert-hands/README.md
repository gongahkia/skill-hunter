# convert-hands

`convert-hands` is a standalone litigation readiness bundle product.

## Components

- `api`: evidence/findings ingestion, bundle generation, hash/signature verification.
- `web`: static operator console for creating cases/evidence/findings and generating/verifying bundles.
- `worker-export`: queue-driven bundle generation worker.

## API Endpoints

- `GET /health`
- `GET /cases`
- `POST /cases`
- `POST /cases/:caseId/evidence`
- `POST /cases/:caseId/findings`
- `POST /cases/:caseId/bundles/generate`
- `GET /cases/:caseId/bundles`
- `GET /bundles/:bundleId`
- `POST /bundles/:bundleId/verify`

## Run

### API

```bash
cd api
pnpm install
pnpm dev
```

Default API URL: `http://127.0.0.1:4011`.

### Web Console

```bash
cd web
pnpm dev
```

Default web URL: `http://127.0.0.1:4171`.

### Worker

```bash
cd worker-export
pnpm install
pnpm run run
```

Worker reads queue jobs from `worker-export/data/queue.json`.

## Notes

- Bundle signatures use `CONVERT_HANDS_SIGNING_SECRET` (`convert-hands-dev-secret` by default).
- Artifacts are written to `api/data/bundles/*.json`.
