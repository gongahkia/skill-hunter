all:compile

compile: 
	@echo "compiling java project..."
	mvn dependency:resolve
	mvn clean compile
	mvn exec:java -Dexec.mainClass="CaseScraper"

config:.pre-commit-config.yaml
	@echo "installing precommit hooks..."
	sudo apt install maven
	pip install pre-commit
	pre-commit install
	pre-commit autoupdate
	pre-commit run --all-files