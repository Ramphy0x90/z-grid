import os
import uuid

import pytest

from py_engine.engines.powerflow.engine import PowerFlowEngine


def _uuid() -> str:
    return str(uuid.uuid4())


def _build_radial_dataset(node_count: int) -> dict:
    buses = []
    lines = []
    loads = []
    generators = []
    shunts = []

    bus_ids = [_uuid() for _ in range(node_count)]
    for idx, bus_id in enumerate(bus_ids):
        buses.append(
            {
                "id": bus_id,
                "name": f"Bus-{idx}",
                "busType": "SLACK" if idx == 0 else "PQ",
                "inService": True,
                "voltageMagnitudePu": 1.0,
                "voltageAngleDeg": 0.0,
                "minVoltagePu": 0.95,
                "maxVoltagePu": 1.05,
            }
        )
        if idx > 0:
            loads.append(
                {
                    "id": _uuid(),
                    "busId": bus_id,
                    "activePowerMw": 0.5,
                    "reactivePowerMvar": 0.1,
                    "inService": True,
                    "scalingFactor": 1.0,
                }
            )

    generators.append(
        {
            "id": _uuid(),
            "busId": bus_ids[0],
            "activePowerMw": max(1.0, (node_count - 1) * 0.5),
            "reactivePowerMvar": max(0.1, (node_count - 1) * 0.1),
            "voltagePu": 1.0,
            "inService": True,
        }
    )

    for idx in range(node_count - 1):
        lines.append(
            {
                "id": _uuid(),
                "name": f"L-{idx}",
                "fromBusId": bus_ids[idx],
                "toBusId": bus_ids[idx + 1],
                "resistancePu": 0.0015,
                "reactancePu": 0.006,
                "susceptancePu": 0.0,
                "fromSwitchClosed": True,
                "toSwitchClosed": True,
                "inService": True,
                "ratingMva": 10.0,
                "maxLoadingPercent": 100.0,
            }
        )

    return {
        "grid": {"baseMva": 100.0},
        "buses": buses,
        "lines": lines,
        "transformers": [],
        "loads": loads,
        "generators": generators,
        "shuntCompensators": shunts,
    }


@pytest.mark.skipif(
    os.getenv("PY_ENGINE_ENABLE_LARGE_BENCH") != "1",
    reason="Set PY_ENGINE_ENABLE_LARGE_BENCH=1 to run large-grid smoke benchmark.",
)
def test_large_grid_10000_node_smoke(benchmark) -> None:
    engine = PowerFlowEngine()
    dataset = _build_radial_dataset(10_000)

    def run():
        summary, data = engine.execute(dataset, {"maxIterations": 15, "tolerance": 1e-5})
        assert "lossesMw" in summary
        assert data["converged"] is True

    benchmark(run)
