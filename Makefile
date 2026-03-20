.PHONY: icons build build-chrome build-firefox package-firefox lint-firefox build-safari safari-project test verify clean

icons:
	python3 scripts/generate-icons.py

build: icons
	npm run build

build-chrome: icons
	npm run build:chrome

build-firefox: icons
	npm run build:firefox

package-firefox: icons
	npm run package:firefox

lint-firefox: package-firefox
	npm run lint:firefox

build-safari: icons
	npm run build:safari

safari-project: build-safari
	npm run safari:project

test:
	npm test

verify: build test

clean:
	rm -rf dist safari
