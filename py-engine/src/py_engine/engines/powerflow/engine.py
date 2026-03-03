from __future__ import annotations

from typing import Any

from py_engine.engines.powerflow.mapper import build_case
from py_engine.engines.powerflow.solver import SolverOptions
from py_engine.engines.powerflow.solver import solve_powerflow


class PowerFlowEngine:
    simulation_type = "POWER_FLOW"
    engine_key = "remote-python-powerflow-v1"
    engine_version = "v1"

    def execute(self, grid_dataset: dict[str, Any], options: dict[str, Any]) -> tuple[dict, dict]:
        case = build_case(grid_dataset)
        solver_options = SolverOptions(
            max_iterations=max(5, min(int(options.get("maxIterations", 30)), 200)),
            tolerance=max(1e-10, min(float(options.get("tolerance", 1e-6)), 1e-2)),
            min_voltage_pu=max(0.4, min(float(options.get("minVoltagePu", 0.5)), 0.95)),
            max_voltage_pu=max(1.05, min(float(options.get("maxVoltagePu", 1.5)), 2.0)),
        )
        result = solve_powerflow(case, solver_options)
        data = {
            "converged": result.converged,
            "iterations": result.iterations,
            "summary": result.summary,
            "busResults": result.bus_results,
            "branchResults": result.branch_results,
            "violations": {
                "voltage": result.voltage_violations,
                "thermal": result.thermal_violations,
            },
            "warnings": result.warnings,
        }
        return result.summary, data
