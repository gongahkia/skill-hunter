# Makefile for Skill Hunter development

.PHONY: all install dev build package firefox-package package-source firefox-source-package firefox-submit-prep safari-prepare safari-build safari-check safari-test safari-browser-test test lint format clean ci help

VERSION := $(shell node -p "require('./package.json').version")
FIREFOX_ARTIFACTS_DIR := submission/firefox/artifacts
FIREFOX_PACKAGE := $(FIREFOX_ARTIFACTS_DIR)/skill-hunter-firefox-v$(VERSION).xpi
FIREFOX_SOURCE_PACKAGE := $(FIREFOX_ARTIFACTS_DIR)/skill-hunter-firefox-source-v$(VERSION).zip
SAFARI_DERIVED_DATA := $(CURDIR)/build/safari/DerivedData
SAFARI_APP := $(SAFARI_DERIVED_DATA)/Build/Products/Debug/Skill Hunter.app

# Default target
all: help

# Install dependencies
install:
	npm install

# Development build with watch mode
dev:
	npm run dev

# Production build
build:
	npm run build

# Run tests
test:
	npm test

# Run tests in watch mode
test-watch:
	npm run test:watch

# Lint code
lint:
	npm run lint

# Fix linting issues
lint-fix:
	npm run lint:fix

# Format code
format:
	npm run format

# Type check
type-check:
	npm run type-check

# Local CI-equivalent quality gate
ci:
	npm run ci

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf node_modules/
	rm -rf coverage/
	rm -f *.log

# Clean and rebuild
rebuild: clean install build

# Package extension for distribution
package: build
	cd dist && zip -r ../skill-hunter-v$(VERSION).zip .

# Package the Firefox add-on artifact for AMO upload
firefox-package: build
	mkdir -p $(FIREFOX_ARTIFACTS_DIR)
	cd dist && zip -r ../$(FIREFOX_PACKAGE) .

# Package readable source for Firefox review
firefox-source-package:
	mkdir -p $(FIREFOX_ARTIFACTS_DIR)
	python3 scripts/package_firefox_source.py $(FIREFOX_SOURCE_PACKAGE)

# Prepare both Firefox AMO submission artifacts
firefox-submit-prep: firefox-package firefox-source-package

# Backwards-compatible alias for Firefox review source packaging
package-source: firefox-source-package

# Stage and validate Safari resources on any platform, without Xcode
safari-prepare:
	npm run build:safari

# Portable packaging regression tests
safari-test:
	npm run test:safari

# Real Safari engine smoke test; requires Safari Allow Remote Automation
safari-browser-test: safari-prepare
	python3 scripts/safari_browser_smoke.py

# Xcode's extension build phase compiles and packages the current WebExtension
safari-build:
	@xcodebuild -version >/dev/null 2>&1 || { echo 'Full Xcode is required. Set DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer if only Command Line Tools are selected.' >&2; exit 2; }
	xcodebuild -project "safari/Skill Hunter/Skill Hunter.xcodeproj" \
		-scheme "Skill Hunter" \
		-configuration Debug \
		-derivedDataPath "$(SAFARI_DERIVED_DATA)" \
		CODE_SIGNING_ALLOWED=NO build

# Check the native app and embedded extension after a full Xcode build
safari-check: safari-build
	python3 scripts/check_safari_app.py "$(SAFARI_APP)"

# Help target
help:
	@echo "Skill Hunter - Makefile Commands"
	@echo "================================="
	@echo ""
	@echo "Development:"
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Start development build with watch mode"
	@echo "  make build        - Create production build"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo "  make safari-test  - Run portable Safari packaging tests"
	@echo "  make safari-browser-test - Test inline hovers in real Safari (extension APIs simulated)"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint         - Lint code"
	@echo "  make lint-fix     - Fix linting issues"
	@echo "  make format       - Format code with Prettier"
	@echo "  make type-check   - Run TypeScript type checking"
	@echo "  make ci           - Run local CI-equivalent checks"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make rebuild      - Clean and rebuild"
	@echo "  make package      - Package extension for distribution"
	@echo "  make firefox-package - Build the AMO uploadable .xpi artifact"
	@echo "  make firefox-source-package - Package readable source for Firefox review"
	@echo "  make firefox-submit-prep - Create both Firefox submission artifacts"
	@echo "  make package-source - Alias for Firefox source packaging"
	@echo "  make safari-build - Build the Safari container app without code signing"
	@echo "  make safari-prepare - Stage and validate Safari resources without Xcode"
	@echo "  make safari-check - Build and validate the native Safari app (requires full Xcode)"
	@echo ""
	@echo "Help:"
	@echo "  make help         - Show this help message"
