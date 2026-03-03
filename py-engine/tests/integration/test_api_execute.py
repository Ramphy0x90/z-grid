import uuid

from fastapi.testclient import TestClient

from py_engine.main import app


def _uuid() -> str:
    return str(uuid.uuid4())


def _request_payload() -> dict:
    slack_bus = _uuid()
    pq_bus = _uuid()
    return {
        "simulationType": "POWER_FLOW",
        "engineKey": "remote-python-powerflow-v1",
        "engineVersion": "v1",
        "gridDataset": {
            "grid": {"baseMva": 100.0},
            "buses": [
                {"id": slack_bus, "name": "Slack", "busType": "SLACK", "inService": True},
                {"id": pq_bus, "name": "PQ", "busType": "PQ", "inService": True},
            ],
            "lines": [
                {
                    "id": _uuid(),
                    "name": "L",
                    "fromBusId": slack_bus,
                    "toBusId": pq_bus,
                    "resistancePu": 0.02,
                    "reactancePu": 0.08,
                    "susceptancePu": 0.0,
                    "fromSwitchClosed": True,
                    "toSwitchClosed": True,
                    "inService": True,
                    "ratingMva": 100.0,
                    "maxLoadingPercent": 100.0,
                }
            ],
            "transformers": [],
            "loads": [{"id": _uuid(), "busId": pq_bus, "activePowerMw": 15.0, "reactivePowerMvar": 5.0, "inService": True}],
            "generators": [{"id": _uuid(), "busId": slack_bus, "activePowerMw": 15.0, "reactivePowerMvar": 5.0, "voltagePu": 1.0, "inService": True}],
            "shuntCompensators": [],
        },
        "options": {"maxIterations": 40, "tolerance": 1e-8},
    }


def test_execute_endpoint_returns_engine_execution_envelope() -> None:
    client = TestClient(app)
    response = client.post("/api/v1/engine/execute", json=_request_payload())
    assert response.status_code == 200
    payload = response.json()
    assert payload["engineKey"] == "remote-python-powerflow-v1"
    assert "summary" in payload
    assert "data" in payload
    assert payload["data"]["converged"] is True
