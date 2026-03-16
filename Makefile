SRC = src
DIST = dist
CHROME_DIR = $(DIST)/chrome
FIREFOX_DIR = $(DIST)/firefox

.PHONY: all chrome firefox safari clean zip test

all: chrome firefox

chrome:
	mkdir -p $(CHROME_DIR)
	cp -r $(SRC)/* $(CHROME_DIR)/

firefox:
	mkdir -p $(FIREFOX_DIR)
	cp -r $(SRC)/* $(FIREFOX_DIR)/

safari:
	@echo "Safari requires Xcode. Run: xcrun safari-web-extension-converter $(SRC)"

clean:
	rm -rf $(DIST) *.zip *.xpi

zip: chrome firefox
	cd $(CHROME_DIR) && zip -r ../../rakuzaichi-chrome.zip .
	cd $(FIREFOX_DIR) && zip -r ../../rakuzaichi-firefox.xpi .

test:
	npm test
