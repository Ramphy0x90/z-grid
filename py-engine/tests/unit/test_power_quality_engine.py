from __future__ import annotations

import pytest

from py_engine.engines.power_quality.engine import PowerQualityEngine


def _make_dataset() -> dict:
    return {
        "grid": {"baseMva": 100.0},
        "buses": [
            {
                "id": "slack",
                "name": "Slack",
                "busType": "SLACK",
                "inService": True,
                "nominalVoltageKv": 20.0,
            },
            {
                "id": "bus1",
                "name": "Bus 1",
                "busType": "PQ",
                "inService": True,
                "nominalVoltageKv": 0.4,
                "shortCircuitPowerMva": 20.0,
            },
            {
                "id": "bus2",
                "name": "Bus 2",
                "busType": "PQ",
                "inService": True,
                "nominalVoltageKv": 0.4,
                "shortCircuitPowerMva": 5.0,
            },
        ],
        "generators": [{"id": "gen1", "busId": "slack", "inService": True}],
        "loads": [
            {
                "id": "load1",
                "busId": "bus1",
                "inService": True,
                "activePowerMw": 0.5,
                "reactivePowerMvar": 0.05,
                "scalingFactor": 1.0,
            },
            {
                "id": "load2",
                "busId": "bus2",
                "inService": True,
                "activePowerMw": 0.1,
                "reactivePowerMvar": 0.01,
                "scalingFactor": 1.0,
            },
        ],
        "lines": [],
        "transformers": [],
    }


def test_power_quality_engine_returns_expected_shape() -> None:
    engine = PowerQualityEngine()
    summary, data = engine.execute(
        _make_dataset(),
        {
            "country": "DE",
            "dgKw": 250.0,
            "dgType": "PV",
            "dgPowerFactor": 0.95,
        },
    )

    assert set(summary.keys()) == {
        "totalCandidateBuses",
        "passCount",
        "failCount",
        "maxThdPct",
        "maxFlickerPlt",
        "maxVoltageUnbalancePct",
    }
    assert data["country"] == "DE"
    assert len(data["busResults"]) == 2
    assert {"thdPct", "flickerPlt", "voltageUnbalancePct", "passes", "limitingMetric"} <= set(
        data["busResults"][0].keys()
    )


def test_power_quality_engine_can_fail_on_weak_bus() -> None:
    engine = PowerQualityEngine()
    _summary, data = engine.execute(
        _make_dataset(),
        {
            "country": "DE",
            "dgKw": 1000.0,
            "dgType": "WIND",
            "dgPowerFactor": 1.0,
        },
    )
    bus2 = next(item for item in data["busResults"] if item["busId"] == "bus2")
    assert bus2["passes"] is False
    assert bus2["limitingMetric"] in {"THD", "FLICKER", "UNBALANCE"}


def test_power_quality_engine_rejects_invalid_target_bus() -> None:
    engine = PowerQualityEngine()
    with pytest.raises(Exception, match="targetBusIds contains unknown"):
        engine.execute(
            _make_dataset(),
            {"country": "DE", "targetBusIds": ["missing"]},
        )
