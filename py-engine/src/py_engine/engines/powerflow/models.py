from dataclasses import dataclass


@dataclass(frozen=True)
class BusNode:
    bus_id: str
    bus_name: str
    bus_type: str
    vm_init: float
    va_init_deg: float
    v_set: float
    p_spec_pu: float
    q_spec_pu: float
    min_v: float
    max_v: float


@dataclass(frozen=True)
class BranchEdge:
    element_id: str
    element_type: str
    name: str
    from_idx: int
    to_idx: int
    resistance_pu: float
    reactance_pu: float
    shunt_susceptance_pu: float
    tap_ratio: float
    phase_shift_deg: float
    rating_mva: float
    max_loading_percent: float


@dataclass(frozen=True)
class PowerFlowCase:
    base_mva: float
    buses: list[BusNode]
    branches: list[BranchEdge]
