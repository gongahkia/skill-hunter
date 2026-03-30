# TODO 30 March 2026

## Outstanding items

1. Verify CLI tests in an environment with Go installed.
- Completion (2026-03-30): Go is available locally (`go version go1.26.1 darwin/arm64`).
- Verification command: `cd src/cli && go test ./...`
- Result: `ok  	github.com/gongahkia/owl/src/cli	0.393s`

2. Replace Safari OAuth bridge stub with a real implementation.
- File: `src/webext/src/auth/launchers/safari.ts`
- Current behavior: throws errors indicating a required containing macOS app bridge.
- Required completion step: implement Safari-specific auth flow and callback handling through the host bridge.
