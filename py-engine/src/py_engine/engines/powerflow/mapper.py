from __future__ import annotations

from collections import defaultdict
import math
from typing import Any

from py_engine.core.exceptions import EngineValidationError
from py_engine.engines.powerflow.models import BranchEdge
from py_engine.engines.powerflow.models import BusNode
from py_engine.engines.powerflow.models import PowerFlowCase


def _as_bool(value: Any, fallback: bool) -> bool:
    if value is None:
        return fallback
    return bool(value)


def _as_float(value: Any, fallback: float) -> float:
    if value is None:
        return fallback
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _as_text(value: Any, fallback: str) -> str:
    if value is None:
        return fallback
    return str(value)


def build_case(dataset: dict[str, Any]) -> PowerFlowCase:
    grid = dataset.get("grid", {})
    base_mva = _as_float(grid.get("baseMva"), 100.0)
    if not math.isfinite(base_mva) or base_mva <= 0.0:
        raise EngineValidationError("Power flow requires grid.baseMva to be a positive finite number.")

    buses_raw = dataset.get("buses") or []
    lines_raw = dataset.get("lines") or []
    transformers_raw = dataset.get("transformers") or []
    loads_raw = dataset.get("loads") or []
    generators_raw = dataset.get("generators") or []
    shunts_raw = dataset.get("shuntCompensators") or []

    active_buses: list[dict[str, Any]] = []
    bus_idx_by_id: dict[str, int] = {}
    for bus in buses_raw:
        if not _as_bool(bus.get("inService"), True):
            continue
        bus_id = _as_text(bus.get("id"), "").strip()
        if not bus_id:
            continue
        if bus_id in bus_idx_by_id:
            raise EngineValidationError(f"Duplicate in-service bus id detected: {bus_id}")
        bus_idx_by_id[bus_id] = len(active_buses)
        active_buses.append(bus)

    if not active_buses:
        raise EngineValidationError("Power flow requires at least one in-service bus.")

    load_p_by_bus = defaultdict(float)
    load_q_by_bus = defaultdict(float)
    for load in loads_raw:
        if not _as_bool(load.get("inService"), True):
            continue
        bus_id = _as_text(load.get("busId"), "").strip()
        if not bus_id:
            continue
        scaling = _as_float(load.get("scalingFactor"), 1.0)
        load_p_by_bus[bus_id] += _as_float(load.get("activePowerMw"), 0.0) * scaling
        load_q_by_bus[bus_id] += _as_float(load.get("reactivePowerMvar"), 0.0) * scaling

    gen_p_by_bus = defaultdict(float)
    gen_q_by_bus = defaultdict(float)
    gen_v_by_bus: dict[str, float] = {}
    in_service_gen = 0
    for gen in generators_raw:
        if not _as_bool(gen.get("inService"), True):
            continue
        bus_id = _as_text(gen.get("busId"), "").strip()
        if not bus_id:
            continue
        in_service_gen += 1
        gen_p_by_bus[bus_id] += _as_float(gen.get("activePowerMw"), 0.0)
        gen_q_by_bus[bus_id] += _as_float(gen.get("reactivePowerMvar"), 0.0)
        gen_v_by_bus.setdefault(bus_id, _as_float(gen.get("voltagePu"), 1.0))
    if in_service_gen == 0:
        raise EngineValidationError("Power flow requires at least one in-service generator.")

    shunt_q_by_bus = defaultdict(float)
    for shunt in shunts_raw:
        if not _as_bool(shunt.get("inService"), True):
            continue
        bus_id = _as_text(shunt.get("busId"), "").strip()
        if not bus_id:
            continue
        shunt_type = _as_text(shunt.get("shuntType"), "CAPACITOR").upper()
        q_mvar = abs(_as_float(shunt.get("qMvar"), 0.0))
        signed_q = -q_mvar if shunt_type == "REACTOR" else q_mvar
        shunt_q_by_bus[bus_id] += signed_q

    buses: list[BusNode] = []
    slack_count = 0
    for bus in active_buses:
        bus_id = _as_text(bus.get("id"), "")
        bus_name = _as_text(bus.get("name"), "Bus")
        bus_type = _as_text(bus.get("busType"), "PQ").upper()
        if bus_type not in {"SLACK", "PV", "PQ"}:
            bus_type = "PQ"
        if bus_type == "SLACK":
            slack_count += 1
        vm_init = _as_float(bus.get("voltageMagnitudePu"), 1.0)
        va_init_deg = _as_float(bus.get("voltageAngleDeg"), 0.0)
        v_set = gen_v_by_bus.get(bus_id, vm_init)
        min_v = _as_float(bus.get("minVoltagePu"), 0.95)
        max_v = _as_float(bus.get("maxVoltagePu"), 1.05)
        p_spec_mw = gen_p_by_bus[bus_id] - load_p_by_bus[bus_id]
        q_spec_mvar = gen_q_by_bus[bus_id] - load_q_by_bus[bus_id] + shunt_q_by_bus[bus_id]
        buses.append(
            BusNode(
                bus_id=bus_id,
                bus_name=bus_name,
                bus_type=bus_type,
                vm_init=vm_init,
                va_init_deg=va_init_deg,
                v_set=v_set,
                p_spec_pu=p_spec_mw / base_mva,
                q_spec_pu=q_spec_mvar / base_mva,
                min_v=min_v,
                max_v=max_v,
            )
        )

    if slack_count != 1:
        raise EngineValidationError("Power flow requires exactly one slack bus.")

    branches: list[BranchEdge] = []

    for line in lines_raw:
        if not _as_bool(line.get("inService"), True):
            continue
        if not _as_bool(line.get("fromSwitchClosed"), True):
            continue
        if not _as_bool(line.get("toSwitchClosed"), True):
            continue
        from_bus = _as_text(line.get("fromBusId"), "")
        to_bus = _as_text(line.get("toBusId"), "")
        if from_bus not in bus_idx_by_id or to_bus not in bus_idx_by_id:
            continue
        branches.append(
            BranchEdge(
                element_id=_as_text(line.get("id"), f"line-{len(branches)}"),
                element_type="LINE",
                name=_as_text(line.get("name"), "Line"),
                from_idx=bus_idx_by_id[from_bus],
                to_idx=bus_idx_by_id[to_bus],
                resistance_pu=_as_float(line.get("resistancePu"), 0.0),
                reactance_pu=_as_float(line.get("reactancePu"), 0.0),
                shunt_susceptance_pu=_as_float(line.get("susceptancePu"), 0.0),
                tap_ratio=1.0,
                phase_shift_deg=0.0,
                rating_mva=_as_float(line.get("ratingMva"), 0.0),
                max_loading_percent=_as_float(line.get("maxLoadingPercent"), 100.0),
            )
        )

    for tr in transformers_raw:
        if not _as_bool(tr.get("inService"), True):
            continue
        if not _as_bool(tr.get("fromSwitchClosed"), True):
            continue
        if not _as_bool(tr.get("toSwitchClosed"), True):
            continue
        from_bus = _as_text(tr.get("fromBusId"), "")
        to_bus = _as_text(tr.get("toBusId"), "")
        if from_bus not in bus_idx_by_id or to_bus not in bus_idx_by_id:
            continue
        tap = max(_as_float(tr.get("tapRatio"), 1.0), 1e-4)
        branches.append(
            BranchEdge(
                element_id=_as_text(tr.get("id"), f"tr-{len(branches)}"),
                element_type="TRANSFORMER",
                name=_as_text(tr.get("name"), "Transformer"),
                from_idx=bus_idx_by_id[from_bus],
                to_idx=bus_idx_by_id[to_bus],
                resistance_pu=_as_float(tr.get("resistancePu"), 0.0),
                reactance_pu=_as_float(tr.get("reactancePu"), 0.0),
                shunt_susceptance_pu=0.0,
                tap_ratio=tap,
                phase_shift_deg=_as_float(tr.get("phaseShiftDeg"), 0.0),
                rating_mva=_as_float(tr.get("ratingMva"), 0.0),
                max_loading_percent=_as_float(tr.get("maxLoadingPercent"), 100.0),
            )
        )

    if not branches:
        raise EngineValidationError("Power flow requires at least one in-service branch.")

    slack_index = next((idx for idx, bus in enumerate(buses) if bus.bus_type == "SLACK"), None)
    if slack_index is None:
        raise EngineValidationError("Power flow requires exactly one slack bus.")

    adjacency: list[set[int]] = [set() for _ in buses]
    for branch in branches:
        adjacency[branch.from_idx].add(branch.to_idx)
        adjacency[branch.to_idx].add(branch.from_idx)

    visited = {slack_index}
    stack = [slack_index]
    while stack:
        node = stack.pop()
        for neighbor in adjacency[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                stack.append(neighbor)

    preprocessing_warnings: list[str] = []
    if len(visited) != len(buses):
        dropped_bus_ids = [buses[idx].bus_id for idx in range(len(buses)) if idx not in visited]
        preview = ", ".join(dropped_bus_ids[:5])
        suffix = " ..." if len(dropped_bus_ids) > 5 else ""
        preprocessing_warnings.append(
            "Dropped in-service bus(es) disconnected from the slack-connected component. "
            f"Count={len(dropped_bus_ids)} ({preview}{suffix})."
        )
        old_to_new_idx: dict[int, int] = {}
        filtered_buses: list[BusNode] = []
        for old_idx, bus in enumerate(buses):
            if old_idx in visited:
                old_to_new_idx[old_idx] = len(filtered_buses)
                filtered_buses.append(bus)
        filtered_branches: list[BranchEdge] = []
        for branch in branches:
            if branch.from_idx in old_to_new_idx and branch.to_idx in old_to_new_idx:
                filtered_branches.append(
                    BranchEdge(
                        element_id=branch.element_id,
                        element_type=branch.element_type,
                        name=branch.name,
                        from_idx=old_to_new_idx[branch.from_idx],
                        to_idx=old_to_new_idx[branch.to_idx],
                        resistance_pu=branch.resistance_pu,
                        reactance_pu=branch.reactance_pu,
                        shunt_susceptance_pu=branch.shunt_susceptance_pu,
                        tap_ratio=branch.tap_ratio,
                        phase_shift_deg=branch.phase_shift_deg,
                        rating_mva=branch.rating_mva,
                        max_loading_percent=branch.max_loading_percent,
                    )
                )
        buses = filtered_buses
        branches = filtered_branches

    return PowerFlowCase(
        base_mva=base_mva,
        buses=buses,
        branches=branches,
        preprocessing_warnings=preprocessing_warnings,
    )
