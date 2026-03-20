DIST = dist

.PHONY: all chrome firefox safari clean zip test lint validate safari-app

all: chrome firefox

chrome:
	npm run build:chrome

firefox:
	npm run build:firefox

safari:
	npm run build:safari

safari-app:
	npm run safari:convert

clean:
	rm -rf $(DIST) *.zip *.xpi

zip: chrome firefox
	npm run package

test:
	npm test

lint:
	npm run lint

validate:
	npm run validate
