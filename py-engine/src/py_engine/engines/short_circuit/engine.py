from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.linalg import LinAlgError

from py_engine.core.exceptions import EngineExecutionError
from py_engine.core.exceptions import EngineValidationError


@dataclass(frozen=True)
class _Bus:
    idx: int
    bus_id: str
    bus_name: str
    nominal_kv: float


class ShortCircuitEngine:
    simulation_type = "SHORT_CIRCUIT"
    engine_key = "remote-python-short-circuit-v1"
    engine_version = "v1"

    def execute(self, grid_dataset: dict[str, Any], options: dict[str, Any]) -> tuple[dict, dict]:
        buses, bus_idx_by_id = self._collect_buses(grid_dataset)
        fault_types = self._parse_fault_types(options)
        ground_fault_requested = any(ft in {"SLG", "DLG"} for ft in fault_types)
        self._validate_strict_grounding(grid_dataset, ground_fault_requested)

        y1, y2, y0, warnings = self._build_sequence_networks(grid_dataset, buses, bus_idx_by_id, ground_fault_requested)
        z1 = self._invert(y1, "positive-sequence")
        z2 = self._invert(y2, "negative-sequence")
        z0 = self._invert(y0, "zero-sequence") if ground_fault_requested else None

        zf = complex(self._as_float(options.get("faultResistancePu"), 0.0), self._as_float(options.get("faultReactancePu"), 0.0))
        vf = max(0.5, min(self._as_float(options.get("voltageFactor"), 1.0), 1.2))
        target_bus_ids = self._parse_target_bus_ids(options, bus_idx_by_id)

        bus_results: list[dict[str, Any]] = []
        max_ik = 0.0
        min_ik = float("inf")
        counts = defaultdict(int)
        for bus in buses:
            if target_bus_ids is not None and bus.bus_id not in target_bus_ids:
                continue
            bus_faults: dict[str, dict[str, float]] = {}
            base_ka = self._base_current_ka(grid_dataset, bus.nominal_kv)
            z1_th = z1[bus.idx, bus.idx]
            z2_th = z2[bus.idx, bus.idx]
            z0_th = z0[bus.idx, bus.idx] if z0 is not None else None
            for fault_type in fault_types:
                ik_pu = self._fault_current_pu(fault_type, z1_th, z2_th, z0_th, zf, vf)
                ik_ka = abs(ik_pu) * base_ka
                sk_mva = math.sqrt(3.0) * bus.nominal_kv * ik_ka
                bus_faults[fault_type] = {"ikssKa": ik_ka, "skssMva": sk_mva}
                max_ik = max(max_ik, ik_ka)
                min_ik = min(min_ik, ik_ka)
                counts[fault_type] += 1
            bus_results.append(
                {
                    "busId": bus.bus_id,
                    "busName": bus.bus_name,
                    "nominalVoltageKv": bus.nominal_kv,
                    "faults": bus_faults,
                    "maxIkssKa": max(value["ikssKa"] for value in bus_faults.values()) if bus_faults else 0.0,
                }
            )

        if "DLG" in fault_types:
            warnings.append("DLG is computed using sequence-equivalent approximation from Z1/Z2/Z0.")

        summary = {
            "busCount": len(bus_results),
            "faultTypeCounts": dict(counts),
            "maxFaultCurrentKa": max_ik,
            "minFaultCurrentKa": 0.0 if min_ik == float("inf") else min_ik,
        }
        data = {
            "faultTypes": fault_types,
            "voltageFactor": vf,
            "faultImpedancePu": {"r": zf.real, "x": zf.imag},
            "busResults": bus_results,
            "warnings": warnings,
        }
        return summary, data

    def _collect_buses(self, dataset: dict[str, Any]) -> tuple[list[_Bus], dict[str, int]]:
        buses_raw = dataset.get("buses") or []
        buses: list[_Bus] = []
        idx_by_id: dict[str, int] = {}
        for raw in buses_raw:
            if not self._as_bool(raw.get("inService"), True):
                continue
            bus_id = self._as_text(raw.get("id"), "").strip()
            if not bus_id:
                continue
            if bus_id in idx_by_id:
                raise EngineValidationError(f"Duplicate in-service bus id detected: {bus_id}")
            kv = self._as_float(raw.get("nominalVoltageKv"), 0.0)
            if not math.isfinite(kv) or kv <= 0.0:
                raise EngineValidationError(f"Bus {bus_id} requires positive nominalVoltageKv for short-circuit.")
            idx = len(buses)
            buses.append(_Bus(idx=idx, bus_id=bus_id, bus_name=self._as_text(raw.get("name"), bus_id), nominal_kv=kv))
            idx_by_id[bus_id] = idx
        if not buses:
            raise EngineValidationError("Short-circuit requires at least one in-service bus.")
        return buses, idx_by_id

    def _parse_fault_types(self, options: dict[str, Any]) -> list[str]:
        raw = options.get("faultTypes", ["3PH"])
        if not isinstance(raw, list):
            raise EngineValidationError("options.faultTypes must be a list.")
        normalized: list[str] = []
        supported = {"3PH", "SLG", "LL", "DLG"}
        for item in raw:
            key = self._as_text(item, "").strip().upper()
            if key not in supported:
                raise EngineValidationError(f"Unsupported fault type '{item}'. Supported: {sorted(supported)}")
            if key not in normalized:
                normalized.append(key)
        if not normalized:
            normalized = ["3PH"]
        return normalized

    def _parse_target_bus_ids(self, options: dict[str, Any], idx_by_id: dict[str, int]) -> set[str] | None:
        raw = options.get("targetBusIds")
        if raw is None:
            return None
        if not isinstance(raw, list):
            raise EngineValidationError("options.targetBusIds must be a list when provided.")
        target: set[str] = set()
        for item in raw:
            bus_id = self._as_text(item, "").strip()
            if bus_id not in idx_by_id:
                raise EngineValidationError(f"Unknown target bus id in options.targetBusIds: {bus_id}")
            target.add(bus_id)
        return target

    def _validate_strict_grounding(self, dataset: dict[str, Any], require_zero_sequence: bool) -> None:
        if not require_zero_sequence:
            return
        lines = dataset.get("lines") or []
        transformers = dataset.get("transformers") or []
        generators = dataset.get("generators") or []
        for line in lines:
            if not self._as_bool(line.get("inService"), True):
                continue
            line_id = self._as_text(line.get("id"), "line")
            if line.get("r0Pu") is None or line.get("x0Pu") is None:
                raise EngineValidationError(f"Line {line_id} requires r0Pu and x0Pu for SLG/DLG.")
        grounded_sources = 0
        for tr in transformers:
            if not self._as_bool(tr.get("inService"), True):
                continue
            tr_id = self._as_text(tr.get("id"), "transformer")
            if tr.get("r0Pu") is None or tr.get("x0Pu") is None:
                raise EngineValidationError(f"Transformer {tr_id} requires r0Pu and x0Pu for SLG/DLG.")
            if not self._as_text(tr.get("vectorGroup"), "").strip():
                raise EngineValidationError(f"Transformer {tr_id} requires vectorGroup for SLG/DLG.")
            hv_gnd = self._as_text(tr.get("hvNeutralGrounding"), "").strip().upper()
            lv_gnd = self._as_text(tr.get("lvNeutralGrounding"), "").strip().upper()
            if hv_gnd not in {"", "UNGROUNDED"} or lv_gnd not in {"", "UNGROUNDED"}:
                grounded_sources += 1
        for gen in generators:
            if not self._as_bool(gen.get("inService"), True):
                continue
            gen_id = self._as_text(gen.get("id"), "generator")
            if gen.get("x0Pu") is None:
                raise EngineValidationError(f"Generator {gen_id} requires x0Pu for SLG/DLG.")
            is_grounded = bool(gen.get("neutralGrounded"))
            if is_grounded:
                grounded_sources += 1
                if gen.get("neutralResistancePu") is None or gen.get("neutralReactancePu") is None:
                    raise EngineValidationError(
                        f"Generator {gen_id} requires neutralResistancePu and neutralReactancePu when neutralGrounded=true."
                    )
        if grounded_sources == 0:
            raise EngineValidationError("SLG/DLG requires at least one grounded source/neutral in the active network.")

    def _build_sequence_networks(
        self, dataset: dict[str, Any], buses: list[_Bus], idx_by_id: dict[str, int], include_zero_sequence: bool
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[str]]:
        n = len(buses)
        y1 = np.zeros((n, n), dtype=complex)
        y2 = np.zeros((n, n), dtype=complex)
        y0 = np.zeros((n, n), dtype=complex)
        warnings: list[str] = []

        def add_branch(matrix: np.ndarray, i: int, j: int, z: complex, y_shunt: complex = 0j) -> None:
            if abs(z) <= 1e-12:
                raise EngineValidationError("Encountered near-zero branch impedance in short-circuit model.")
            y = 1.0 / z
            matrix[i, i] += y + y_shunt / 2.0
            matrix[j, j] += y + y_shunt / 2.0
            matrix[i, j] -= y
            matrix[j, i] -= y

        for line in dataset.get("lines") or []:
            if not self._as_bool(line.get("inService"), True):
                continue
            if not self._as_bool(line.get("fromSwitchClosed"), True) or not self._as_bool(line.get("toSwitchClosed"), True):
                continue
            fb = self._as_text(line.get("fromBusId"), "")
            tb = self._as_text(line.get("toBusId"), "")
            if fb not in idx_by_id or tb not in idx_by_id:
                continue
            i = idx_by_id[fb]
            j = idx_by_id[tb]
            z1 = complex(self._as_float(line.get("resistancePu"), 0.0), self._as_float(line.get("reactancePu"), 0.0))
            y1_sh = 1j * self._as_float(line.get("susceptancePu"), 0.0)
            add_branch(y1, i, j, z1, y1_sh)
            add_branch(y2, i, j, z1, y1_sh)
            if include_zero_sequence:
                z0 = complex(self._as_float(line.get("r0Pu"), 0.0), self._as_float(line.get("x0Pu"), 0.0))
                y0_sh = 1j * self._as_float(line.get("b0Pu"), 0.0)
                add_branch(y0, i, j, z0, y0_sh)

        for tr in dataset.get("transformers") or []:
            if not self._as_bool(tr.get("inService"), True):
                continue
            if not self._as_bool(tr.get("fromSwitchClosed"), True) or not self._as_bool(tr.get("toSwitchClosed"), True):
                continue
            fb = self._as_text(tr.get("fromBusId"), "")
            tb = self._as_text(tr.get("toBusId"), "")
            if fb not in idx_by_id or tb not in idx_by_id:
                continue
            i = idx_by_id[fb]
            j = idx_by_id[tb]
            z1 = complex(self._as_float(tr.get("resistancePu"), 0.0), self._as_float(tr.get("reactancePu"), 0.0))
            add_branch(y1, i, j, z1)
            add_branch(y2, i, j, z1)
            if include_zero_sequence:
                z0 = complex(self._as_float(tr.get("r0Pu"), 0.0), self._as_float(tr.get("x0Pu"), 0.0))
                vector_group = self._as_text(tr.get("vectorGroup"), "").upper()
                if "D" in vector_group and "Y" in vector_group:
                    # Delta side blocks zero-sequence transfer. Model grounded wye side via neutral admittance only.
                    warnings.append(
                        f"Transformer {self._as_text(tr.get('id'), 'transformer')} has delta-wye vector group; "
                        "zero-sequence transfer is represented via grounded neutral shunt only."
                    )
                else:
                    add_branch(y0, i, j, z0)
                self._add_neutral_shunt(
                    y0,
                    i,
                    self._as_text(tr.get("hvNeutralGrounding"), ""),
                    tr.get("hvNeutralResistancePu"),
                    tr.get("hvNeutralReactancePu"),
                )
                self._add_neutral_shunt(
                    y0,
                    j,
                    self._as_text(tr.get("lvNeutralGrounding"), ""),
                    tr.get("lvNeutralResistancePu"),
                    tr.get("lvNeutralReactancePu"),
                )

        for gen in dataset.get("generators") or []:
            if not self._as_bool(gen.get("inService"), True):
                continue
            bus_id = self._as_text(gen.get("busId"), "")
            if bus_id not in idx_by_id:
                continue
            i = idx_by_id[bus_id]
            xdp = self._as_float(gen.get("xdppPu"), 0.0)
            if xdp <= 0.0:
                raise EngineValidationError(f"Generator {self._as_text(gen.get('id'), 'generator')} requires xdppPu > 0.")
            y1[i, i] += 1.0 / complex(0.0, xdp)
            x2 = self._as_float(gen.get("x2Pu"), xdp)
            if x2 <= 0.0:
                raise EngineValidationError(f"Generator {self._as_text(gen.get('id'), 'generator')} requires x2Pu > 0.")
            y2[i, i] += 1.0 / complex(0.0, x2)
            if include_zero_sequence:
                x0 = self._as_float(gen.get("x0Pu"), 0.0)
                if x0 <= 0.0:
                    raise EngineValidationError(
                        f"Generator {self._as_text(gen.get('id'), 'generator')} requires x0Pu > 0 for SLG/DLG."
                    )
                neutral_grounded = bool(gen.get("neutralGrounded"))
                if neutral_grounded:
                    rn = self._as_float(gen.get("neutralResistancePu"), 0.0)
                    xn = self._as_float(gen.get("neutralReactancePu"), 0.0)
                    zg = complex(0.0, x0) + 3.0 * complex(rn, xn)
                    if abs(zg) <= 1e-12:
                        raise EngineValidationError(
                            f"Generator {self._as_text(gen.get('id'), 'generator')} has near-zero zero-sequence impedance."
                        )
                    y0[i, i] += 1.0 / zg
        return y1, y2, y0, warnings

    def _add_neutral_shunt(
        self,
        y0: np.ndarray,
        bus_idx: int,
        grounding_mode: str,
        r_value: Any,
        x_value: Any,
    ) -> None:
        mode = grounding_mode.strip().upper()
        if mode in {"", "UNGROUNDED"}:
            return
        rn = self._as_float(r_value, 0.0)
        xn = self._as_float(x_value, 0.0)
        z = complex(rn, xn)
        if abs(z) <= 1e-12:
            z = complex(0.0, 1e-6)
        y0[bus_idx, bus_idx] += 1.0 / z

    def _invert(self, y: np.ndarray, label: str) -> np.ndarray:
        # Avoid singular inversion for sparse, weakly grounded systems by adding tiny diagonal regularization.
        regularized = y + np.eye(y.shape[0], dtype=complex) * 1e-9
        try:
            return np.linalg.inv(regularized)
        except LinAlgError as exc:
            raise EngineExecutionError(f"Failed to invert {label} impedance matrix: {exc}") from exc

    def _fault_current_pu(
        self,
        fault_type: str,
        z1: complex,
        z2: complex,
        z0: complex | None,
        zf: complex,
        vf: float,
    ) -> complex:
        if fault_type == "3PH":
            return vf / (z1 + zf)
        if fault_type == "LL":
            return math.sqrt(3.0) * vf / (z1 + z2 + zf)
        if fault_type == "SLG":
            if z0 is None:
                raise EngineExecutionError("Zero-sequence network missing for SLG.")
            return 3.0 * vf / (z1 + z2 + z0 + 3.0 * zf)
        if fault_type == "DLG":
            if z0 is None:
                raise EngineExecutionError("Zero-sequence network missing for DLG.")
            z_parallel = (z2 * (z0 + 3.0 * zf)) / (z2 + z0 + 3.0 * zf)
            return 3.0 * vf / (z1 + z_parallel)
        raise EngineValidationError(f"Unsupported fault type {fault_type}")

    def _base_current_ka(self, dataset: dict[str, Any], nominal_kv: float) -> float:
        base_mva = self._as_float((dataset.get("grid") or {}).get("baseMva"), 100.0)
        if base_mva <= 0.0:
            raise EngineValidationError("grid.baseMva must be positive.")
        return base_mva / (math.sqrt(3.0) * nominal_kv)

    def _as_bool(self, value: Any, fallback: bool) -> bool:
        if value is None:
            return fallback
        return bool(value)

    def _as_float(self, value: Any, fallback: float) -> float:
        if value is None:
            return fallback
        try:
            parsed = float(value)
            if not math.isfinite(parsed):
                return fallback
            return parsed
        except (TypeError, ValueError):
            return fallback

    def _as_text(self, value: Any, fallback: str) -> str:
        if value is None:
            return fallback
        return str(value)
