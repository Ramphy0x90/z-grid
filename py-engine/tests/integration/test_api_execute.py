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


def _short_circuit_payload() -> dict:
    slack_bus = _uuid()
    pq_bus = _uuid()
    return {
        "simulationType": "SHORT_CIRCUIT",
        "engineKey": "remote-python-short-circuit-v1",
        "engineVersion": "v1",
        "gridDataset": {
            "grid": {"baseMva": 100.0},
            "buses": [
                {"id": slack_bus, "name": "Slack", "busType": "SLACK", "nominalVoltageKv": 110.0, "inService": True},
                {"id": pq_bus, "name": "PQ", "busType": "PQ", "nominalVoltageKv": 110.0, "inService": True},
            ],
            "lines": [
                {
                    "id": _uuid(),
                    "name": "L",
                    "fromBusId": slack_bus,
                    "toBusId": pq_bus,
                    "resistancePu": 0.01,
                    "reactancePu": 0.08,
                    "susceptancePu": 0.0,
                    "r0Pu": 0.03,
                    "x0Pu": 0.24,
                    "b0Pu": 0.0,
                    "fromSwitchClosed": True,
                    "toSwitchClosed": True,
                    "inService": True,
                }
            ],
            "transformers": [],
            "loads": [],
            "generators": [
                {
                    "id": _uuid(),
                    "busId": slack_bus,
                    "activePowerMw": 0.0,
                    "reactivePowerMvar": 0.0,
                    "voltagePu": 1.0,
                    "xdppPu": 0.2,
                    "x2Pu": 0.2,
                    "x0Pu": 0.1,
                    "neutralGrounded": True,
                    "neutralResistancePu": 0.0,
                    "neutralReactancePu": 0.0,
                    "inService": True,
                }
            ],
            "shuntCompensators": [],
        },
        "options": {"faultTypes": ["3PH", "SLG", "LL", "DLG"]},
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


def test_execute_endpoint_clamps_zero_impedance_branch_when_configured() -> None:
    payload = _request_payload()
    payload["gridDataset"]["lines"][0]["resistancePu"] = 0.0
    payload["gridDataset"]["lines"][0]["reactancePu"] = 0.0
    payload["options"]["minBranchImpedancePu"] = 1e-5
    client = TestClient(app)
    response = client.post("/api/v1/engine/execute", json=payload)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["converged"] is True
    assert any("Clamped" in warning for warning in data["warnings"])


def test_execute_endpoint_supports_short_circuit_fault_types() -> None:
    client = TestClient(app)
    response = client.post("/api/v1/engine/execute", json=_short_circuit_payload())
    assert response.status_code == 200
    payload = response.json()
    assert payload["engineKey"] == "remote-python-short-circuit-v1"
    assert payload["summary"]["busCount"] == 2
    assert {"faultTypes", "busResults", "warnings"} <= set(payload["data"].keys())
    assert "DLG" in payload["data"]["faultTypes"]


def test_execute_endpoint_rejects_missing_zero_sequence_for_slg() -> None:
    payload = _short_circuit_payload()
    payload["gridDataset"]["lines"][0]["r0Pu"] = None
    client = TestClient(app)
    response = client.post("/api/v1/engine/execute", json=payload)
    assert response.status_code == 422
    assert "requires r0Pu and x0Pu" in response.json()["message"]
