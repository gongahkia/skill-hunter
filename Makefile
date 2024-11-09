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
	sudo apt install maven
	maven -v
	pip install pre-commit
	pre-commit install
	pre-commit autoupdate
	pre-commit run --all-files