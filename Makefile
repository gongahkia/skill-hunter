.PHONY: build chrome firefox clean

build:
	@node scripts/build-extension.mjs all

chrome:
	@node scripts/build-extension.mjs chrome

firefox:
	@node scripts/build-extension.mjs firefox

clean:
	@rm -rf dist
