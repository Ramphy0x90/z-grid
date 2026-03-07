from __future__ import annotations

from py_engine.engines.hosting_capacity.models import Country
from py_engine.engines.hosting_capacity.models import CountryConstraints

_EN50160_DEFAULTS = CountryConstraints(
    country=Country.SPAIN,  # placeholder, overridden per country
    voltage_band_pu=(0.90, 1.10),
    voltage_rise_limit_lv_pu=0.10,
    voltage_rise_limit_mv_pu=0.10,
    thermal_overload_factor=1.0,
    min_ssc_sn_ratio=25.0,
)

_COUNTRY_OVERRIDES: dict[Country, dict] = {
    Country.SPAIN: {
        "voltage_band_pu": (0.93, 1.07),
        "voltage_rise_limit_lv_pu": 0.07,
        "voltage_rise_limit_mv_pu": 0.07,
    },
    Country.SWITZERLAND: {
        "voltage_rise_limit_lv_pu": 0.03,
        "voltage_rise_limit_mv_pu": 0.02,
    },
    Country.GERMANY: {
        "voltage_rise_limit_lv_pu": 0.03,
        "voltage_rise_limit_mv_pu": 0.02,
        "reactive_power_capability": (0.90, 0.90),
    },
}


def get_country_constraints(country: Country) -> CountryConstraints:
    from dataclasses import asdict

    base = asdict(_EN50160_DEFAULTS)
    base["country"] = country
    overrides = _COUNTRY_OVERRIDES.get(country, {})
    base.update(overrides)
    return CountryConstraints(**base)
