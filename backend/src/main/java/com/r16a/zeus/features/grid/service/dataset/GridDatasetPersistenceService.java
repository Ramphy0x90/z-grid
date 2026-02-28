package com.r16a.zeus.features.grid.service.dataset;

import com.r16a.zeus.features.grid.model.Bus;
import com.r16a.zeus.features.grid.model.BusLayout;
import com.r16a.zeus.features.grid.model.EdgeLayout;
import com.r16a.zeus.features.grid.model.Generator;
import com.r16a.zeus.features.grid.model.Line;
import com.r16a.zeus.features.grid.model.Load;
import com.r16a.zeus.features.grid.model.ShuntCompensator;
import com.r16a.zeus.features.grid.model.Transformer;
import com.r16a.zeus.features.grid.repository.BusLayoutRepository;
import com.r16a.zeus.features.grid.repository.BusRepository;
import com.r16a.zeus.features.grid.repository.EdgeLayoutRepository;
import com.r16a.zeus.features.grid.repository.LineRepository;
import com.r16a.zeus.features.grid.repository.TransformerRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GridDatasetPersistenceService {
    private final BusRepository busRepository;
    private final LineRepository lineRepository;
    private final TransformerRepository transformerRepository;
    private final BusLayoutRepository busLayoutRepository;
    private final EdgeLayoutRepository edgeLayoutRepository;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public void replaceGridData(UUID gridId, GridDatasetImportModel importModel) {
        edgeLayoutRepository.deleteByGridId(gridId);
        busLayoutRepository.deleteByGridId(gridId);
        lineRepository.deleteByGridId(gridId);
        transformerRepository.deleteByGridId(gridId);
        busRepository.deleteByGridId(gridId);

        insertBuses(importModel.buses());
        insertLines(importModel.lines());
        insertTransformers(importModel.transformers());
        insertLoads(importModel.loads());
        insertGenerators(importModel.generators());
        insertShunts(importModel.shunts());
        insertBusLayouts(importModel.busLayouts());
        insertEdgeLayouts(importModel.edgeLayouts());
    }

    private void insertBuses(List<Bus> buses) {
        if (buses.isEmpty()) {
            return;
        }
        String sql = """
                INSERT INTO buses (
                    id, grid_id, name, nominal_voltage_kv, bus_type, voltage_magnitude_pu, voltage_angle_deg,
                    min_voltage_pu, max_voltage_pu, in_service, area, zone
                ) VALUES (
                    :id, :grid_id, :name, :nominal_voltage_kv, :bus_type, :voltage_magnitude_pu, :voltage_angle_deg,
                    :min_voltage_pu, :max_voltage_pu, :in_service, :area, :zone
                )
                """;
        Map<String, ?>[] batch = buses.stream().map(bus -> {
            Map<String, Object> params = new HashMap<>();
            params.put("id", bus.getId());
            params.put("grid_id", bus.getGridId());
            params.put("name", bus.getName());
            params.put("nominal_voltage_kv", bus.getNominalVoltageKv());
            params.put("bus_type", bus.getBusType() == null ? "PQ" : bus.getBusType().name());
            params.put("voltage_magnitude_pu", bus.getVoltageMagnitudePu());
            params.put("voltage_angle_deg", bus.getVoltageAngleDeg());
            params.put("min_voltage_pu", bus.getMinVoltagePu());
            params.put("max_voltage_pu", bus.getMaxVoltagePu());
            params.put("in_service", bus.isInService());
            params.put("area", bus.getArea());
            params.put("zone", bus.getZone());
            return params;
        }).toArray(Map[]::new);
        namedParameterJdbcTemplate.batchUpdate(sql, batch);
    }

    private void insertLines(List<Line> lines) {
        if (lines.isEmpty()) {
            return;
        }
        String sql = """
                INSERT INTO lines (
                    id, grid_id, from_bus_id, to_bus_id, name, resistance_pu, reactance_pu, susceptance_pu,
                    rating_mva, length_km, in_service, rating_mva_short_term, max_loading_percent,
                    from_switch_closed, to_switch_closed
                ) VALUES (
                    :id, :grid_id, :from_bus_id, :to_bus_id, :name, :resistance_pu, :reactance_pu, :susceptance_pu,
                    :rating_mva, :length_km, :in_service, :rating_mva_short_term, :max_loading_percent,
                    :from_switch_closed, :to_switch_closed
                )
                """;
        Map<String, ?>[] batch = lines.stream().map(line -> {
            Map<String, Object> params = new HashMap<>();
            params.put("id", line.getId());
            params.put("grid_id", line.getGridId());
            params.put("from_bus_id", line.getFromBusId());
            params.put("to_bus_id", line.getToBusId());
            params.put("name", line.getName());
            params.put("resistance_pu", line.getResistancePu());
            params.put("reactance_pu", line.getReactancePu());
            params.put("susceptance_pu", line.getSusceptancePu());
            params.put("rating_mva", line.getRatingMva());
            params.put("length_km", line.getLengthKm());
            params.put("in_service", line.isInService());
            params.put("rating_mva_short_term", line.getRatingMvaShortTerm());
            params.put("max_loading_percent", line.getMaxLoadingPercent());
            params.put("from_switch_closed", line.isFromSwitchClosed());
            params.put("to_switch_closed", line.isToSwitchClosed());
            return params;
        }).toArray(Map[]::new);
        namedParameterJdbcTemplate.batchUpdate(sql, batch);
    }

    private void insertTransformers(List<Transformer> transformers) {
        if (transformers.isEmpty()) {
            return;
        }
        String sql = """
                INSERT INTO transformers (
                    id, grid_id, from_bus_id, to_bus_id, name, resistance_pu, reactance_pu, rating_mva,
                    tap_ratio, phase_shift_deg, in_service, sn_mva, tap_min, tap_max, tap_step_percent,
                    tap_side, winding_type, max_loading_percent, from_switch_closed, to_switch_closed
                ) VALUES (
                    :id, :grid_id, :from_bus_id, :to_bus_id, :name, :resistance_pu, :reactance_pu, :rating_mva,
                    :tap_ratio, :phase_shift_deg, :in_service, :sn_mva, :tap_min, :tap_max, :tap_step_percent,
                    :tap_side, :winding_type, :max_loading_percent, :from_switch_closed, :to_switch_closed
                )
                """;
        Map<String, ?>[] batch = transformers.stream().map(transformer -> {
            Map<String, Object> params = new HashMap<>();
            params.put("id", transformer.getId());
            params.put("grid_id", transformer.getGridId());
            params.put("from_bus_id", transformer.getFromBusId());
            params.put("to_bus_id", transformer.getToBusId());
            params.put("name", transformer.getName());
            params.put("resistance_pu", transformer.getResistancePu());
            params.put("reactance_pu", transformer.getReactancePu());
            params.put("rating_mva", transformer.getRatingMva());
            params.put("tap_ratio", transformer.getTapRatio());
            params.put("phase_shift_deg", transformer.getPhaseShiftDeg());
            params.put("in_service", transformer.isInService());
            params.put("sn_mva", transformer.getSnMva());
            params.put("tap_min", transformer.getTapMin());
            params.put("tap_max", transformer.getTapMax());
            params.put("tap_step_percent", transformer.getTapStepPercent());
            params.put("tap_side", transformer.getTapSide() == null ? "FROM" : transformer.getTapSide().name());
            params.put("winding_type", transformer.getWindingType() == null ? null : transformer.getWindingType().name());
            params.put("max_loading_percent", transformer.getMaxLoadingPercent());
            params.put("from_switch_closed", transformer.isFromSwitchClosed());
            params.put("to_switch_closed", transformer.isToSwitchClosed());
            return params;
        }).toArray(Map[]::new);
        namedParameterJdbcTemplate.batchUpdate(sql, batch);
    }

    private void insertLoads(List<Load> loads) {
        if (loads.isEmpty()) {
            return;
        }
        String sql = """
                INSERT INTO loads (
                    id, bus_id, name, active_power_mw, reactive_power_mvar, in_service, load_type, scaling_factor
                ) VALUES (
                    :id, :bus_id, :name, :active_power_mw, :reactive_power_mvar, :in_service, :load_type, :scaling_factor
                )
                """;
        Map<String, ?>[] batch = loads.stream().map(load -> {
            Map<String, Object> params = new HashMap<>();
            params.put("id", load.getId());
            params.put("bus_id", load.getBusId());
            params.put("name", load.getName());
            params.put("active_power_mw", load.getActivePowerMw());
            params.put("reactive_power_mvar", load.getReactivePowerMvar());
            params.put("in_service", load.isInService());
            params.put("load_type", load.getLoadType() == null ? "PQ" : load.getLoadType().name());
            params.put("scaling_factor", load.getScalingFactor());
            return params;
        }).toArray(Map[]::new);
        namedParameterJdbcTemplate.batchUpdate(sql, batch);
    }

    private void insertGenerators(List<Generator> generators) {
        if (generators.isEmpty()) {
            return;
        }
        String sql = """
                INSERT INTO generators (
                    id, bus_id, name, active_power_mw, reactive_power_mvar, voltage_pu, min_mw, max_mw,
                    in_service, min_mvar, max_mvar, xdpp_pu, cost_a, cost_b, cost_c, ramp_rate_mw_per_min
                ) VALUES (
                    :id, :bus_id, :name, :active_power_mw, :reactive_power_mvar, :voltage_pu, :min_mw, :max_mw,
                    :in_service, :min_mvar, :max_mvar, :xdpp_pu, :cost_a, :cost_b, :cost_c, :ramp_rate_mw_per_min
                )
                """;
        Map<String, ?>[] batch = generators.stream().map(generator -> {
            Map<String, Object> params = new HashMap<>();
            params.put("id", generator.getId());
            params.put("bus_id", generator.getBusId());
            params.put("name", generator.getName());
            params.put("active_power_mw", generator.getActivePowerMw());
            params.put("reactive_power_mvar", generator.getReactivePowerMvar());
            params.put("voltage_pu", generator.getVoltagePu());
            params.put("min_mw", generator.getMinMw());
            params.put("max_mw", generator.getMaxMw());
            params.put("in_service", generator.isInService());
            params.put("min_mvar", generator.getMinMvar());
            params.put("max_mvar", generator.getMaxMvar());
            params.put("xdpp_pu", generator.getXdppPu());
            params.put("cost_a", generator.getCostA());
            params.put("cost_b", generator.getCostB());
            params.put("cost_c", generator.getCostC());
            params.put("ramp_rate_mw_per_min", generator.getRampRateMwPerMin());
            return params;
        }).toArray(Map[]::new);
        namedParameterJdbcTemplate.batchUpdate(sql, batch);
    }

    private void insertShunts(List<ShuntCompensator> shunts) {
        if (shunts.isEmpty()) {
            return;
        }
        String sql = """
                INSERT INTO shunt_compensators (
                    id, bus_id, name, shunt_type, q_mvar, max_step, current_step, in_service
                ) VALUES (
                    :id, :bus_id, :name, :shunt_type, :q_mvar, :max_step, :current_step, :in_service
                )
                """;
        Map<String, ?>[] batch = shunts.stream().map(shunt -> {
            Map<String, Object> params = new HashMap<>();
            params.put("id", shunt.getId());
            params.put("bus_id", shunt.getBusId());
            params.put("name", shunt.getName());
            params.put("shunt_type", shunt.getShuntType() == null ? "CAPACITOR" : shunt.getShuntType().name());
            params.put("q_mvar", shunt.getQMvar());
            params.put("max_step", shunt.getMaxStep());
            params.put("current_step", shunt.getCurrentStep());
            params.put("in_service", shunt.isInService());
            return params;
        }).toArray(Map[]::new);
        namedParameterJdbcTemplate.batchUpdate(sql, batch);
    }

    private void insertBusLayouts(List<BusLayout> layouts) {
        if (layouts.isEmpty()) {
            return;
        }
        String sql = """
                INSERT INTO bus_layouts (
                    bus_id, grid_id, lat, lng, schematic_x, schematic_y
                ) VALUES (
                    :bus_id, :grid_id, :lat, :lng, :schematic_x, :schematic_y
                )
                """;
        Map<String, ?>[] batch = layouts.stream().map(layout -> {
            Map<String, Object> params = new HashMap<>();
            params.put("bus_id", layout.getBusId());
            params.put("grid_id", layout.getGridId());
            params.put("lat", layout.getLat());
            params.put("lng", layout.getLng());
            params.put("schematic_x", layout.getSchematicX());
            params.put("schematic_y", layout.getSchematicY());
            return params;
        }).toArray(Map[]::new);
        namedParameterJdbcTemplate.batchUpdate(sql, batch);
    }

    private void insertEdgeLayouts(List<EdgeLayout> layouts) {
        if (layouts.isEmpty()) {
            return;
        }
        String sql = """
                INSERT INTO edge_layouts (
                    edge_id, grid_id, map_midpoint_x, map_midpoint_y, schematic_midpoint_x, schematic_midpoint_y
                ) VALUES (
                    :edge_id, :grid_id, :map_midpoint_x, :map_midpoint_y, :schematic_midpoint_x, :schematic_midpoint_y
                )
                """;
        Map<String, ?>[] batch = layouts.stream().map(layout -> {
            Map<String, Object> params = new HashMap<>();
            params.put("edge_id", layout.getEdgeId());
            params.put("grid_id", layout.getGridId());
            params.put("map_midpoint_x", layout.getMapMidpointX());
            params.put("map_midpoint_y", layout.getMapMidpointY());
            params.put("schematic_midpoint_x", layout.getSchematicMidpointX());
            params.put("schematic_midpoint_y", layout.getSchematicMidpointY());
            return params;
        }).toArray(Map[]::new);
        namedParameterJdbcTemplate.batchUpdate(sql, batch);
    }
}
