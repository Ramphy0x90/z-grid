import uuid

from py_engine.engines.powerflow.engine import PowerFlowEngine
from py_engine.engines.short_circuit.engine import ShortCircuitEngine


def _uuid() -> str:
    return str(uuid.uuid4())


def test_powerflow_engine_returns_backend_compatible_shape() -> None:
    slack_bus = _uuid()
    pq_bus = _uuid()
    dataset = {
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
                "reactancePu": 0.06,
                "susceptancePu": 0.0,
                "fromSwitchClosed": True,
                "toSwitchClosed": True,
                "inService": True,
                "ratingMva": 90.0,
                "maxLoadingPercent": 100.0,
            }
        ],
        "transformers": [],
        "loads": [{"id": _uuid(), "busId": pq_bus, "activePowerMw": 10.0, "reactivePowerMvar": 2.5, "inService": True}],
        "generators": [{"id": _uuid(), "busId": slack_bus, "activePowerMw": 10.0, "reactivePowerMvar": 3.0, "voltagePu": 1.0, "inService": True}],
        "shuntCompensators": [],
    }

    engine = PowerFlowEngine()
    summary, data = engine.execute(dataset, {"maxIterations": 40, "tolerance": 1e-8})

    assert set(summary.keys()) == {"totalLoadMw", "totalGenerationMw", "lossesMw"}
    assert {"converged", "iterations", "summary", "busResults", "branchResults", "violations", "warnings"} <= set(data.keys())


def test_short_circuit_engine_returns_backend_compatible_shape() -> None:
    slack_bus = _uuid()
    pq_bus = _uuid()
    dataset = {
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
    }

    engine = ShortCircuitEngine()
    summary, data = engine.execute(dataset, {"faultTypes": ["3PH", "SLG", "LL", "DLG"]})

    assert {"busCount", "faultTypeCounts", "maxFaultCurrentKa", "minFaultCurrentKa"} <= set(summary.keys())
    assert {"faultTypes", "voltageFactor", "faultImpedancePu", "busResults", "warnings"} <= set(data.keys())
