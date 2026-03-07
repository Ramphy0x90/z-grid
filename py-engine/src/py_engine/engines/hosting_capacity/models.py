from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from enum import Enum


class VoltageLevel(Enum):
    LV = "LV"
    MV = "MV"
    HV = "HV"


class BranchType(Enum):
    LINE = "LINE"
    TRANSFORMER = "TRANSFORMER"


class DGType(Enum):
    PV = "PV"
    WIND = "WIND"
    BATTERY = "BATTERY"
    GENERIC = "GENERIC"


class ConstraintType(Enum):
    VOLTAGE_UPPER = "VOLTAGE_UPPER"
    VOLTAGE_LOWER = "VOLTAGE_LOWER"
    VOLTAGE_RISE = "VOLTAGE_RISE"
    THERMAL_LINE = "THERMAL_LINE"
    THERMAL_TRANSFORMER = "THERMAL_TRANSFORMER"
    SHORT_CIRCUIT = "SHORT_CIRCUIT"
    POWER_QUALITY = "POWER_QUALITY"
    NONE = "NONE"


class Country(Enum):
    SPAIN = "ES"
    SWITZERLAND = "CH"
    GERMANY = "DE"
    FRANCE = "FR"
    ITALY = "IT"
    UK = "GB"


@dataclass
class CountryConstraints:
    country: Country
    voltage_band_pu: tuple[float, float]
    voltage_rise_limit_lv_pu: float
    voltage_rise_limit_mv_pu: float
    thermal_overload_factor: float
    min_ssc_sn_ratio: float
    thd_limit_pct: float = 8.0
    flicker_plt_limit: float = 1.0
    voltage_unbalance_limit_pct: float = 2.0
    reactive_power_capability: tuple[float, float] | None = None


@dataclass
class HCConfig:
    country: Country
    candidate_bus_ids: list[str] | None = None
    dg_power_factor: float = 1.0
    dg_type: DGType = DGType.GENERIC
    search_tolerance_kw: float = 1.0
    max_dg_kw: float = 10000.0
    check_thermal: bool = True
    check_voltage: bool = True
    check_voltage_rise: bool = True
    check_short_circuit: bool = False
    check_power_quality: bool = False


@dataclass
class HCResult:
    bus_id: str
    hc_kw: float
    binding_constraint: ConstraintType
    voltage_at_hc_pu: float
    voltage_rise_at_hc_pu: float
    max_branch_loading_pct: float
    max_branch_id: str
    transformer_loading_pct: float
    ssc_sn_ratio: float | None
    all_constraints: dict[ConstraintType, float] = field(default_factory=dict)


@dataclass
class HCSummary:
    total_candidate_buses: int
    min_hc_kw: float
    max_hc_kw: float
    mean_hc_kw: float
    binding_constraint_distribution: dict[str, int]


@dataclass
class ConstraintCheckResult:
    feasible: bool
    violations: list[ConstraintType]
    bus_voltages: dict[str, float]
    branch_loadings: dict[str, float]
    branch_powers_kva: dict[str, float]
    max_branch_id: str
    max_branch_loading_pct: float
    transformer_loading_pct: float
    ssc_sn_ratio: float | None = None
