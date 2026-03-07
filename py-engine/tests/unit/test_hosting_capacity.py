from __future__ import annotations

from unittest.mock import patch

import pytest

from py_engine.engines.hosting_capacity.constraints import get_country_constraints
from py_engine.engines.hosting_capacity.engine import HostingCapacityEngine
from py_engine.engines.hosting_capacity.models import ConstraintType
from py_engine.engines.hosting_capacity.models import Country
from py_engine.engines.hosting_capacity.models import VoltageLevel


class TestCountryConstraints:
    def test_spain_tighter_voltage_band(self):
        c = get_country_constraints(Country.SPAIN)
        assert c.voltage_band_pu == (0.93, 1.07)
        assert c.voltage_rise_limit_lv_pu == 0.07

    def test_germany_dachcz_limits(self):
        c = get_country_constraints(Country.GERMANY)
        assert c.voltage_band_pu == (0.90, 1.10)
        assert c.voltage_rise_limit_lv_pu == 0.03
        assert c.voltage_rise_limit_mv_pu == 0.02
        assert c.reactive_power_capability == (0.90, 0.90)

    def test_switzerland_dachcz_limits(self):
        c = get_country_constraints(Country.SWITZERLAND)
        assert c.voltage_rise_limit_lv_pu == 0.03
        assert c.voltage_rise_limit_mv_pu == 0.02

    def test_default_en50160_for_unknown_country(self):
        c = get_country_constraints(Country.FRANCE)
        assert c.voltage_band_pu == (0.90, 1.10)
        assert c.voltage_rise_limit_lv_pu == 0.10


class TestHostingCapacityEngine:
    def _make_pf_result(self, bus_voltages: dict[str, float], branch_loadings: dict[str, float] | None = None):
        bus_results = [
            {"busId": bid, "voltageMagnitudePu": v} for bid, v in bus_voltages.items()
        ]
        branch_results = []
        if branch_loadings:
            for br_id, loading in branch_loadings.items():
                branch_results.append({
                    "elementId": br_id,
                    "loadingPercent": loading,
                    "pFromMw": 0.08,
                    "qFromMvar": 0.06,
                    "pToMw": -0.08,
                    "qToMvar": -0.06,
                    "elementType": "LINE",
                })
        return {
            "converged": True,
            "busResults": bus_results,
            "branchResults": branch_results,
        }

    def _make_dataset(self, num_buses=3):
        buses = [
            {"id": "slack", "name": "Slack", "busType": "SLACK", "inService": True, "nominalVoltageKv": 20.0},
        ]
        for i in range(1, num_buses):
            buses.append({
                "id": f"bus{i}",
                "name": f"Bus {i}",
                "busType": "PQ",
                "inService": True,
                "nominalVoltageKv": 0.4,
            })
        return {
            "buses": buses,
            "generators": [{"id": "gen1", "busId": "slack", "inService": True, "activePowerMw": 10.0}],
            "loads": [],
            "lines": [],
            "transformers": [],
            "grid": {"baseMva": 100.0},
        }

    @patch.object(HostingCapacityEngine, "_run_power_flow")
    def test_all_feasible_returns_max(self, mock_pf):
        mock_pf.return_value = self._make_pf_result({"slack": 1.0, "bus1": 1.02}, {"line1": 50.0})
        engine = HostingCapacityEngine()
        dataset = self._make_dataset(num_buses=2)
        summary, data = engine.execute(dataset, {
            "country": "DE",
            "candidateBusIds": ["bus1"],
            "maxDgKw": 100.0,
        })
        assert summary["totalCandidateBuses"] == 1
        result = data["busResults"][0]
        assert result["hcKw"] == 100.0
        assert result["bindingConstraint"] == "NONE"

    @patch.object(HostingCapacityEngine, "_run_power_flow")
    def test_voltage_violation_limits_hc(self, mock_pf):
        call_count = 0

        def pf_side_effect(dataset):
            nonlocal call_count
            call_count += 1
            # Check if DG is injected by looking for __hc_dg
            has_dg = any(g["id"].startswith("__hc_dg") for g in (dataset.get("generators") or []))
            if has_dg:
                dg_gen = next(g for g in dataset["generators"] if g["id"].startswith("__hc_dg"))
                dg_mw = dg_gen["activePowerMw"]
                # Voltage rises linearly with DG injection
                v = 1.0 + dg_mw * 0.01  # 0.01 pu per MW
                return self._make_pf_result({"slack": 1.0, "bus1": v}, {"line1": 30.0})
            return self._make_pf_result({"slack": 1.0, "bus1": 1.0}, {"line1": 30.0})

        mock_pf.side_effect = pf_side_effect
        engine = HostingCapacityEngine()
        dataset = self._make_dataset(num_buses=2)
        summary, data = engine.execute(dataset, {
            "country": "DE",
            "candidateBusIds": ["bus1"],
            "maxDgKw": 20000.0,
            "checkThermal": False,
            "checkVoltageRise": False,
            "searchToleranceKw": 1.0,
        })
        result = data["busResults"][0]
        # Voltage upper limit is 1.10, so DG should be limited around 10 MW (10 * 0.01 = 0.10)
        assert 9000 <= result["hcKw"] <= 10001
        assert result["bindingConstraint"] == "VOLTAGE_UPPER"

    @patch.object(HostingCapacityEngine, "_run_power_flow")
    def test_base_case_infeasible(self, mock_pf):
        # Base case already violates voltage
        mock_pf.return_value = self._make_pf_result({"slack": 1.0, "bus1": 1.12}, {"line1": 30.0})
        engine = HostingCapacityEngine()
        dataset = self._make_dataset(num_buses=2)
        summary, data = engine.execute(dataset, {
            "country": "DE",
            "candidateBusIds": ["bus1"],
        })
        result = data["busResults"][0]
        assert result["hcKw"] == 0.0

    def test_invalid_country_raises(self):
        engine = HostingCapacityEngine()
        dataset = self._make_dataset()
        with pytest.raises(Exception, match="Unsupported country"):
            engine.execute(dataset, {"country": "XX"})

    def test_voltage_level_detection(self):
        engine = HostingCapacityEngine()
        assert engine._get_voltage_level({"nominalVoltageKv": 0.4}) == VoltageLevel.LV
        assert engine._get_voltage_level({"nominalVoltageKv": 20.0}) == VoltageLevel.MV
        assert engine._get_voltage_level({"nominalVoltageKv": 110.0}) == VoltageLevel.HV
        assert engine._get_voltage_level({"voltageLevel": "MV"}) == VoltageLevel.MV

    @patch.object(HostingCapacityEngine, "_run_power_flow")
    def test_spain_constraints_applied(self, mock_pf):
        mock_pf.return_value = self._make_pf_result({"slack": 1.0, "bus1": 1.08}, {"line1": 30.0})
        engine = HostingCapacityEngine()
        dataset = self._make_dataset(num_buses=2)
        summary, data = engine.execute(dataset, {
            "country": "ES",
            "candidateBusIds": ["bus1"],
        })
        # 1.08 > 1.07 (Spain upper band) => HC = 0
        result = data["busResults"][0]
        assert result["hcKw"] == 0.0
        assert data["country"] == "ES"
        assert data["constraintsApplied"]["voltageBandPu"] == [0.93, 1.07]

    def test_extract_voltages_prefers_voltage_magnitude_field(self):
        engine = HostingCapacityEngine()
        voltages = engine._extract_voltages({
            "busResults": [
                {"busId": "bus1", "voltageMagnitudePu": 1.023},
                {"busId": "bus2", "voltagePu": 1.011},
            ]
        })
        assert voltages["bus1"] == 1.023
        assert voltages["bus2"] == 1.011

    @patch.object(HostingCapacityEngine, "_run_power_flow")
    def test_thermal_line_binding_constraint(self, mock_pf):
        def pf_side_effect(dataset):
            has_dg = any(g["id"].startswith("__hc_dg") for g in (dataset.get("generators") or []))
            dg_mw = 0.0
            if has_dg:
                dg_gen = next(g for g in dataset["generators"] if g["id"].startswith("__hc_dg"))
                dg_mw = dg_gen["activePowerMw"]
            loading = 40.0 + (dg_mw * 10.0)
            return {
                "converged": True,
                "busResults": [
                    {"busId": "slack", "voltageMagnitudePu": 1.0},
                    {"busId": "bus1", "voltageMagnitudePu": 1.0},
                ],
                "branchResults": [
                    {
                        "elementId": "line1",
                        "elementType": "LINE",
                        "loadingPercent": loading,
                        "pFromMw": 0.08,
                        "qFromMvar": 0.06,
                        "pToMw": -0.08,
                        "qToMvar": -0.06,
                    }
                ],
            }

        mock_pf.side_effect = pf_side_effect
        engine = HostingCapacityEngine()
        dataset = self._make_dataset(num_buses=2)
        _summary, data = engine.execute(dataset, {
            "country": "DE",
            "candidateBusIds": ["bus1"],
            "maxDgKw": 10000.0,
            "checkVoltage": False,
            "checkVoltageRise": False,
            "checkThermal": True,
            "searchToleranceKw": 1.0,
        })
        result = data["busResults"][0]
        assert result["bindingConstraint"] == "THERMAL_LINE"
        assert 5900 <= result["hcKw"] <= 6100

    @patch.object(HostingCapacityEngine, "_run_power_flow")
    def test_thermal_transformer_binding_constraint(self, mock_pf):
        def pf_side_effect(dataset):
            has_dg = any(g["id"].startswith("__hc_dg") for g in (dataset.get("generators") or []))
            dg_mw = 0.0
            if has_dg:
                dg_gen = next(g for g in dataset["generators"] if g["id"].startswith("__hc_dg"))
                dg_mw = dg_gen["activePowerMw"]
            loading = 50.0 + (dg_mw * 20.0)
            return {
                "converged": True,
                "busResults": [
                    {"busId": "slack", "voltageMagnitudePu": 1.0},
                    {"busId": "bus1", "voltageMagnitudePu": 1.0},
                ],
                "branchResults": [
                    {
                        "elementId": "tx1",
                        "elementType": "TRANSFORMER",
                        "loadingPercent": loading,
                        "pFromMw": 0.08,
                        "qFromMvar": 0.06,
                        "pToMw": -0.08,
                        "qToMvar": -0.06,
                    }
                ],
            }

        mock_pf.side_effect = pf_side_effect
        engine = HostingCapacityEngine()
        dataset = self._make_dataset(num_buses=2)
        _summary, data = engine.execute(dataset, {
            "country": "DE",
            "candidateBusIds": ["bus1"],
            "maxDgKw": 10000.0,
            "checkVoltage": False,
            "checkVoltageRise": False,
            "checkThermal": True,
            "searchToleranceKw": 1.0,
        })
        result = data["busResults"][0]
        assert result["bindingConstraint"] == "THERMAL_TRANSFORMER"
        assert 2400 <= result["hcKw"] <= 2600

    @patch.object(HostingCapacityEngine, "_run_power_flow")
    def test_short_circuit_binding_and_ratio_output(self, mock_pf):
        mock_pf.return_value = self._make_pf_result({"slack": 1.0, "bus1": 1.0}, {"line1": 30.0})
        engine = HostingCapacityEngine()
        dataset = self._make_dataset(num_buses=2)
        for bus in dataset["buses"]:
            if bus["id"] == "bus1":
                bus["shortCircuitPowerMva"] = 2.0
        _summary, data = engine.execute(dataset, {
            "country": "DE",
            "candidateBusIds": ["bus1"],
            "maxDgKw": 1000.0,
            "checkVoltage": False,
            "checkVoltageRise": False,
            "checkThermal": False,
            "checkShortCircuit": True,
            "searchToleranceKw": 1.0,
        })
        result = data["busResults"][0]
        assert result["bindingConstraint"] == "SHORT_CIRCUIT"
        assert 70 <= result["hcKw"] <= 90
        assert result["sscSnRatio"] is not None
        assert result["allConstraints"]["SHORT_CIRCUIT"] <= result["allConstraints"]["VOLTAGE_UPPER"]

    @patch.object(HostingCapacityEngine, "_run_power_flow")
    def test_power_quality_enabled_path_limits_hc(self, mock_pf):
        mock_pf.return_value = self._make_pf_result({"slack": 1.0, "bus1": 1.0}, {"line1": 30.0})
        engine = HostingCapacityEngine()
        dataset = self._make_dataset(num_buses=2)
        dataset["loads"] = [{
            "id": "load1",
            "busId": "bus1",
            "inService": True,
            "activePowerMw": 0.1,
            "reactivePowerMvar": 0.01,
            "scalingFactor": 1.0,
        }]
        for bus in dataset["buses"]:
            if bus["id"] == "bus1":
                bus["shortCircuitPowerMva"] = 20.0
        _summary, data = engine.execute(dataset, {
            "country": "DE",
            "candidateBusIds": ["bus1"],
            "maxDgKw": 1000.0,
            "checkVoltage": False,
            "checkVoltageRise": False,
            "checkThermal": False,
            "checkShortCircuit": False,
            "checkPowerQuality": True,
            "searchToleranceKw": 1.0,
        })
        result = data["busResults"][0]
        assert result["bindingConstraint"] == "POWER_QUALITY"
        assert result["hcKw"] < 1000.0
        assert "POWER_QUALITY" in result["allConstraints"]

    @patch.object(HostingCapacityEngine, "_run_power_flow")
    def test_all_constraints_breakdown_present(self, mock_pf):
        mock_pf.return_value = self._make_pf_result({"slack": 1.0, "bus1": 1.0}, {"line1": 50.0})
        engine = HostingCapacityEngine()
        dataset = self._make_dataset(num_buses=2)
        _summary, data = engine.execute(dataset, {
            "country": "DE",
            "candidateBusIds": ["bus1"],
            "maxDgKw": 500.0,
            "searchToleranceKw": 1.0,
        })
        all_constraints = data["busResults"][0]["allConstraints"]
        assert set(all_constraints.keys()) == {
            ConstraintType.VOLTAGE_UPPER.value,
            ConstraintType.VOLTAGE_RISE.value,
            ConstraintType.THERMAL_LINE.value,
            ConstraintType.THERMAL_TRANSFORMER.value,
            ConstraintType.SHORT_CIRCUIT.value,
            ConstraintType.POWER_QUALITY.value,
        }
