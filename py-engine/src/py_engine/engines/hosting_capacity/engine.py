from __future__ import annotations

import copy
import math
from collections import defaultdict
from typing import Any

from py_engine.core.exceptions import EngineExecutionError
from py_engine.core.exceptions import EngineValidationError
from py_engine.engines.hosting_capacity.constraints import get_country_constraints
from py_engine.engines.hosting_capacity.models import ConstraintCheckResult
from py_engine.engines.hosting_capacity.models import ConstraintType
from py_engine.engines.hosting_capacity.models import Country
from py_engine.engines.hosting_capacity.models import CountryConstraints
from py_engine.engines.hosting_capacity.models import DGType
from py_engine.engines.hosting_capacity.models import HCConfig
from py_engine.engines.hosting_capacity.models import HCResult
from py_engine.engines.hosting_capacity.models import VoltageLevel
from py_engine.engines.powerflow.engine import PowerFlowEngine
from py_engine.engines.power_quality.core import estimate_power_quality_indices as shared_estimate_power_quality_indices
from py_engine.engines.power_quality.core import estimate_short_circuit_mva as shared_estimate_short_circuit_mva


class HostingCapacityEngine:
    simulation_type = "HOSTING_CAPACITY"
    engine_key = "remote-python-hosting-capacity-v1"
    engine_version = "v1"

    def __init__(self) -> None:
        self._pf_engine = PowerFlowEngine()

    def execute(self, grid_dataset: dict[str, Any], options: dict[str, Any]) -> tuple[dict, dict]:
        config = self._parse_config(options)
        constraints = get_country_constraints(config.country)

        buses = grid_dataset.get("buses") or []
        slack_bus_id = self._find_slack_bus(grid_dataset)
        candidate_ids = self._resolve_candidates(buses, slack_bus_id, config)

        if not candidate_ids:
            raise EngineValidationError("No candidate buses for hosting capacity analysis.")

        # Base-case power flow (no additional DG)
        base_pf = self._run_power_flow(grid_dataset)
        base_voltages = self._extract_voltages(base_pf)

        # Binary search per candidate bus
        results: list[HCResult] = []
        for bus_id in candidate_ids:
            hc = self._find_hc_at_bus(grid_dataset, bus_id, base_voltages, constraints, config)
            results.append(hc)

        summary = self._compute_summary(results)
        data = self._build_output(results, summary, config, constraints)
        return summary, data

    # ── Config parsing ──────────────────────────────────────────────

    def _parse_bool(self, value: Any, *, field_name: str, default: bool) -> bool:
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "y", "on"}:
                return True
            if normalized in {"0", "false", "no", "n", "off"}:
                return False
        raise EngineValidationError(f"Invalid boolean value for '{field_name}': {value}")

    def _parse_float(self, value: Any, *, field_name: str, default: float) -> float:
        if value is None:
            return default
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise EngineValidationError(f"Invalid numeric value for '{field_name}': {value}") from exc

    def _parse_dg_type(self, value: Any) -> DGType:
        if value is None:
            return DGType.GENERIC
        normalized = str(value).strip().upper()
        try:
            return DGType(normalized)
        except ValueError as exc:
            raise EngineValidationError(
                f"Unsupported dgType '{value}'. Supported: {[t.value for t in DGType]}"
            ) from exc

    def _parse_config(self, options: dict[str, Any]) -> HCConfig:
        country_code = str(options.get("country", "DE")).upper()
        try:
            country = Country(country_code)
        except ValueError:
            raise EngineValidationError(
                f"Unsupported country code '{country_code}'. "
                f"Supported: {[c.value for c in Country]}"
            )
        candidate_bus_ids: list[str] | None = None
        raw_candidates = options.get("candidateBusIds")
        if raw_candidates is not None:
            if not isinstance(raw_candidates, list):
                raise EngineValidationError("candidateBusIds must be an array of bus IDs.")
            candidate_bus_ids = [str(bus_id) for bus_id in raw_candidates]

        return HCConfig(
            country=country,
            candidate_bus_ids=candidate_bus_ids,
            dg_power_factor=max(0.1, min(self._parse_float(options.get("dgPowerFactor"), field_name="dgPowerFactor", default=1.0), 1.0)),
            dg_type=self._parse_dg_type(options.get("dgType")),
            search_tolerance_kw=max(0.1, self._parse_float(options.get("searchToleranceKw"), field_name="searchToleranceKw", default=1.0)),
            max_dg_kw=max(1.0, self._parse_float(options.get("maxDgKw"), field_name="maxDgKw", default=10000.0)),
            check_thermal=self._parse_bool(options.get("checkThermal"), field_name="checkThermal", default=True),
            check_voltage=self._parse_bool(options.get("checkVoltage"), field_name="checkVoltage", default=True),
            check_voltage_rise=self._parse_bool(options.get("checkVoltageRise"), field_name="checkVoltageRise", default=True),
            check_short_circuit=self._parse_bool(options.get("checkShortCircuit"), field_name="checkShortCircuit", default=False),
            check_power_quality=self._parse_bool(options.get("checkPowerQuality"), field_name="checkPowerQuality", default=False),
        )

    # ── Bus helpers ─────────────────────────────────────────────────

    def _find_slack_bus(self, dataset: dict[str, Any]) -> str:
        for bus in dataset.get("buses") or []:
            bus_type = str(bus.get("busType", "")).upper()
            if bus_type in {"SLACK", "REF", "REFERENCE", "SWING"}:
                return str(bus["id"])
        for gen in dataset.get("generators") or []:
            if gen.get("inService", True):
                return str(gen["busId"])
        raise EngineValidationError("No slack/reference bus found in the network.")

    def _resolve_candidates(self, buses: list[dict], slack_bus_id: str, config: HCConfig) -> list[str]:
        if config.candidate_bus_ids is not None:
            in_service_bus_ids = {
                str(bus.get("id"))
                for bus in buses
                if bus.get("inService", True)
            }
            unknown = [bus_id for bus_id in config.candidate_bus_ids if bus_id not in in_service_bus_ids]
            if unknown:
                raise EngineValidationError(
                    f"candidateBusIds contains unknown or out-of-service bus IDs: {unknown}"
                )
            if slack_bus_id in config.candidate_bus_ids:
                raise EngineValidationError("candidateBusIds cannot include the slack/reference bus.")
            # Keep deterministic ordering while removing duplicates.
            seen: set[str] = set()
            unique_candidates: list[str] = []
            for bus_id in config.candidate_bus_ids:
                if bus_id not in seen:
                    seen.add(bus_id)
                    unique_candidates.append(bus_id)
            return unique_candidates
        candidates = []
        for bus in buses:
            if not bus.get("inService", True):
                continue
            bus_id = str(bus["id"])
            if bus_id == slack_bus_id:
                continue
            candidates.append(bus_id)
        return candidates

    def _get_voltage_level(self, bus: dict) -> VoltageLevel:
        explicit = str(bus.get("voltageLevel", "")).upper()
        if explicit in {"LV", "MV", "HV"}:
            return VoltageLevel(explicit)
        kv = float(bus.get("nominalVoltageKv", 0.0))
        if kv <= 1.0:
            return VoltageLevel.LV
        if kv <= 35.0:
            return VoltageLevel.MV
        return VoltageLevel.HV

    def _find_bus_dict(self, dataset: dict[str, Any], bus_id: str) -> dict:
        for bus in dataset.get("buses") or []:
            if str(bus.get("id")) == bus_id:
                return bus
        raise EngineValidationError(f"Bus {bus_id} not found in network.")

    # ── Power flow wrapper ──────────────────────────────────────────

    def _run_power_flow(self, dataset: dict[str, Any]) -> dict[str, Any]:
        try:
            _summary, data = self._pf_engine.execute(dataset, {})
        except Exception as exc:
            raise EngineExecutionError(f"Power flow failed: {exc}") from exc
        if not data.get("converged", False):
            raise EngineExecutionError("Power flow did not converge.")
        return data

    def _extract_voltages(self, pf_data: dict[str, Any]) -> dict[str, float]:
        voltages: dict[str, float] = {}
        for bus_result in pf_data.get("busResults") or []:
            bus_id = str(bus_result["busId"])
            voltages[bus_id] = float(
                bus_result.get("voltageMagnitudePu", bus_result.get("voltagePu", 1.0))
            )
        return voltages

    # ── DG injection ────────────────────────────────────────────────

    def _inject_dg(self, dataset: dict[str, Any], bus_id: str, dg_kw: float, power_factor: float) -> dict[str, Any]:
        modified = copy.deepcopy(dataset)
        dg_kvar = dg_kw * math.tan(math.acos(power_factor)) if power_factor < 1.0 else 0.0
        generators = modified.get("generators") or []
        generators.append({
            "id": f"__hc_dg_{bus_id}",
            "name": f"HC DG at {bus_id}",
            "busId": bus_id,
            "inService": True,
            "activePowerMw": dg_kw / 1000.0,
            "reactivePowerMvar": dg_kvar / 1000.0,
            "busType": "PQ",
        })
        modified["generators"] = generators
        return modified

    def _estimate_power_quality_indices(
        self,
        dataset: dict[str, Any],
        bus_id: str,
        dg_kw: float,
        config: HCConfig,
    ) -> tuple[float, float, float]:
        return shared_estimate_power_quality_indices(
            dataset,
            bus_id,
            dg_kw,
            config.dg_type,
            config.dg_power_factor,
        )

    # ── Constraint checking ─────────────────────────────────────────

    def _check_constraints(
        self,
        dataset: dict[str, Any],
        bus_id: str,
        dg_kw: float,
        base_voltages: dict[str, float],
        constraints: CountryConstraints,
        config: HCConfig,
    ) -> ConstraintCheckResult:
        if dg_kw > 0:
            modified = self._inject_dg(dataset, bus_id, dg_kw, config.dg_power_factor)
        else:
            modified = dataset

        try:
            pf_data = self._run_power_flow(modified)
        except EngineExecutionError:
            return ConstraintCheckResult(
                feasible=False,
                violations=[],
                bus_voltages={},
                branch_loadings={},
                branch_powers_kva={},
                max_branch_id="",
                max_branch_loading_pct=0.0,
                transformer_loading_pct=0.0,
                ssc_sn_ratio=None,
            )

        voltages = self._extract_voltages(pf_data)
        violations: list[ConstraintType] = []

        # Voltage band
        if config.check_voltage:
            v_lower, v_upper = constraints.voltage_band_pu
            for v_pu in voltages.values():
                if v_pu > v_upper:
                    violations.append(ConstraintType.VOLTAGE_UPPER)
                    break
                if v_pu < v_lower:
                    violations.append(ConstraintType.VOLTAGE_LOWER)
                    break

        # Voltage rise
        if config.check_voltage_rise and bus_id in voltages and bus_id in base_voltages:
            bus_dict = self._find_bus_dict(dataset, bus_id)
            vlevel = self._get_voltage_level(bus_dict)
            v_rise = voltages[bus_id] - base_voltages[bus_id]
            limit = (
                constraints.voltage_rise_limit_lv_pu
                if vlevel == VoltageLevel.LV
                else constraints.voltage_rise_limit_mv_pu
            )
            if v_rise > limit:
                violations.append(ConstraintType.VOLTAGE_RISE)

        # Thermal
        max_br_id = ""
        max_loading = 0.0
        tf_loading = 0.0
        loadings: dict[str, float] = {}
        powers: dict[str, float] = {}
        for br in pf_data.get("branchResults") or []:
            br_id = str(br.get("elementId", br.get("branchId", "")))
            loading = float(br.get("loadingPercent", 0.0))
            if br.get("apparentPowerMva") is not None:
                power = float(br.get("apparentPowerMva", 0.0)) * 1000.0
            else:
                s_from = math.hypot(float(br.get("pFromMw", 0.0)), float(br.get("qFromMvar", 0.0)))
                s_to = math.hypot(float(br.get("pToMw", 0.0)), float(br.get("qToMvar", 0.0)))
                power = max(s_from, s_to) * 1000.0
            loadings[br_id] = loading
            powers[br_id] = power
            if loading > max_loading:
                max_loading = loading
                max_br_id = br_id
            el_type = str(br.get("elementType", "")).upper()
            if el_type == "TRANSFORMER":
                tf_loading = max(tf_loading, loading)
            if config.check_thermal:
                limit_pct = 100.0 * constraints.thermal_overload_factor
                if loading > limit_pct:
                    ct = ConstraintType.THERMAL_TRANSFORMER if el_type == "TRANSFORMER" else ConstraintType.THERMAL_LINE
                    if ct not in violations:
                        violations.append(ct)

        # Short-circuit ratio
        ssc_sn_ratio: float | None = None
        if dg_kw > 0:
            ssc = self._estimate_short_circuit_mva(dataset, bus_id)
            sn = dg_kw / 1000.0 / config.dg_power_factor
            if ssc is not None and sn > 0:
                ssc_sn_ratio = ssc / sn
                if config.check_short_circuit and ssc_sn_ratio < constraints.min_ssc_sn_ratio:
                    violations.append(ConstraintType.SHORT_CIRCUIT)

        # Power quality (simplified deterministic v1 proxy)
        if config.check_power_quality:
            thd_pct, flicker_plt, unbalance_pct = self._estimate_power_quality_indices(
                dataset,
                bus_id,
                dg_kw,
                config,
            )
            if (
                thd_pct > constraints.thd_limit_pct
                or flicker_plt > constraints.flicker_plt_limit
                or unbalance_pct > constraints.voltage_unbalance_limit_pct
            ):
                violations.append(ConstraintType.POWER_QUALITY)

        return ConstraintCheckResult(
            feasible=len(violations) == 0,
            violations=violations,
            bus_voltages=voltages,
            branch_loadings=loadings,
            branch_powers_kva=powers,
            max_branch_id=max_br_id,
            max_branch_loading_pct=max_loading,
            transformer_loading_pct=tf_loading,
            ssc_sn_ratio=ssc_sn_ratio,
        )

    def _estimate_short_circuit_mva(self, dataset: dict[str, Any], bus_id: str) -> float | None:
        return shared_estimate_short_circuit_mva(dataset, bus_id)

    # ── Binary search ───────────────────────────────────────────────

    def _find_hc_at_bus(
        self,
        dataset: dict[str, Any],
        bus_id: str,
        base_voltages: dict[str, float],
        constraints: CountryConstraints,
        config: HCConfig,
        *,
        include_per_constraint: bool = True,
    ) -> HCResult:
        p_low = 0.0
        p_high = config.max_dg_kw
        tolerance = config.search_tolerance_kw

        # Quick check: max DG feasible?
        high_check = self._check_constraints(dataset, bus_id, p_high, base_voltages, constraints, config)
        if high_check.feasible:
            result = self._build_result(bus_id, p_high, ConstraintType.NONE, high_check, base_voltages)
            if include_per_constraint:
                result.all_constraints = self._compute_per_constraint_hc(
                    dataset, bus_id, base_voltages, constraints, config
                )
            return result

        # Quick check: zero DG infeasible?
        low_check = self._check_constraints(dataset, bus_id, p_low, base_voltages, constraints, config)
        if not low_check.feasible:
            binding = low_check.violations[0] if low_check.violations else ConstraintType.NONE
            result = self._build_result(bus_id, 0.0, binding, low_check, base_voltages)
            if include_per_constraint:
                result.all_constraints = self._compute_per_constraint_hc(
                    dataset, bus_id, base_voltages, constraints, config
                )
            return result

        last_feasible = low_check
        while (p_high - p_low) > tolerance:
            p_mid = (p_low + p_high) / 2.0
            result = self._check_constraints(dataset, bus_id, p_mid, base_voltages, constraints, config)
            if result.feasible:
                p_low = p_mid
                last_feasible = result
            else:
                p_high = p_mid

        # Binding constraint from first infeasible point
        binding_check = self._check_constraints(dataset, bus_id, p_high, base_voltages, constraints, config)
        binding = binding_check.violations[0] if binding_check.violations else ConstraintType.NONE

        result = self._build_result(bus_id, p_low, binding, last_feasible, base_voltages)
        if include_per_constraint:
            result.all_constraints = self._compute_per_constraint_hc(
                dataset, bus_id, base_voltages, constraints, config
            )
        return result

    def _single_constraint_config(self, config: HCConfig, ctype: ConstraintType) -> HCConfig:
        return HCConfig(
            country=config.country,
            candidate_bus_ids=config.candidate_bus_ids,
            dg_power_factor=config.dg_power_factor,
            dg_type=config.dg_type,
            search_tolerance_kw=config.search_tolerance_kw,
            max_dg_kw=config.max_dg_kw,
            check_thermal=ctype in {ConstraintType.THERMAL_LINE, ConstraintType.THERMAL_TRANSFORMER},
            check_voltage=ctype in {ConstraintType.VOLTAGE_UPPER, ConstraintType.VOLTAGE_LOWER},
            check_voltage_rise=ctype == ConstraintType.VOLTAGE_RISE,
            check_short_circuit=ctype == ConstraintType.SHORT_CIRCUIT,
            check_power_quality=ctype == ConstraintType.POWER_QUALITY,
        )

    def _compute_per_constraint_hc(
        self,
        dataset: dict[str, Any],
        bus_id: str,
        base_voltages: dict[str, float],
        constraints: CountryConstraints,
        config: HCConfig,
    ) -> dict[ConstraintType, float]:
        per_constraint: dict[ConstraintType, float] = {}
        for ctype in (
            ConstraintType.VOLTAGE_UPPER,
            ConstraintType.VOLTAGE_RISE,
            ConstraintType.THERMAL_LINE,
            ConstraintType.THERMAL_TRANSFORMER,
            ConstraintType.SHORT_CIRCUIT,
            ConstraintType.POWER_QUALITY,
        ):
            single_cfg = self._single_constraint_config(config, ctype)
            hc_result = self._find_hc_at_bus(
                dataset,
                bus_id,
                base_voltages,
                constraints,
                single_cfg,
                include_per_constraint=False,
            )
            per_constraint[ctype] = hc_result.hc_kw
        return per_constraint

    def _build_result(
        self,
        bus_id: str,
        hc_kw: float,
        binding: ConstraintType,
        check: ConstraintCheckResult,
        base_voltages: dict[str, float],
    ) -> HCResult:
        v_at_hc = check.bus_voltages.get(bus_id, 1.0)
        v_base = base_voltages.get(bus_id, 1.0)
        return HCResult(
            bus_id=bus_id,
            hc_kw=round(hc_kw, 2),
            binding_constraint=binding,
            voltage_at_hc_pu=round(v_at_hc, 6),
            voltage_rise_at_hc_pu=round(v_at_hc - v_base, 6),
            max_branch_loading_pct=round(check.max_branch_loading_pct, 2),
            max_branch_id=check.max_branch_id,
            transformer_loading_pct=round(check.transformer_loading_pct, 2),
            ssc_sn_ratio=round(check.ssc_sn_ratio, 6) if check.ssc_sn_ratio is not None else None,
        )

    # ── Summary & output ────────────────────────────────────────────

    def _compute_summary(self, results: list[HCResult]) -> dict[str, Any]:
        hc_values = [r.hc_kw for r in results]
        dist: dict[str, int] = defaultdict(int)
        for r in results:
            dist[r.binding_constraint.value] += 1
        return {
            "totalCandidateBuses": len(results),
            "minHcKw": min(hc_values) if hc_values else 0.0,
            "maxHcKw": max(hc_values) if hc_values else 0.0,
            "meanHcKw": round(sum(hc_values) / len(hc_values), 2) if hc_values else 0.0,
            "bindingConstraintDistribution": dict(dist),
        }

    def _build_output(
        self,
        results: list[HCResult],
        summary: dict[str, Any],
        config: HCConfig,
        constraints: CountryConstraints,
    ) -> dict[str, Any]:
        return {
            "country": config.country.value,
            "constraintsApplied": {
                "voltageBandPu": list(constraints.voltage_band_pu),
                "voltageRiseLimitLvPu": constraints.voltage_rise_limit_lv_pu,
                "voltageRiseLimitMvPu": constraints.voltage_rise_limit_mv_pu,
                "thermalOverloadFactor": constraints.thermal_overload_factor,
                "minSscSnRatio": constraints.min_ssc_sn_ratio,
            },
            "config": {
                "dgPowerFactor": config.dg_power_factor,
                "dgType": config.dg_type.value,
                "searchToleranceKw": config.search_tolerance_kw,
                "maxDgKw": config.max_dg_kw,
                "checkThermal": config.check_thermal,
                "checkVoltage": config.check_voltage,
                "checkVoltageRise": config.check_voltage_rise,
                "checkShortCircuit": config.check_short_circuit,
                "checkPowerQuality": config.check_power_quality,
            },
            "busResults": [
                {
                    "busId": r.bus_id,
                    "hcKw": r.hc_kw,
                    "bindingConstraint": r.binding_constraint.value,
                    "voltageAtHcPu": r.voltage_at_hc_pu,
                    "voltageRiseAtHcPu": r.voltage_rise_at_hc_pu,
                    "maxBranchLoadingPct": r.max_branch_loading_pct,
                    "maxBranchId": r.max_branch_id,
                    "transformerLoadingPct": r.transformer_loading_pct,
                    "sscSnRatio": r.ssc_sn_ratio,
                    "allConstraints": {k.value: v for k, v in r.all_constraints.items()},
                }
                for r in results
            ],
            "warnings": [],
        }
