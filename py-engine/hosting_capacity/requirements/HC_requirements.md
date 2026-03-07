# Hosting Capacity (HC) Requirements by Country

> **Hosting Capacity** is the maximum amount of distributed generation (DG) or load that can be connected to a distribution grid without violating operational limits (voltage, thermal, protection, power quality).

This document consolidates the key standards, voltage bands, thermal limits, harmonic limits, flicker limits, and protection coordination rules relevant to HC calculations for each country.

---

## 1. European Common Standard: EN 50160

EN 50160 is the baseline power quality standard across Europe. Country-specific rules layer on top of or tighten these limits.

### 1.1 Voltage Magnitude

| Parameter | LV (<=1 kV) | MV (1-35 kV) | Reference |
|---|---|---|---|
| Steady-state voltage range | Uc +/-10% (95% of week, 10-min RMS) | Uc +/-10% (95% of week, 10-min RMS) | EN 50160 clause 4.2.2 |
| Remaining 5% | No limit specified (but +10/-15% typical) | No limit specified | EN 50160 |

### 1.2 Frequency

| Parameter | Interconnected system | Isolated system | Reference |
|---|---|---|---|
| Normal range | 50 Hz +/-1% (49.5-50.5 Hz), 99.5% of year | 50 Hz +/-2% (49-51 Hz), 95% of week | EN 50160 clause 4.2.1 |
| Extended range | 50 Hz +4%/-6% (47-52 Hz), 100% of time | 50 Hz +/-15% (42.5-57.5 Hz), 100% of time | EN 50160 |

### 1.3 Harmonic Voltage Limits (LV and MV)

95% of 10-min mean RMS values over one week shall not exceed:

| Odd harmonics (not multiple of 3) | | Odd harmonics (multiple of 3) | | Even harmonics | |
|---|---|---|---|---|---|
| Order | Limit (% Uc) | Order | Limit (% Uc) | Order | Limit (% Uc) |
| 5 | 6.0% | 3 | 5.0% | 2 | 2.0% |
| 7 | 5.0% | 9 | 1.5% | 4 | 1.0% |
| 11 | 3.5% | 15 | 0.5% | 6-24 | 0.5% |
| 13 | 3.0% | 21 | 0.5% | | |
| 17 | 2.0% | | | | |
| 19 | 1.5% | | | | |
| 23 | 1.5% | | | | |
| 25 | 1.5% | | | | |

**THD <= 8%** (including all harmonics up to order 40)

### 1.4 Flicker

| Parameter | Limit | Reference |
|---|---|---|
| Long-term flicker severity (Plt) | <= 1.0 (95% of week) | EN 50160 clause 4.2.5 |
| Short-term flicker severity (Pst) | <= 1.0 (informative) | EN 50160 |

### 1.5 Voltage Unbalance

| Parameter | Limit | Reference |
|---|---|---|
| Negative sequence component | <= 2% of positive sequence (95% of week) | EN 50160 clause 4.2.6 |
| Exception (some areas) | Up to 3% allowed | EN 50160 |

### 1.6 Rapid Voltage Changes

| Parameter | LV | MV |
|---|---|---|
| Normal | <= 5% Uc | <= 4% Uc |
| Infrequent | Up to 10% Uc | Up to 6% Uc |

### 1.7 Voltage Dips

- Depth: between 10% and 99% of Uc
- Duration: 10 ms to 1 minute
- Frequency: typically 10-1000 per year depending on network type

---

## 2. Spain

### 2.1 Regulatory Framework

| Standard / Regulation | Scope |
|---|---|
| **RD 1955/2000** | Regulates grid access, connection, operating procedures, and technical requirements for network connections |
| **RD 842/2002 (REBT)** | Reglamento Electrotecnico para Baja Tension - LV installation regulations |
| **RD 223/2008 (ITC-LAT)** | High voltage line technical regulations |
| **RD 244/2019** | Self-consumption regulatory framework (administrative, technical, economic conditions) |
| **RD-Ley 7/2025** | Latest electricity system reform |
| **UNE-EN 50160** | Spanish national adoption of EN 50160 |
| **P.O. 12.2 (REE)** | Grid code - technical requirements for generation connected to transmission |

### 2.2 Voltage Limits

| Voltage Level | Nominal | Steady-State Band | Normative Reference |
|---|---|---|---|
| Low Voltage (BT) | 230/400 V | +/-7% (214-246 V phase-neutral) | RD 1955/2000, REBT |
| Medium Voltage (MT) | 10-25 kV | +/-7% | RD 1955/2000 |
| High Voltage (AT) | 45-132 kV | +/-5% to +/-10% | REE grid code P.O. 12.2 |
| Very High Voltage | 220-400 kV | Normal: up to 435 kV (REE), Disconnect: 440 kV | REE operational criteria |

> **Note:** Spain's adoption of EN 50160 (UNE-EN 50160) applies the +/-10% band as statistical limit, but RD 1955/2000 imposes a tighter +/-7% as the guaranteed quality band for supply voltage.

### 2.3 Thermal Limits

| Component | Limit | Reference |
|---|---|---|
| LV cables (Cu, XLPE) | Rated ampacity per UNE 21123 / IEC 60502 | REBT ITC-BT-07 |
| MV cables | Rated ampacity per IEC 60502 / UNE 21123 | Distributor technical specs |
| Transformers (MV/LV) | Nameplate rating (kVA), with emergency overload up to 120% for 2h | IEC 60076 / UNE 60076 |
| Overhead lines | Conductor thermal rating per ITC-LAT-07 | RD 223/2008 |

### 2.4 Power Quality (Harmonics, Flicker)

| Parameter | Limit | Reference |
|---|---|---|
| THD voltage | <= 8% | UNE-EN 50160 |
| Individual harmonics | Per EN 50160 table (see Section 1.3) | UNE-EN 50160 |
| Flicker Plt | <= 1.0 | UNE-EN 50160 |
| Power factor | >= 0.98 (for generation > 1 MW) | P.O. 12.2 |

### 2.5 DG Connection Rules (RD 244/2019)

| Parameter | Limit | Notes |
|---|---|---|
| Self-consumption without surplus | No access/connection permit needed | Anti-injection device required |
| Self-consumption with surplus <= 15 kW (urban) | Exempted from access/connection permits | Simplified process |
| Self-consumption with surplus > 15 kW | Requires access and connection permits from DSO | Full grid study |
| Compensation-eligible modality | <= 100 kW, renewable source only | Net billing scheme |
| Installations <= 100 kW | Per REBT regulations | |

### 2.6 Protection Coordination

| Protection | Setting | Reference |
|---|---|---|
| Over-voltage (stage 1) | 1.10 Uc, trip in 1.5 s | UNE-EN 50549-1 |
| Over-voltage (stage 2) | 1.15 Uc, trip in 0.2 s | UNE-EN 50549-1 |
| Under-voltage (stage 1) | 0.85 Uc, trip in 1.5 s | UNE-EN 50549-1 |
| Under-voltage (stage 2) | 0.50 Uc, trip in 0.2 s | UNE-EN 50549-1 |
| Over-frequency | 51.5 Hz, trip in 0.5 s | P.O. 12.2 |
| Under-frequency | 47.5 Hz, trip in 0.5 s | P.O. 12.2 |
| Anti-islanding | Passive + active detection | UNE-EN 50549-1 |

---

## 3. Switzerland

### 3.1 Regulatory Framework

| Standard / Regulation | Scope |
|---|---|
| **NIV (Niederspannungs-Installations-Verordnung)** | Low voltage installation ordinance (SR 734.27) |
| **StV (Starkstromverordnung)** | High voltage ordinance (SR 734.2) |
| **ElCom regulations** | Electricity commission - network access, capacity assessment |
| **EN 50160** (via SN EN 50160) | Power quality standard (Swiss national adoption) |
| **VSE (Verband Schweizerischer Elektrizitatsunternehmen)** | Industry association guidelines and technical rules |
| **DACHCZ Technical Rules** | Harmonized rules for Germany, Austria, Switzerland, Czech Republic |
| **SN EN 50549-1/2** | Requirements for generating plants to remain connected to the LV/MV network |

### 3.2 Voltage Limits

| Voltage Level | Nominal | Steady-State Band | Planning Level (voltage rise from DG) | Reference |
|---|---|---|---|---|
| Low Voltage (NS) | 230/400 V | +/-10% (SN EN 50160) | Max +3% voltage rise from DG at PCC | DACHCZ / VSE guidelines |
| Medium Voltage (MS) | 10-20 kV | +/-10% (SN EN 50160) | Max +2% voltage rise from DG at PCC | DACHCZ / VSE guidelines |
| High Voltage (HS) | 50-150 kV | +/-10% | Per Swissgrid requirements | StV |

> **Key HC Planning Rule:** The total voltage rise caused by all DG at any point on the LV feeder must not exceed **3%** of nominal voltage. For MV feeders, the limit is **2%**. This is the primary voltage constraint for hosting capacity assessment in Switzerland (aligned with DACHCZ rules).

### 3.3 Thermal Limits

| Component | Limit | Reference |
|---|---|---|
| LV cables | Rated ampacity per SN/IEC 60364 | NIV |
| MV cables | Rated ampacity per IEC 60502 | StV |
| Transformers (MS/NS) | Nameplate rating; typically 100-630 kVA for distribution | IEC 60076 |
| Overhead lines | Conductor thermal rating | StV |

### 3.4 Power Quality

| Parameter | Limit | Reference |
|---|---|---|
| THD voltage | <= 8% | SN EN 50160 |
| Individual harmonics | Per EN 50160 table (Section 1.3) | SN EN 50160 |
| Flicker Plt | <= 1.0 | SN EN 50160 |
| Voltage unbalance | <= 2% | SN EN 50160 |

### 3.5 DG Connection Rules

| Parameter | Requirement | Reference |
|---|---|---|
| Connection <= 3.6 kVA (single-phase) | Simplified notification to DSO | VSE guidelines |
| Connection <= 30 kVA | Notification + simplified assessment | VSE guidelines |
| Connection > 30 kVA | Full grid study required | ElCom / DSO |
| MV connection | ElCom assessment based on recognized norms | ElCom regulations |

### 3.6 Protection Coordination

| Protection | Setting | Reference |
|---|---|---|
| Over-voltage (stage 1) | 1.10 Un, trip in 3 s | SN EN 50549-1 |
| Over-voltage (stage 2) | 1.15 Un, trip in 0.2 s | SN EN 50549-1 |
| Under-voltage (stage 1) | 0.80 Un, trip in 3 s | SN EN 50549-1 |
| Under-voltage (stage 2) | 0.50 Un, trip in 0.2 s | SN EN 50549-1 |
| Over-frequency | 51.5 Hz, trip in 0.5 s | SN EN 50549-1 |
| Under-frequency | 47.0 Hz, trip in 0.5 s | SN EN 50549-1 |
| Anti-islanding | Required | SN EN 50549-1 |

---

## 4. Germany

### 4.1 Regulatory Framework

| Standard / Regulation | Scope |
|---|---|
| **VDE-AR-N 4105** | Technical connection rules for LV generation (<=100 kW, <1 kV) |
| **VDE-AR-N 4110** | Technical connection rules for MV generation (1-60 kV) |
| **VDE-AR-N 4120** | Technical connection rules for HV generation (60-220 kV) |
| **VDE-AR-N 4130** | Technical connection rules for EHV (>220 kV) |
| **EN 50160** (via DIN EN 50160) | Power quality standard |
| **DACHCZ Technical Rules** | Harmonized voltage planning levels |
| **EEG (Erneuerbare-Energien-Gesetz)** | Renewable energy act |

### 4.2 Voltage Limits

| Voltage Level | Nominal | Steady-State Band | Planning Level (voltage rise from DG) | Reference |
|---|---|---|---|---|
| Low Voltage (NS) | 230/400 V | +/-10% (DIN EN 50160) | Max **+3%** voltage rise from DG at PCC | VDE-AR-N 4105 |
| Medium Voltage (MS) | 10-20 kV | +/-10% (DIN EN 50160) | Max **+2%** voltage rise from DG at PCC | VDE-AR-N 4110 |
| High Voltage (HS) | 110 kV | +/-10% | Per TSO requirements | VDE-AR-N 4120 |

> **Key HC Rule:** The voltage at the PCC shall not change by more than **3%** (LV) or **2%** (MV) due to the connection of generating plants. This is evaluated as the max voltage change over a 10-minute period. This is the primary voltage constraint for hosting capacity.

### 4.3 Thermal Limits

| Component | Limit | Reference |
|---|---|---|
| LV cables | Rated ampacity per DIN VDE 0276 / IEC 60502 | VDE-AR-N 4105 |
| MV cables | Rated ampacity per IEC 60502 | VDE-AR-N 4110 |
| Transformers | Nameplate rating; emergency overload per IEC 60076 | |
| Overhead lines | Conductor thermal rating per DIN EN 50182 | |

### 4.4 Power Quality

| Parameter | Limit | Reference |
|---|---|---|
| THD voltage | <= 8% | DIN EN 50160 |
| Individual harmonics | Per EN 50160 table (Section 1.3) | DIN EN 50160 |
| Flicker Plt | <= 1.0 | DIN EN 50160 |
| Voltage unbalance | <= 2% | DIN EN 50160 |

### 4.5 Grid Support Requirements (VDE-AR-N 4105)

| Feature | Requirement | Notes |
|---|---|---|
| Reactive power capability | cos(phi) 0.90 inductive to 0.90 capacitive | Required for all DG |
| Q(U) control | Voltage-dependent reactive power | Can increase HC by managing voltage locally |
| P(f) control | Frequency-dependent active power reduction | Above 50.2 Hz, reduce at 40%/Hz |
| Fault ride-through | Must remain connected during short voltage dips | Supports grid stability |
| Disconnect limits | 253 V (10 min), 264 V (200 ms) | Upper voltage protection |

### 4.6 Protection Coordination

| Protection | Setting | Reference |
|---|---|---|
| Over-voltage (stage 1) | 1.10 Un (253 V), trip in 10 min | VDE-AR-N 4105 |
| Over-voltage (stage 2) | 1.15 Un (264 V), trip in 0.2 s | VDE-AR-N 4105 |
| Under-voltage (stage 1) | 0.80 Un, trip in 3 s to 10 min (adjustable) | VDE-AR-N 4105 |
| Under-voltage (stage 2) | 0.50 Un, trip in 0.2 s | VDE-AR-N 4105 |
| Over-frequency | 51.5 Hz, trip in 0.5 s | VDE-AR-N 4105 |
| Under-frequency | 47.0 Hz, trip in 0.5 s | VDE-AR-N 4105 |
| P(f) ramp | Above 50.2 Hz: reduce at 40%/Hz | VDE-AR-N 4105 |

---

## 5. Summary: Key HC Constraints by Country

| Constraint | Spain | Switzerland | Germany | EN 50160 (baseline) |
|---|---|---|---|---|
| **Voltage band (LV)** | +/-7% (RD 1955/2000) | +/-10% (EN 50160) | +/-10% (EN 50160) | +/-10% |
| **Voltage rise from DG (LV)** | Not explicitly defined (use EN 50160 margin) | +3% (DACHCZ) | +3% (VDE-AR-N 4105) | N/A |
| **Voltage rise from DG (MV)** | Not explicitly defined | +2% (DACHCZ) | +2% (VDE-AR-N 4110) | N/A |
| **THD** | <= 8% | <= 8% | <= 8% | <= 8% |
| **Flicker Plt** | <= 1.0 | <= 1.0 | <= 1.0 | <= 1.0 |
| **Voltage unbalance** | <= 2% | <= 2% | <= 2% | <= 2% |
| **Thermal** | IEC 60502 / UNE | IEC 60502 / SN | DIN VDE 0276 | N/A |
| **Protection (OV stage 2)** | 1.15 Uc, 0.2 s | 1.15 Un, 0.2 s | 1.15 Un, 0.2 s | N/A |
| **Reactive power** | PF >= 0.98 (>1MW) | Per DSO | cos(phi) 0.90 ind/cap | N/A |

---

## 6. Additional Countries (Brief Notes)

### 6.1 France
- **Standard:** NF EN 50160, Enedis technical documentation (NF C 14-100, NF C 15-100)
- **Voltage band (LV):** +/-10% (EN 50160)
- **DG voltage rise:** Typically +5% on LV feeders (Enedis planning rule)
- **Key regulation:** Arrete du 9 juin 2020 (technical requirements for DG connection)

### 6.2 Italy
- **Standard:** CEI EN 50160, CEI 0-21 (LV), CEI 0-16 (MV)
- **Voltage band (LV):** +/-10% (EN 50160)
- **DG voltage rise:** Planning level similar to DACHCZ (~3% LV, ~2% MV)
- **Key features:** CEI 0-21 mandates Q(U), P(f) control similar to VDE-AR-N 4105

### 6.3 United Kingdom
- **Standard:** BS EN 50160, Engineering Recommendation G99/G100
- **Voltage band (LV):** +10%/-6% (230V: 216.2-253 V) per ESQCR 2002
- **DG voltage rise:** Typically +3% for LV, +1-2% for HV (EREC P28, EREC P29)
- **Key features:** G99 defines protection settings, FRT, reactive power requirements

---

## 7. HC Calculation Methodology Notes

For hosting capacity assessment, the following constraints are typically checked at every node/bus:

1. **Voltage rise constraint:** Voltage at PCC must remain within the allowed band after DG connection. The voltage rise from DG must not exceed the planning level (3% LV / 2% MV in DACHCZ countries).

2. **Thermal constraint:** Current through lines and transformers must not exceed rated ampacity/capacity. Check both feeders and transformer loading.

3. **Power quality constraints:**
   - THD must remain <= 8%
   - Individual harmonics must remain within EN 50160 limits
   - Flicker Plt <= 1.0
   - Voltage unbalance <= 2%

4. **Protection coordination:** DG must not cause sympathetic tripping, must have proper anti-islanding, and protection relay settings must coordinate with upstream protection.

5. **Short-circuit capacity:** The ratio of short-circuit power at PCC to DG rated power (Ssc/Sn) must be sufficient. Typical minimum ratio: 25:1 (varies by DSO).

The **hosting capacity** is the maximum DG power (in kW or MW) that can be added before ANY of the above constraints is violated. The binding constraint (first one violated) determines the HC.
