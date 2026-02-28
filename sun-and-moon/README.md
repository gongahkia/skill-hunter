# sun-and-moon

`sun-and-moon` is a standalone case chronology builder.

## Components

- `api`: case/event ingestion + chronology analytics (gaps, conflicts, monthly grouping).
- `web`: static chronology management console.
- `worker-timeline`: snapshot materialization worker.

## API Endpoints

- `GET /health`
- `GET /cases`
- `POST /cases`
- `POST /cases/:caseId/events`
- `GET /cases/:caseId/events`
- `GET /cases/:caseId/chronology`
- `POST /cases/:caseId/chronology/rebuild`

## Run

### API

```bash
cd api
pnpm install
pnpm dev
```

Default URL: `http://127.0.0.1:4013`.

### Web

```bash
cd web
pnpm dev
```

Default URL: `http://127.0.0.1:4173`.

### Worker

```bash
cd worker-timeline
pnpm install
pnpm run run
```

Snapshots are written to `worker-timeline/data/snapshots`.
