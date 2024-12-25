all:config

config: 
	@echo "installing precommit hooks..."
	@pip install pre-commit
	@pre-commit install
	@pre-commit autoupdate
	@pre-commit run --all-files
