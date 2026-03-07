from __future__ import annotations

from typing import Any

from py_engine.engines.hosting_capacity.models import DGType


def estimate_short_circuit_mva(dataset: dict[str, Any], bus_id: str) -> float | None:
    for bus in dataset.get("buses") or []:
        if str(bus.get("id")) != bus_id:
            continue
        ssc = bus.get("shortCircuitPowerMva")
        if ssc is not None:
            return float(ssc)
        nominal_kv = float(bus.get("nominalVoltageKv", 0.0))
        if nominal_kv <= 0:
            return None
        return float((dataset.get("grid") or {}).get("baseMva", 100.0))
    return None


def estimate_bus_load_kw(dataset: dict[str, Any], bus_id: str) -> float:
    total_kw = 0.0
    for load in dataset.get("loads") or []:
        if str(load.get("busId")) != bus_id:
            continue
        if not load.get("inService", True):
            continue
        scaling = float(load.get("scalingFactor", 1.0))
        total_kw += float(load.get("activePowerMw", 0.0)) * scaling * 1000.0
    return max(total_kw, 0.0)


def estimate_power_quality_indices(
    dataset: dict[str, Any],
    bus_id: str,
    dg_kw: float,
    dg_type: DGType,
    dg_power_factor: float,
) -> tuple[float, float, float]:
    if dg_kw <= 0:
        return (0.0, 0.0, 0.0)

    sn_mva = dg_kw / 1000.0 / max(dg_power_factor, 0.1)
    ssc_mva = estimate_short_circuit_mva(dataset, bus_id)
    if ssc_mva is None or sn_mva <= 0:
        return (float("inf"), float("inf"), float("inf"))

    ssc_sn_ratio = ssc_mva / sn_mva
    load_kw = estimate_bus_load_kw(dataset, bus_id)
    dg_to_load_ratio = dg_kw / max(load_kw, 100.0)

    thd_factor_by_type = {
        DGType.PV: 1.0,
        DGType.WIND: 1.15,
        DGType.BATTERY: 0.85,
        DGType.GENERIC: 1.0,
    }
    flicker_factor_by_type = {
        DGType.PV: 0.35,
        DGType.WIND: 0.55,
        DGType.BATTERY: 0.25,
        DGType.GENERIC: 0.40,
    }
    unbalance_factor_by_type = {
        DGType.PV: 0.25,
        DGType.WIND: 0.20,
        DGType.BATTERY: 0.15,
        DGType.GENERIC: 0.20,
    }

    thd_pct = (200.0 / max(ssc_sn_ratio, 1e-6)) * thd_factor_by_type[dg_type]
    flicker_plt = dg_to_load_ratio * flicker_factor_by_type[dg_type]
    unbalance_pct = dg_to_load_ratio * 100.0 * unbalance_factor_by_type[dg_type]
    return (thd_pct, flicker_plt, unbalance_pct)
