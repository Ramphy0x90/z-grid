import uuid

import pytest

from py_engine.core.exceptions import EngineValidationError
from py_engine.engines.powerflow.mapper import build_case
from py_engine.engines.powerflow.solver import SolverOptions
from py_engine.engines.powerflow.solver import solve_powerflow


def _uuid() -> str:
    return str(uuid.uuid4())


def _simple_dataset() -> dict:
    slack_bus = _uuid()
    pq_bus = _uuid()
    gen_id = _uuid()
    load_id = _uuid()
    line_id = _uuid()
    return {
        "grid": {"baseMva": 100.0},
        "buses": [
            {
                "id": slack_bus,
                "name": "Slack",
                "busType": "SLACK",
                "voltageMagnitudePu": 1.0,
                "voltageAngleDeg": 0.0,
                "minVoltagePu": 0.95,
                "maxVoltagePu": 1.05,
                "inService": True,
            },
            {
                "id": pq_bus,
                "name": "PQ-1",
                "busType": "PQ",
                "voltageMagnitudePu": 1.0,
                "voltageAngleDeg": 0.0,
                "minVoltagePu": 0.95,
                "maxVoltagePu": 1.05,
                "inService": True,
            },
        ],
        "lines": [
            {
                "id": line_id,
                "name": "Line-1",
                "fromBusId": slack_bus,
                "toBusId": pq_bus,
                "resistancePu": 0.01,
                "reactancePu": 0.05,
                "susceptancePu": 0.0,
                "ratingMva": 100.0,
                "maxLoadingPercent": 100.0,
                "fromSwitchClosed": True,
                "toSwitchClosed": True,
                "inService": True,
            }
        ],
        "transformers": [],
        "loads": [
            {
                "id": load_id,
                "busId": pq_bus,
                "activePowerMw": 30.0,
                "reactivePowerMvar": 10.0,
                "scalingFactor": 1.0,
                "inService": True,
            }
        ],
        "generators": [
            {
                "id": gen_id,
                "busId": slack_bus,
                "activePowerMw": 30.0,
                "reactivePowerMvar": 10.0,
                "voltagePu": 1.0,
                "inService": True,
            }
        ],
        "shuntCompensators": [],
    }


def test_sparse_nr_solver_converges_for_simple_two_bus_case() -> None:
    case = build_case(_simple_dataset())
    result = solve_powerflow(case, SolverOptions(max_iterations=50, tolerance=1e-8))
    assert result.converged
    assert result.iterations > 0
    assert len(result.bus_results) == 2
    assert "lossesMw" in result.summary


def test_zero_impedance_branch_is_clamped_and_solver_converges() -> None:
    dataset = _simple_dataset()
    dataset["lines"][0]["resistancePu"] = 0.0
    dataset["lines"][0]["reactancePu"] = 0.0
    case = build_case(dataset)
    result = solve_powerflow(case, SolverOptions(max_iterations=50, tolerance=1e-8))
    assert result.converged
    assert any("Clamped" in message for message in result.warnings)


def test_duplicate_in_service_bus_ids_raise_validation_error() -> None:
    dataset = _simple_dataset()
    duplicate_id = dataset["buses"][0]["id"]
    dataset["buses"].append(
        {
            "id": duplicate_id,
            "name": "Duplicate",
            "busType": "PQ",
            "voltageMagnitudePu": 1.0,
            "voltageAngleDeg": 0.0,
            "minVoltagePu": 0.95,
            "maxVoltagePu": 1.05,
            "inService": True,
        }
    )
    with pytest.raises(EngineValidationError, match="Duplicate in-service bus id"):
        build_case(dataset)


def test_slack_disconnected_island_is_dropped_with_warning() -> None:
    dataset = _simple_dataset()
    island_bus = _uuid()
    dataset["buses"].append(
        {
            "id": island_bus,
            "name": "Island",
            "busType": "PQ",
            "voltageMagnitudePu": 1.0,
            "voltageAngleDeg": 0.0,
            "minVoltagePu": 0.95,
            "maxVoltagePu": 1.05,
            "inService": True,
        }
    )
    dataset["loads"].append(
        {
            "id": _uuid(),
            "busId": island_bus,
            "activePowerMw": 1.0,
            "reactivePowerMvar": 0.2,
            "scalingFactor": 1.0,
            "inService": True,
        }
    )
    case = build_case(dataset)
    assert len(case.buses) == 2
    assert len(case.branches) == 1
    assert any("Dropped in-service bus(es) disconnected" in warning for warning in case.preprocessing_warnings)
