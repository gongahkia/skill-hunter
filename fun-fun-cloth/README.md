# fun-fun-cloth

`fun-fun-cloth` is a standalone policy-to-clause compiler.

## Components

- `api`: compile DSL and simulate policy against contract text.
- `web`: static policy editor and simulator.
- `worker-compiler`: batch compile `.policy.dsl` files.

## API Endpoints

- `GET /health`
- `GET /templates`
- `POST /compile`
- `POST /simulate`
- `POST /simulate/compiled`

## Run

### API

```bash
cd api
pnpm install
pnpm dev
```

Default URL: `http://127.0.0.1:4014`.

### Web

```bash
cd web
pnpm dev
```

Default URL: `http://127.0.0.1:4174`.

### Worker

```bash
cd worker-compiler
pnpm install
pnpm run run
```

- Input: `worker-compiler/input/*.policy.dsl`
- Output: `worker-compiler/output/*.compiled.json`
