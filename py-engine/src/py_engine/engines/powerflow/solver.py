from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

from py_engine.core.exceptions import EngineExecutionError
from py_engine.engines.powerflow.models import BranchEdge
from py_engine.engines.powerflow.models import BusNode
from py_engine.engines.powerflow.models import PowerFlowCase


@dataclass(frozen=True)
class SolverOptions:
    max_iterations: int = 30
    tolerance: float = 1e-6
    min_voltage_pu: float = 0.5
    max_voltage_pu: float = 1.5


@dataclass(frozen=True)
class SolveResult:
    converged: bool
    iterations: int
    summary: dict
    bus_results: list[dict]
    branch_results: list[dict]
    voltage_violations: list[dict]
    thermal_violations: list[dict]
    warnings: list[str]


def _polar(magnitude: float, angle_rad: float) -> complex:
    return complex(magnitude * math.cos(angle_rad), magnitude * math.sin(angle_rad))


def _build_ybus(case: PowerFlowCase) -> sp.csr_matrix:
    n_bus = len(case.buses)
    y = sp.lil_matrix((n_bus, n_bus), dtype=np.complex128)

    for br in case.branches:
        den = br.resistance_pu * br.resistance_pu + br.reactance_pu * br.reactance_pu
        if den < 1e-12:
            continue
        y_series = complex(br.resistance_pu / den, -br.reactance_pu / den)
        y_shunt_half = complex(0.0, br.shunt_susceptance_pu / 2.0)
        tap = _polar(br.tap_ratio, math.radians(br.phase_shift_deg))
        tap_conj = np.conjugate(tap)
        tap_norm = tap * tap_conj

        yff = (y_series + y_shunt_half) / tap_norm
        yft = -y_series / tap_conj
        ytf = -y_series / tap
        ytt = y_series + y_shunt_half

        f = br.from_idx
        t = br.to_idx
        y[f, f] += yff
        y[f, t] += yft
        y[t, f] += ytf
        y[t, t] += ytt

    return y.tocsr()


def _calc_power(ybus: sp.csr_matrix, vm: np.ndarray, va: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    v = vm * np.exp(1j * va)
    i = ybus.dot(v)
    s = v * np.conjugate(i)
    return np.real(s), np.imag(s)


def _max_abs(vec: np.ndarray) -> float:
    return float(np.max(np.abs(vec))) if vec.size else 0.0


def _build_jacobian(
    ybus: sp.csr_matrix,
    vm: np.ndarray,
    va: np.ndarray,
    p: np.ndarray,
    q: np.ndarray,
    p_buses: list[int],
    pq_buses: list[int],
) -> sp.csr_matrix:
    n_p = len(p_buses)
    n_q = len(pq_buses)
    n = n_p + n_q
    if n == 0:
        return sp.csr_matrix((0, 0), dtype=np.float64)

    theta_idx = {bus: idx for idx, bus in enumerate(p_buses)}
    v_idx = {bus: idx for idx, bus in enumerate(pq_buses)}
    y_csr = ybus.tocsr()

    rows: list[int] = []
    cols: list[int] = []
    data: list[float] = []

    for row_pos, i in enumerate(p_buses):
        row_start = y_csr.indptr[i]
        row_end = y_csr.indptr[i + 1]
        for ptr in range(row_start, row_end):
            k = int(y_csr.indices[ptr])
            yik = y_csr.data[ptr]
            g = float(np.real(yik))
            b = float(np.imag(yik))
            angle = va[i] - va[k]

            if k in theta_idx:
                col = theta_idx[k]
                if i == k:
                    value = -q[i] - b * vm[i] * vm[i]
                else:
                    value = vm[i] * vm[k] * (g * math.sin(angle) - b * math.cos(angle))
                rows.append(row_pos)
                cols.append(col)
                data.append(value)

            if k in v_idx:
                col = n_p + v_idx[k]
                if i == k:
                    v_safe = max(vm[i], 1e-8)
                    value = (p[i] / v_safe) + g * vm[i]
                else:
                    value = vm[i] * (g * math.cos(angle) + b * math.sin(angle))
                rows.append(row_pos)
                cols.append(col)
                data.append(value)

    for row_local, i in enumerate(pq_buses):
        row_pos = n_p + row_local
        row_start = y_csr.indptr[i]
        row_end = y_csr.indptr[i + 1]
        for ptr in range(row_start, row_end):
            k = int(y_csr.indices[ptr])
            yik = y_csr.data[ptr]
            g = float(np.real(yik))
            b = float(np.imag(yik))
            angle = va[i] - va[k]

            if k in theta_idx:
                col = theta_idx[k]
                if i == k:
                    value = p[i] - g * vm[i] * vm[i]
                else:
                    value = -vm[i] * vm[k] * (g * math.cos(angle) + b * math.sin(angle))
                rows.append(row_pos)
                cols.append(col)
                data.append(value)

            if k in v_idx:
                col = n_p + v_idx[k]
                if i == k:
                    v_safe = max(vm[i], 1e-8)
                    value = (q[i] / v_safe) - b * vm[i]
                else:
                    value = vm[i] * (g * math.sin(angle) - b * math.cos(angle))
                rows.append(row_pos)
                cols.append(col)
                data.append(value)

    return sp.csr_matrix((data, (rows, cols)), shape=(n, n), dtype=np.float64)


def _branch_flows(case: PowerFlowCase, vm: np.ndarray, va: np.ndarray) -> tuple[list[dict], list[dict], float]:
    v = vm * np.exp(1j * va)
    branch_results: list[dict] = []
    thermal_violations: list[dict] = []
    total_losses_mw = 0.0

    for br in case.branches:
        den = br.resistance_pu * br.resistance_pu + br.reactance_pu * br.reactance_pu
        if den < 1e-12:
            continue
        y_series = complex(br.resistance_pu / den, -br.reactance_pu / den)
        y_shunt_half = complex(0.0, br.shunt_susceptance_pu / 2.0)
        tap = _polar(br.tap_ratio, math.radians(br.phase_shift_deg))
        tap_conj = np.conjugate(tap)
        tap_norm = tap * tap_conj

        yff = (y_series + y_shunt_half) / tap_norm
        yft = -y_series / tap_conj
        ytf = -y_series / tap
        ytt = y_series + y_shunt_half

        vf = v[br.from_idx]
        vt = v[br.to_idx]

        i_from = yff * vf + yft * vt
        i_to = ytf * vf + ytt * vt
        s_from = vf * np.conjugate(i_from) * case.base_mva
        s_to = vt * np.conjugate(i_to) * case.base_mva

        s_from_mva = abs(s_from)
        s_to_mva = abs(s_to)
        max_end_mva = max(s_from_mva, s_to_mva)
        loading_percent = (max_end_mva / br.rating_mva) * 100.0 if br.rating_mva > 1e-9 else 0.0
        max_percent = max(1.0, br.max_loading_percent)

        branch_results.append(
            {
                "elementId": br.element_id,
                "elementType": br.element_type,
                "name": br.name,
                "loadingPercent": loading_percent,
                "pFromMw": float(np.real(s_from)),
                "qFromMvar": float(np.imag(s_from)),
                "pToMw": float(np.real(s_to)),
                "qToMvar": float(np.imag(s_to)),
            }
        )

        if loading_percent > max_percent:
            thermal_violations.append(
                {
                    "elementId": br.element_id,
                    "elementType": br.element_type,
                    "name": br.name,
                    "loadingPercent": loading_percent,
                    "maxPercent": max_percent,
                }
            )

        total_losses_mw += float(np.real(s_from) + np.real(s_to))

    return branch_results, thermal_violations, total_losses_mw


def solve_powerflow(case: PowerFlowCase, options: SolverOptions) -> SolveResult:
    n_bus = len(case.buses)
    ybus = _build_ybus(case)

    vm = np.empty(n_bus, dtype=np.float64)
    va = np.empty(n_bus, dtype=np.float64)

    slack: list[int] = []
    pv: list[int] = []
    pq: list[int] = []
    p_spec = np.zeros(n_bus, dtype=np.float64)
    q_spec = np.zeros(n_bus, dtype=np.float64)

    for i, bus in enumerate(case.buses):
        vm[i] = bus.v_set if bus.bus_type == "PV" else bus.vm_init
        va[i] = math.radians(bus.va_init_deg)
        p_spec[i] = bus.p_spec_pu
        q_spec[i] = bus.q_spec_pu
        if bus.bus_type == "SLACK":
            slack.append(i)
        elif bus.bus_type == "PV":
            pv.append(i)
        else:
            pq.append(i)

    if len(slack) != 1:
        raise EngineExecutionError("Expected exactly one slack bus during solve.")

    p_buses = pv + pq
    converged = False
    warnings: list[str] = []
    iterations = 0
    last_norm = float("inf")

    for iteration in range(1, options.max_iterations + 1):
        iterations = iteration
        p_calc, q_calc = _calc_power(ybus, vm, va)
        mismatch = np.concatenate((p_spec[p_buses] - p_calc[p_buses], q_spec[pq] - q_calc[pq]))
        mismatch_norm = _max_abs(mismatch)

        if mismatch_norm < options.tolerance:
            converged = True
            break

        jac = _build_jacobian(ybus, vm, va, p_calc, q_calc, p_buses, pq)
        try:
            correction = spla.spsolve(jac, mismatch)
        except Exception as exc:
            raise EngineExecutionError("Power flow Jacobian solve failed.") from exc

        if np.any(np.isnan(correction)) or np.any(np.isinf(correction)):
            raise EngineExecutionError("Power flow Jacobian is singular or ill-conditioned.")

        n_angle = len(p_buses)
        d_theta = correction[:n_angle]
        d_vm = correction[n_angle:]

        best_factor = 1.0
        best_norm = float("inf")
        for factor in (1.0, 0.5, 0.25, 0.1):
            trial_vm = vm.copy()
            trial_va = va.copy()
            for idx, bus_idx in enumerate(p_buses):
                trial_va[bus_idx] += d_theta[idx] * factor
            for idx, bus_idx in enumerate(pq):
                trial_vm[bus_idx] += d_vm[idx] * factor
                trial_vm[bus_idx] = float(np.clip(trial_vm[bus_idx], options.min_voltage_pu, options.max_voltage_pu))
            p_t, q_t = _calc_power(ybus, trial_vm, trial_va)
            trial_mismatch = np.concatenate((p_spec[p_buses] - p_t[p_buses], q_spec[pq] - q_t[pq]))
            trial_norm = _max_abs(trial_mismatch)
            if trial_norm < best_norm:
                best_norm = trial_norm
                best_factor = factor

        if best_factor < 1.0:
            warnings.append("Applied NR damping factor to improve convergence stability.")

        for idx, bus_idx in enumerate(p_buses):
            va[bus_idx] += d_theta[idx] * best_factor
        for idx, bus_idx in enumerate(pq):
            vm[bus_idx] += d_vm[idx] * best_factor
            vm[bus_idx] = float(np.clip(vm[bus_idx], options.min_voltage_pu, options.max_voltage_pu))

        if best_norm > last_norm * 1.5:
            warnings.append("Mismatch increased significantly; solution may be ill-conditioned.")
        last_norm = best_norm

    if not converged:
        raise EngineExecutionError(f"Power flow did not converge in {options.max_iterations} iterations.")

    bus_results: list[dict] = []
    voltage_violations: list[dict] = []
    for i, bus in enumerate(case.buses):
        vm_i = float(vm[i])
        va_deg = float(np.degrees(va[i]))
        bus_results.append(
            {
                "busId": bus.bus_id,
                "busName": bus.bus_name,
                "voltageMagnitudePu": vm_i,
                "voltageAngleDeg": va_deg,
            }
        )
        if vm_i < bus.min_v or vm_i > bus.max_v:
            voltage_violations.append(
                {
                    "busId": bus.bus_id,
                    "busName": bus.bus_name,
                    "valuePu": vm_i,
                    "minPu": bus.min_v,
                    "maxPu": bus.max_v,
                }
            )

    branch_results, thermal_violations, losses_mw = _branch_flows(case, vm, va)

    total_load_mw = sum(max(0.0, -bus.p_spec_pu) * case.base_mva for bus in case.buses)
    total_generation_mw = sum(max(0.0, bus.p_spec_pu) * case.base_mva for bus in case.buses)
    summary = {
        "totalLoadMw": total_load_mw,
        "totalGenerationMw": total_generation_mw,
        "lossesMw": losses_mw,
    }

    return SolveResult(
        converged=True,
        iterations=iterations,
        summary=summary,
        bus_results=bus_results,
        branch_results=branch_results,
        voltage_violations=voltage_violations,
        thermal_violations=thermal_violations,
        warnings=warnings,
    )
