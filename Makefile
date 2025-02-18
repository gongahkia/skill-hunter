.PHONY: chrome firefox clean

chrome:
	@echo "Preparing Chrome extension..."
	@rm -rf .git .gitignore README.md asset src/firefox
	@mv src/chrome/* .
	@rm -rf src

firefox:
	@echo "Preparing Firefox extension..."
	@rm -rf .git .gitignore README.md asset src/chrome
	@mv src/firefox/* .
	@rm -rf src

clean:
	@echo "Cleaning up..."
	@git reset --hard HEAD
	@git clean -fd