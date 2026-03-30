# TODO 30 March 2026

## Outstanding items

1. Verify CLI tests in an environment with Go installed.
- Completion (2026-03-30): Go is available locally (`go version go1.26.1 darwin/arm64`).
- Verification command: `cd src/cli && go test ./...`
- Result: `ok  	github.com/gongahkia/owl/src/cli	0.393s`

2. Replace Safari OAuth bridge stub with a real implementation.
- File: `src/webext/src/auth/launchers/safari.ts`
- Completion (2026-03-30): implemented native host bridge messaging for Safari OAuth redirect URI and interactive auth callback handling.
- Added test coverage: `src/webext/tests/safari-auth-launcher.test.ts`
- Verification commands:
  - `cd src/webext && npm run check`
  - `cd src/webext && npm test`
