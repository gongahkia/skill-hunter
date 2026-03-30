# TODO 30 March 2026

## Outstanding items

1. Verify CLI tests in an environment with Go installed.
- Current blocker: `go` is not installed locally, so `cd src/cli && go test ./...` could not be executed here.
- Required completion step: install Go and run the CLI test suite.

2. Replace Safari OAuth bridge stub with a real implementation.
- File: `src/webext/src/auth/launchers/safari.ts`
- Current behavior: throws errors indicating a required containing macOS app bridge.
- Required completion step: implement Safari-specific auth flow and callback handling through the host bridge.
