all:compile

run:
	@echo "executing compiled file..."
	java src.CaseScraper

compile: 
	@echo "compiling java project..."
	mvn clean
	mvn install

config:.pre-commit-config.yaml
	@echo "installing precommit hooks..."
	pip install pre-commit
	pre-commit install
	pre-commit autoupdate
	pre-commit run --all-files
	@echo "installing maven and playwright project..."
	sudo apt install maven
	mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install"
	maven -v