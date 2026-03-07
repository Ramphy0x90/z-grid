# Hosting Capacity Algorithm Specification

## 1. Overview

The Hosting Capacity (HC) engine determines the maximum DG power (kW) that can be injected at each bus/node in a distribution network without violating any operational constraint. The algorithm uses an iterative power flow approach with binary search to efficiently find the HC at each candidate bus.

---

## 2. Input Data Model

### 2.1 Network Model

```python
@dataclass
class Bus:
    id: str
    name: str
    nominal_voltage_kv: float       # Nominal voltage (kV)
    voltage_level: VoltageLevel     # LV, MV, HV
    base_load_kw: float             # Existing load at bus (kW)
    base_load_kvar: float           # Existing reactive load (kvar)
    existing_dg_kw: float           # Already-connected DG (kW)
    coordinates: tuple[float, float] | None

class VoltageLevel(Enum):
    LV = "LV"    # <= 1 kV
    MV = "MV"    # 1-35 kV
    HV = "HV"    # > 35 kV

@dataclass
class Branch:
    id: str
    from_bus: str
    to_bus: str
    r_ohm: float                    # Resistance (ohm)
    x_ohm: float                    # Reactance (ohm)
    ampacity_a: float               # Rated current capacity (A)
    branch_type: BranchType         # LINE or TRANSFORMER

class BranchType(Enum):
    LINE = "LINE"
    TRANSFORMER = "TRANSFORMER"

@dataclass
class Transformer:
    id: str
    branch_id: str                  # Associated branch
    rated_kva: float                # Nameplate rating (kVA)
    emergency_overload_factor: float  # e.g. 1.2 for 120%

@dataclass
class NetworkModel:
    buses: dict[str, Bus]
    branches: dict[str, Branch]
    transformers: dict[str, Transformer]
    slack_bus_id: str               # Substation / source bus
    base_mva: float                 # System base MVA
```

### 2.2 Country Configuration

```python
@dataclass
class CountryConstraints:
    country: Country
    voltage_band_pu: tuple[float, float]      # (lower, upper) e.g. (0.93, 1.07) for Spain
    voltage_rise_limit_lv_pu: float           # Max voltage rise from DG at LV PCC (p.u.)
    voltage_rise_limit_mv_pu: float           # Max voltage rise from DG at MV PCC (p.u.)
    thd_limit_pct: float                      # THD limit (%)
    harmonic_limits: dict[int, float]         # {order: limit_%}
    flicker_plt_limit: float                  # Plt limit
    voltage_unbalance_limit_pct: float        # Negative sequence limit (%)
    thermal_overload_factor: float            # 1.0 = nameplate, 1.2 = 120% emergency
    min_ssc_sn_ratio: float                   # Min short-circuit ratio Ssc/Sn
    reactive_power_capability: tuple[float, float] | None  # (min_cos_phi, max_cos_phi)

class Country(Enum):
    SPAIN = "ES"
    SWITZERLAND = "CH"
    GERMANY = "DE"
    FRANCE = "FR"
    ITALY = "IT"
    UK = "GB"
```

### 2.3 Predefined Country Configurations

| Parameter | Spain (ES) | Switzerland (CH) | Germany (DE) | Default (EN 50160) |
|---|---|---|---|---|
| `voltage_band_pu` | (0.93, 1.07) | (0.90, 1.10) | (0.90, 1.10) | (0.90, 1.10) |
| `voltage_rise_limit_lv_pu` | 0.07 | 0.03 | 0.03 | 0.10 |
| `voltage_rise_limit_mv_pu` | 0.07 | 0.02 | 0.02 | 0.10 |
| `thd_limit_pct` | 8.0 | 8.0 | 8.0 | 8.0 |
| `flicker_plt_limit` | 1.0 | 1.0 | 1.0 | 1.0 |
| `voltage_unbalance_limit_pct` | 2.0 | 2.0 | 2.0 | 2.0 |
| `thermal_overload_factor` | 1.0 | 1.0 | 1.0 | 1.0 |
| `min_ssc_sn_ratio` | 25.0 | 25.0 | 25.0 | 25.0 |

> **Spain note:** Since Spain has no explicit voltage rise planning level, `voltage_rise_limit_lv_pu` is set to 0.07 (= the full +7% band). In practice, the voltage rise constraint for Spain is effectively captured by the tighter absolute voltage band (0.93-1.07 p.u.). The algorithm checks both absolute voltage and voltage rise, so Spain's tighter band naturally limits HC.

### 2.4 HC Analysis Configuration

```python
@dataclass
class HCConfig:
    country: Country
    candidate_bus_ids: list[str] | None     # None = all buses
    dg_power_factor: float                  # DG power factor (default 1.0)
    dg_type: DGType                         # PV, WIND, BATTERY, GENERIC
    search_tolerance_kw: float              # Binary search convergence (default 1.0 kW)
    max_dg_kw: float                        # Upper bound for search (default 10000 kW)
    check_thermal: bool                     # Enable thermal constraint check
    check_voltage: bool                     # Enable voltage constraint check
    check_voltage_rise: bool                # Enable voltage rise constraint check
    check_short_circuit: bool               # Enable Ssc/Sn ratio check
    check_power_quality: bool               # Enable THD/flicker/unbalance check (simplified)

class DGType(Enum):
    PV = "PV"
    WIND = "WIND"
    BATTERY = "BATTERY"
    GENERIC = "GENERIC"
```

---

## 3. Output Data Model

```python
@dataclass
class HCResult:
    bus_id: str
    hc_kw: float                            # Hosting capacity (kW)
    binding_constraint: ConstraintType       # Which constraint limits HC
    voltage_at_hc_pu: float                 # Voltage at bus when HC is reached (p.u.)
    voltage_rise_at_hc_pu: float            # Voltage rise caused by DG at HC (p.u.)
    max_branch_loading_pct: float           # Max branch loading at HC (%)
    max_branch_id: str                      # Most loaded branch ID
    transformer_loading_pct: float          # Transformer loading at HC (%)
    ssc_sn_ratio: float | None              # Short-circuit ratio at bus
    all_constraints: dict[ConstraintType, float]  # HC limit per constraint type

class ConstraintType(Enum):
    VOLTAGE_UPPER = "VOLTAGE_UPPER"         # Absolute voltage exceeds upper band
    VOLTAGE_LOWER = "VOLTAGE_LOWER"         # Absolute voltage below lower band (rare for DG)
    VOLTAGE_RISE = "VOLTAGE_RISE"           # Voltage rise from DG exceeds planning level
    THERMAL_LINE = "THERMAL_LINE"           # Line ampacity exceeded
    THERMAL_TRANSFORMER = "THERMAL_TRANSFORMER"  # Transformer capacity exceeded
    SHORT_CIRCUIT = "SHORT_CIRCUIT"         # Ssc/Sn ratio too low
    POWER_QUALITY = "POWER_QUALITY"         # THD, flicker, or unbalance exceeded
    NONE = "NONE"                           # No constraint violated (HC = max_dg_kw)

@dataclass
class HCAnalysisResult:
    network_id: str
    country: Country
    timestamp: str
    results: list[HCResult]                 # One per candidate bus
    summary: HCSummary

@dataclass
class HCSummary:
    total_candidate_buses: int
    min_hc_kw: float
    max_hc_kw: float
    mean_hc_kw: float
    binding_constraint_distribution: dict[ConstraintType, int]  # Count per constraint type
```

---

## 4. Algorithm

### 4.1 High-Level Flow

```
FUNCTION compute_hosting_capacity(network, config) -> HCAnalysisResult:
    constraints = load_country_constraints(config.country)
    candidate_buses = config.candidate_bus_ids or all non-slack buses
    results = []

    // Step 1: Run base-case power flow (no additional DG)
    base_pf = run_power_flow(network)
    base_voltages = extract_bus_voltages(base_pf)

    // Step 2: For each candidate bus, find HC via binary search
    FOR EACH bus_id IN candidate_buses:
        hc_result = find_hc_at_bus(network, bus_id, base_voltages, constraints, config)
        results.append(hc_result)

    RETURN HCAnalysisResult(results, compute_summary(results))
```

### 4.2 Binary Search for HC at a Single Bus

```
FUNCTION find_hc_at_bus(network, bus_id, base_voltages, constraints, config) -> HCResult:
    bus = network.buses[bus_id]
    p_low = 0.0
    p_high = config.max_dg_kw
    tolerance = config.search_tolerance_kw

    // Quick check: is p_high feasible? If so, HC = max
    IF check_all_constraints(network, bus_id, p_high, base_voltages, constraints, config).feasible:
        RETURN build_result(bus_id, p_high, NONE, ...)

    // Quick check: is p_low infeasible? If so, HC = 0 (network already violated)
    IF NOT check_all_constraints(network, bus_id, p_low, base_voltages, constraints, config).feasible:
        RETURN build_result(bus_id, 0.0, first_violated_constraint, ...)

    // Binary search
    WHILE (p_high - p_low) > tolerance:
        p_mid = (p_low + p_high) / 2.0
        result = check_all_constraints(network, bus_id, p_mid, base_voltages, constraints, config)
        IF result.feasible:
            p_low = p_mid
        ELSE:
            p_high = p_mid

    // Final evaluation at p_low (last known feasible point)
    final = check_all_constraints(network, bus_id, p_low, base_voltages, constraints, config)
    RETURN build_result(bus_id, p_low, find_binding_constraint(network, bus_id, p_high), final)
```

**Convergence:** With `max_dg_kw = 10000` and `tolerance = 1.0 kW`, binary search converges in ~14 iterations (log2(10000) ~ 13.3).

### 4.3 Constraint Checking

```
FUNCTION check_all_constraints(network, bus_id, dg_kw, base_voltages, constraints, config) -> ConstraintResult:
    // Inject DG at bus_id as negative load (generation)
    modified_network = inject_dg(network, bus_id, dg_kw, config.dg_power_factor)

    // Run power flow
    pf_result = run_power_flow(modified_network)

    violations = []

    // 4.3.1 Voltage band check
    IF config.check_voltage:
        FOR EACH bus IN pf_result.buses:
            v_pu = bus.voltage_pu
            IF v_pu > constraints.voltage_band_pu[1] OR v_pu < constraints.voltage_band_pu[0]:
                violations.append(VOLTAGE_UPPER if v_pu > upper else VOLTAGE_LOWER)

    // 4.3.2 Voltage rise check
    IF config.check_voltage_rise:
        v_now = pf_result.voltage_at(bus_id)
        v_base = base_voltages[bus_id]
        voltage_rise = v_now - v_base
        limit = constraints.voltage_rise_limit_lv_pu if bus.voltage_level == LV
                else constraints.voltage_rise_limit_mv_pu
        IF voltage_rise > limit:
            violations.append(VOLTAGE_RISE)

    // 4.3.3 Thermal check
    IF config.check_thermal:
        FOR EACH branch IN pf_result.branches:
            loading = branch.current_a / branch.ampacity_a
            IF branch.branch_type == TRANSFORMER:
                tf = network.transformers[branch.id]
                loading = branch.apparent_power_kva / (tf.rated_kva * constraints.thermal_overload_factor)
                IF loading > 1.0:
                    violations.append(THERMAL_TRANSFORMER)
            ELSE:
                IF loading > 1.0:
                    violations.append(THERMAL_LINE)

    // 4.3.4 Short-circuit ratio check
    IF config.check_short_circuit:
        ssc = get_short_circuit_power_at_bus(network, bus_id)  // MVA
        sn = dg_kw / 1000.0 / config.dg_power_factor          // MVA
        IF sn > 0 AND (ssc / sn) < constraints.min_ssc_sn_ratio:
            violations.append(SHORT_CIRCUIT)

    // 4.3.5 Power quality (simplified)
    IF config.check_power_quality:
        // Simplified: estimate THD contribution from DG inverter
        // Full harmonic power flow is out of scope for v1
        // Use emission limits from inverter spec as proxy
        PASS

    RETURN ConstraintResult(feasible=len(violations)==0, violations=violations, pf_result=pf_result)
```

### 4.4 Per-Constraint HC (for reporting)

After finding the overall HC via binary search, determine the HC limit for each individual constraint type by running separate binary searches with only one constraint enabled at a time. This populates `HCResult.all_constraints`.

```
FUNCTION compute_per_constraint_hc(network, bus_id, base_voltages, constraints, config) -> dict[ConstraintType, float]:
    per_constraint = {}
    for ctype in [VOLTAGE_UPPER, VOLTAGE_RISE, THERMAL_LINE, THERMAL_TRANSFORMER, SHORT_CIRCUIT]:
        single_config = config.copy_with_only(ctype)
        result = find_hc_at_bus(network, bus_id, base_voltages, constraints, single_config)
        per_constraint[ctype] = result.hc_kw
    RETURN per_constraint
```

---

## 5. Country Constraint Checker Interface

Each country implements the same interface. The base class provides EN 50160 defaults; country subclasses override specific values.

```python
class ConstraintChecker(Protocol):
    def get_constraints(self) -> CountryConstraints: ...

class EN50160Checker:
    """Baseline European constraints."""
    def get_constraints(self) -> CountryConstraints:
        return CountryConstraints(
            country=Country.DEFAULT,
            voltage_band_pu=(0.90, 1.10),
            voltage_rise_limit_lv_pu=0.10,
            voltage_rise_limit_mv_pu=0.10,
            thd_limit_pct=8.0,
            harmonic_limits=EN_50160_HARMONICS,
            flicker_plt_limit=1.0,
            voltage_unbalance_limit_pct=2.0,
            thermal_overload_factor=1.0,
            min_ssc_sn_ratio=25.0,
            reactive_power_capability=None,
        )

class SpainChecker(EN50160Checker):
    """Spain: tighter voltage band (+/-7%), no explicit voltage rise planning level."""
    def get_constraints(self) -> CountryConstraints:
        base = super().get_constraints()
        base.country = Country.SPAIN
        base.voltage_band_pu = (0.93, 1.07)
        base.voltage_rise_limit_lv_pu = 0.07  # Full band as proxy
        base.voltage_rise_limit_mv_pu = 0.07
        return base

class SwitzerlandChecker(EN50160Checker):
    """Switzerland: DACHCZ voltage rise limits."""
    def get_constraints(self) -> CountryConstraints:
        base = super().get_constraints()
        base.country = Country.SWITZERLAND
        base.voltage_rise_limit_lv_pu = 0.03
        base.voltage_rise_limit_mv_pu = 0.02
        return base

class GermanyChecker(EN50160Checker):
    """Germany: DACHCZ voltage rise limits, Q(U)/P(f) capability."""
    def get_constraints(self) -> CountryConstraints:
        base = super().get_constraints()
        base.country = Country.GERMANY
        base.voltage_rise_limit_lv_pu = 0.03
        base.voltage_rise_limit_mv_pu = 0.02
        base.reactive_power_capability = (0.90, 0.90)  # cos(phi) range
        return base
```

---

## 6. Power Flow Integration

The algorithm is **power-flow-engine agnostic**. It requires a power flow solver that implements:

```python
class PowerFlowSolver(Protocol):
    def run(self, network: NetworkModel) -> PowerFlowResult: ...

@dataclass
class PowerFlowResult:
    converged: bool
    bus_voltages: dict[str, complex]        # Bus ID -> voltage phasor (p.u.)
    branch_currents: dict[str, float]       # Branch ID -> current magnitude (A)
    branch_powers: dict[str, complex]       # Branch ID -> apparent power (kVA)
    losses_kw: float
```

The Zeus py-engine power flow solver should be wrapped to conform to this interface.

---

## 7. Short-Circuit Power Estimation

For the Ssc/Sn ratio check, short-circuit power at a bus can be estimated from the power flow Thevenin impedance:

```
Ssc_mva = V_nominal^2 / Z_thevenin
```

Where `Z_thevenin` is the impedance seen from the bus looking toward the source, computed by:
1. Setting all loads/generators to zero
2. Injecting 1 p.u. current at the bus
3. Measuring the resulting voltage

Or more practically, from the network impedance matrix (Z-bus) diagonal element:

```
Ssc_mva(bus_i) = base_mva / Z_bus[i,i]
```

---

## 8. Computational Complexity

| Component | Cost |
|---|---|
| Power flow per iteration | O(N^2) to O(N^1.5) with sparse solver, where N = number of buses |
| Binary search iterations | ~14 per bus (for 10 MW range, 1 kW tolerance) |
| Total for all buses | O(N_candidates * 14 * PF_cost) |
| Per-constraint breakdown | 5x multiplier if enabled |

For a typical LV feeder (50-200 buses), this is tractable. For large MV networks (1000+ buses), consider:
- Parallelizing across candidate buses
- Using voltage sensitivity matrix (dV/dP) for initial estimate, then refining with full power flow
- Skipping per-constraint breakdown unless requested

---

## 9. Sensitivity-Based Acceleration (Optional)

For large networks, a linearized approach can provide a fast initial estimate:

```
delta_V = (R * P + X * Q) / V^2
```

Where R, X are the Thevenin resistance/reactance at the bus. This gives the voltage rise per kW of DG injection. The HC estimate is:

```
HC_voltage_kw = voltage_rise_limit * V^2 / R    (for unity PF DG)
```

This can be used as the initial `p_high` for binary search, reducing iterations.

---

## 10. Algorithm Phases Summary

```
Phase 1: Load network model and country constraints
Phase 2: Run base-case power flow (no additional DG)
Phase 3: For each candidate bus:
    Phase 3a: Binary search - inject DG, run power flow, check constraints
    Phase 3b: Converge to HC within tolerance
    Phase 3c: (Optional) Per-constraint HC breakdown
Phase 4: Aggregate results, compute summary statistics
Phase 5: Return HCAnalysisResult
```

---

## 11. V1 Scope and Simplifications

For the initial implementation (v1):

1. **Power quality constraints (THD, flicker, unbalance):** Simplified check or skipped. Full harmonic power flow is complex and deferred to v2.
2. **DG modeled as negative PQ load** at unity or specified power factor.
3. **Single DG injection per bus** (one bus at a time). Simultaneous multi-bus HC is deferred to v2.
4. **Static analysis only.** Time-series HC (varying load/generation profiles) deferred to v2.
5. **No Q(U)/P(f) control modeling** in v1. DG reactive power is fixed by power factor setting.
6. **Short-circuit estimation** uses simplified Thevenin method from Z-bus diagonal.
