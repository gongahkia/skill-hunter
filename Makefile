# Makefile for Skill Hunter development

.PHONY: all install dev build test lint format clean help

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
	cd dist && zip -r ../skill-hunter-v2.0.0.zip .

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
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint         - Lint code"
	@echo "  make lint-fix     - Fix linting issues"
	@echo "  make format       - Format code with Prettier"
	@echo "  make type-check   - Run TypeScript type checking"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make rebuild      - Clean and rebuild"
	@echo "  make package      - Package extension for distribution"
	@echo ""
	@echo "Help:"
	@echo "  make help         - Show this help message"
