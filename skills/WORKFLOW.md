# Skills Workspace Workflow

This workspace contains only the newly requested standalone tools:

- `conver-hands` (litigation readiness bundle)
- `order-stamp` (adversarial clause detector)
- `sun-and-moon` (case chronology builder)
- `fun-fun-cloth` (policy-to-clause compiler)

## Scope Rules

- Each tool is a standalone product folder under `skills/`.
- There is no shared top-level `apps/` bucket.
- Existing projects `double-face` and `lovely-ghostwriter` are not reshaped or modified by this setup.

## Layout

```text
skills/
  conver-hands/
    api/
    web/
    worker-export/
  order-stamp/
    api/
    extension/
    worker-detection/
  sun-and-moon/
    api/
    web/
    worker-timeline/
  fun-fun-cloth/
    api/
    web/
    worker-compiler/
```

## Workspace Commands

Run from `skills/`.

- Install dependencies:

```bash
pnpm install
```

- Run all package dev scripts:

```bash
pnpm dev
```

- Build all packages:

```bash
pnpm build
```

- Lint all packages:

```bash
pnpm lint
```

## Tool-Scoped Commands

Use filters to run a single tool.

- `conver-hands` only:

```bash
pnpm --filter "./conver-hands/**" dev
```

- `order-stamp` only:

```bash
pnpm --filter "./order-stamp/**" dev
```

- `sun-and-moon` only:

```bash
pnpm --filter "./sun-and-moon/**" dev
```

- `fun-fun-cloth` only:

```bash
pnpm --filter "./fun-fun-cloth/**" dev
```
