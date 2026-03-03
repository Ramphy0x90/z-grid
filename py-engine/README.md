# py-engine

Python simulation engine service for Zeus.

## Implemented now

- `POWER_FLOW` execution endpoint at `/api/v1/engine/execute`
- sparse AC Newton-Raphson power flow solver
- extension-ready engine registry with placeholders for:
  - hosting capacity
  - short circuit

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn py_engine.main:app --host 0.0.0.0 --port 8090
```

## API

- `GET /healthz`
- `POST /api/v1/engine/execute`

Request body:

```json
{
  "simulationType": "POWER_FLOW",
  "engineKey": "remote-python-powerflow-v1",
  "engineVersion": "v1",
  "gridDataset": {},
  "options": {}
}
```

Response body:

```json
{
  "summary": {},
  "data": {},
  "engineKey": "remote-python-powerflow-v1",
  "engineVersion": "v1"
}
```
# py-engine

`py-engine` is the Python mini software that generates realistic, street-constrained power grids for Zeus.

This v1 scope is generation-only (no simulation yet).

## Features in v1

- Live OpenStreetMap graph fetch (`place` or `bbox` input)
- Street/path-constrained line routing
- Mostly radial topology with optional tie-lines
- Zeus-compatible `GridDataset` JSON output
- Deterministic generation via `--seed`

## Setup

```bash
cd py-engine
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Usage

Generate from a place query:

```bash
py-engine generate \
  --place "Zurich, Switzerland" \
  --buses 35 \
  --seed 123 \
  --output generated-grid.json
```

Generate from a bounding box:

```bash
py-engine generate \
  --north 47.40 --south 47.34 --east 8.60 --west 8.48 \
  --buses 30 \
  --output generated-grid.json
```

Generate from a city-center point and radius:

```bash
py-engine generate \
  --center-lat 47.3769 --center-lng 8.5417 --dist-m 7000 \
  --buses 60 \
  --output generated-grid.json
```

Generate all example city datasets directly into Zeus backend resources:

```bash
py-engine generate-examples \
  --output-dir ../backend/src/main/resources/project-examples
```

## Output Contract

The generated JSON includes the keys expected by Zeus backend dataset mapping:

- `grid`
- `buses`
- `lines`
- `transformers`
- `loads`
- `generators`
- `shuntCompensators`
- `busLayout`
- `edgeLayout`

## Run tests

```bash
pytest
```
