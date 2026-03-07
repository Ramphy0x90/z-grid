from __future__ import annotations

from typing import Any

from py_engine.core.exceptions import EngineValidationError
from py_engine.engines.hosting_capacity.constraints import get_country_constraints
from py_engine.engines.hosting_capacity.models import Country
from py_engine.engines.hosting_capacity.models import DGType
from py_engine.engines.power_quality.core import estimate_power_quality_indices
from py_engine.engines.power_quality.core import estimate_short_circuit_mva


class PowerQualityEngine:
    simulation_type = "POWER_QUALITY"
    engine_key = "remote-python-power-quality-v1"
    engine_version = "v1"

    def execute(self, grid_dataset: dict[str, Any], options: dict[str, Any]) -> tuple[dict, dict]:
        config = self._parse_config(options)
        constraints = get_country_constraints(config["country"])

        slack_bus_id = self._find_slack_bus(grid_dataset)
        candidate_bus_ids = self._resolve_candidate_bus_ids(
            grid_dataset,
            slack_bus_id,
            config["target_bus_ids"],
        )
        if not candidate_bus_ids:
            raise EngineValidationError("No candidate buses for power-quality analysis.")

        bus_results: list[dict[str, Any]] = []
        pass_count = 0
        for bus_id in candidate_bus_ids:
            thd_pct, flicker_plt, unbalance_pct = estimate_power_quality_indices(
                grid_dataset,
                bus_id,
                config["dg_kw"],
                config["dg_type"],
                config["dg_power_factor"],
            )
            ssc_mva = estimate_short_circuit_mva(grid_dataset, bus_id)
            sn_mva = config["dg_kw"] / 1000.0 / max(config["dg_power_factor"], 0.1)
            ssc_sn_ratio = (
                round(ssc_mva / sn_mva, 6) if ssc_mva is not None and sn_mva > 0 else None
            )

            exceedance = {
                "THD": thd_pct / max(constraints.thd_limit_pct, 1e-9),
                "FLICKER": flicker_plt / max(constraints.flicker_plt_limit, 1e-9),
                "UNBALANCE": unbalance_pct / max(constraints.voltage_unbalance_limit_pct, 1e-9),
            }
            failed_metrics = [name for name, ratio in exceedance.items() if ratio > 1.0]
            passes = len(failed_metrics) == 0
            if passes:
                pass_count += 1
            limiting_metric = "NONE"
            if not passes:
                limiting_metric = max(exceedance.items(), key=lambda item: item[1])[0]

            bus_results.append({
                "busId": bus_id,
                "thdPct": round(thd_pct, 6),
                "flickerPlt": round(flicker_plt, 6),
                "voltageUnbalancePct": round(unbalance_pct, 6),
                "sscSnRatio": ssc_sn_ratio,
                "passes": passes,
                "failedMetrics": failed_metrics,
                "limitingMetric": limiting_metric,
            })

        summary = {
            "totalCandidateBuses": len(bus_results),
            "passCount": pass_count,
            "failCount": len(bus_results) - pass_count,
            "maxThdPct": max(item["thdPct"] for item in bus_results),
            "maxFlickerPlt": max(item["flickerPlt"] for item in bus_results),
            "maxVoltageUnbalancePct": max(item["voltageUnbalancePct"] for item in bus_results),
        }
        data = {
            "country": config["country"].value,
            "constraintsApplied": {
                "thdLimitPct": constraints.thd_limit_pct,
                "flickerPltLimit": constraints.flicker_plt_limit,
                "voltageUnbalanceLimitPct": constraints.voltage_unbalance_limit_pct,
            },
            "config": {
                "dgKw": config["dg_kw"],
                "dgType": config["dg_type"].value,
                "dgPowerFactor": config["dg_power_factor"],
            },
            "busResults": bus_results,
            "warnings": [],
        }
        return summary, data

    def _parse_config(self, options: dict[str, Any]) -> dict[str, Any]:
        country_code = str(options.get("country", "DE")).upper()
        try:
            country = Country(country_code)
        except ValueError:
            raise EngineValidationError(
                f"Unsupported country code '{country_code}'. "
                f"Supported: {[c.value for c in Country]}"
            )
        dg_type = self._parse_dg_type(options.get("dgType"))
        dg_kw = max(1.0, self._parse_float(options.get("dgKw"), field_name="dgKw", default=250.0))
        dg_power_factor = max(
            0.1,
            min(
                self._parse_float(
                    options.get("dgPowerFactor"),
                    field_name="dgPowerFactor",
                    default=1.0,
                ),
                1.0,
            ),
        )

        target_bus_ids: list[str] | None = None
        raw_target_bus_ids = options.get("targetBusIds")
        if raw_target_bus_ids is not None:
            if not isinstance(raw_target_bus_ids, list):
                raise EngineValidationError("targetBusIds must be an array of bus IDs.")
            target_bus_ids = [str(bus_id) for bus_id in raw_target_bus_ids]

        return {
            "country": country,
            "dg_kw": dg_kw,
            "dg_type": dg_type,
            "dg_power_factor": dg_power_factor,
            "target_bus_ids": target_bus_ids,
        }

    def _parse_float(self, value: Any, *, field_name: str, default: float) -> float:
        if value is None:
            return default
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise EngineValidationError(
                f"Invalid numeric value for '{field_name}': {value}"
            ) from exc

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

    def _find_slack_bus(self, dataset: dict[str, Any]) -> str:
        for bus in dataset.get("buses") or []:
            bus_type = str(bus.get("busType", "")).upper()
            if bus_type in {"SLACK", "REF", "REFERENCE", "SWING"}:
                return str(bus["id"])
        for generator in dataset.get("generators") or []:
            if generator.get("inService", True):
                return str(generator["busId"])
        raise EngineValidationError("No slack/reference bus found in the network.")

    def _resolve_candidate_bus_ids(
        self,
        dataset: dict[str, Any],
        slack_bus_id: str,
        target_bus_ids: list[str] | None,
    ) -> list[str]:
        in_service_bus_ids = {
            str(bus.get("id"))
            for bus in dataset.get("buses") or []
            if bus.get("inService", True)
        }

        if target_bus_ids is not None:
            unknown = [bus_id for bus_id in target_bus_ids if bus_id not in in_service_bus_ids]
            if unknown:
                raise EngineValidationError(
                    f"targetBusIds contains unknown or out-of-service bus IDs: {unknown}"
                )
            if slack_bus_id in target_bus_ids:
                raise EngineValidationError("targetBusIds cannot include the slack/reference bus.")
            unique_target_ids: list[str] = []
            seen: set[str] = set()
            for bus_id in target_bus_ids:
                if bus_id in seen:
                    continue
                seen.add(bus_id)
                unique_target_ids.append(bus_id)
            return unique_target_ids

        return [
            str(bus.get("id"))
            for bus in dataset.get("buses") or []
            if bus.get("inService", True) and str(bus.get("id")) != slack_bus_id
        ]
