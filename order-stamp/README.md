# order-stamp

`order-stamp` is a standalone adversarial clause detector product.

## Components

- `api`: heuristic detector API.
- `extension`: Chrome Manifest V3 extension for active-tab scanning and highlighting.
- `worker-detection`: batch scanner for text files.

## API

### Endpoints

- `GET /health`
- `GET /rules`
- `POST /detect`
- `POST /detect/html`

### Run

```bash
cd api
pnpm install
pnpm dev
```

Default URL: `http://127.0.0.1:4012`.

## Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked extension from `order-stamp/extension`.
4. Set detector API URL in popup if needed.
5. Click `Scan Active Tab`.

## Worker

```bash
cd worker-detection
pnpm install
pnpm run run
```

- Input folder: `worker-detection/input/*.txt`
- Output folder: `worker-detection/output/*.report.json`
