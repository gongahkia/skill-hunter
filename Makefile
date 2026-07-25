PYTHON ?= .venv/bin/python
PIP ?= .venv/bin/pip
NPM ?= npm --prefix src/be-sure-ance-app
DATA_DIR ?= src/be-sure-ance-app/public/data
PROBE_INSURERS ?= aia,chubb,china_life,iii,sunlife,tokio_marine,uoi
SMOKE_INSURERS ?= great_eastern,hsbc,singlife
VENV_STAMP := .venv/.deps.stamp

.PHONY: help setup venv npm-install playwright scrape scrape-full scrape-smoke probe-scrapers export-local build-local dev lint format-check counts clean-data

help:
	@printf '%s\n' \
		'Targets:' \
		'  setup           create .venv, install Python deps, Chromium, npm deps' \
		'  scrape          full live scrape, then export app-data.json' \
		'  scrape-smoke    bounded stable live scrape/export' \
		'  probe-scrapers  dry-run selected scrapers without local writes' \
		'  export-local    export current local tables to app-data.json' \
		'  build-local     export local data and build frontend' \
		'  dev             run Vite locally' \
		'  counts          print local app-data table counts' \
		'  lint            run frontend lint' \
		'  format-check    run frontend Prettier check'

setup: venv npm-install playwright

venv: $(VENV_STAMP)

$(VENV_STAMP): requirements.txt
	test -x $(PYTHON) || python3 -m venv .venv
	$(PIP) install -r requirements.txt
	touch $(VENV_STAMP)

npm-install:
	$(NPM) ci

playwright: venv
	$(PYTHON) -m playwright install chromium

scrape: scrape-full

scrape-full: venv
	BE_SURE_ANCE_DATA_DIR=$(DATA_DIR) $(PYTHON) -m src.lib.static_app_data --run-scrapers --output $(DATA_DIR)/app-data.json

scrape-smoke: venv
	PYTHON=$(PYTHON) $(NPM) run scrape:data:smoke

probe-scrapers: venv
	BE_SURE_ANCE_DATA_DIR=/tmp/be-sure-ance-probe $(PYTHON) -m src.scrapers.run_all --dry-run --only $(PROBE_INSURERS)

export-local: venv
	$(PYTHON) -m src.lib.static_app_data --output $(DATA_DIR)/app-data.json

build-local: venv
	PYTHON=$(PYTHON) $(NPM) run build:local

dev:
	$(NPM) run dev -- --host 127.0.0.1

lint:
	$(NPM) run lint

format-check:
	$(NPM) run format:check

counts: venv
	$(PYTHON) -c 'import json; from pathlib import Path; payload=json.loads((Path("$(DATA_DIR)") / "app-data.json").read_text()); [print(f"{key}: {len(value)}") for key, value in payload.get("tables", {}).items()]'

clean-data:
	rm -rf $(DATA_DIR)/tables $(DATA_DIR)/storage $(DATA_DIR)/app-data.json
