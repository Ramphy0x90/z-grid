package com.r16a.zeus.features.grid.service.dataset;

import com.r16a.zeus.features.grid.model.Bus;
import com.r16a.zeus.features.grid.model.BusLayout;
import com.r16a.zeus.features.grid.model.EdgeLayout;
import com.r16a.zeus.features.grid.model.Generator;
import com.r16a.zeus.features.grid.model.Grid;
import com.r16a.zeus.features.grid.model.Line;
import com.r16a.zeus.features.grid.model.Load;
import com.r16a.zeus.features.grid.model.ShuntCompensator;
import com.r16a.zeus.features.grid.model.Transformer;
import com.r16a.zeus.features.grid.model.type.BusType;
import com.r16a.zeus.features.grid.model.type.LoadType;
import com.r16a.zeus.features.grid.model.type.ShuntType;
import com.r16a.zeus.features.grid.model.type.TapSide;
import com.r16a.zeus.features.grid.model.type.WindingType;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
@RequiredArgsConstructor
public class GridDatasetMapper {
    public static final double DEFAULT_BASE_MVA = 100.0;
    public static final double DEFAULT_FREQUENCY_HZ = 50.0;

    private final ObjectMapper objectMapper;

    public GridDatasetImportModel fromJson(UUID gridId, Grid grid, JsonNode dataset) {
        ObjectNode normalized = dataset != null && dataset.isObject()
                ? (ObjectNode) dataset.deepCopy()
                : objectMapper.createObjectNode();

        JsonNode gridNode = normalized.get("grid");
        String name = grid.getName();
        String description = grid.getDescription() == null ? "" : grid.getDescription();
        double baseMva = grid.getBaseMva() == null ? DEFAULT_BASE_MVA : grid.getBaseMva();
        double frequencyHz = grid.getFrequencyHz() == null ? DEFAULT_FREQUENCY_HZ : grid.getFrequencyHz();
        if (gridNode != null && gridNode.isObject()) {
            baseMva = getDouble(gridNode, "baseMva", baseMva);
            frequencyHz = getDouble(gridNode, "frequencyHz", frequencyHz);
            name = getText(gridNode, "name", name);
            description = getText(gridNode, "description", description);
        }

        Map<String, UUID> busIdMap = new HashMap<>();
        List<Bus> buses = parseBuses(gridId, normalized.get("buses"), busIdMap);
        Map<String, UUID> edgeIdMap = new HashMap<>();
        List<Line> lines = parseLines(gridId, normalized.get("lines"), busIdMap, edgeIdMap);
        List<Transformer> transformers = parseTransformers(gridId, normalized.get("transformers"), busIdMap, edgeIdMap);
        List<Load> loads = parseLoads(normalized.get("loads"), busIdMap);
        List<Generator> generators = parseGenerators(normalized.get("generators"), busIdMap);
        List<ShuntCompensator> shunts = parseShunts(normalized.get("shuntCompensators"), busIdMap);
        List<BusLayout> busLayouts = parseBusLayouts(gridId, normalized.get("busLayout"), busIdMap);
        List<EdgeLayout> edgeLayouts = parseEdgeLayouts(gridId, normalized.get("edgeLayout"), edgeIdMap);

        return new GridDatasetImportModel(
                name == null ? "Grid" : name,
                description == null ? "" : description,
                baseMva,
                frequencyHz,
                buses,
                lines,
                transformers,
                loads,
                generators,
                shunts,
                busLayouts,
                edgeLayouts
        );
    }

    public JsonNode toJson(Grid grid, GridDatasetSnapshot snapshot) {
        ObjectNode root = buildDefaultDataset(grid);
        root.set("buses", buildBusesArray(snapshot.buses()));
        root.set("lines", buildLinesArray(snapshot.lines()));
        root.set("transformers", buildTransformersArray(snapshot.transformers()));
        root.set("loads", buildLoadsArray(snapshot.loads()));
        root.set("generators", buildGeneratorsArray(snapshot.generators()));
        root.set("shuntCompensators", buildShuntsArray(snapshot.shunts()));
        root.set("busLayout", buildBusLayoutsArray(snapshot.busLayouts()));
        root.set("edgeLayout", buildEdgeLayoutsArray(snapshot.edgeLayouts()));
        return root;
    }

    private ObjectNode buildDefaultDataset(Grid grid) {
        ObjectNode root = objectMapper.createObjectNode();
        root.set("grid", buildGridNode(grid));
        root.set("buses", objectMapper.createArrayNode());
        root.set("lines", objectMapper.createArrayNode());
        root.set("transformers", objectMapper.createArrayNode());
        root.set("loads", objectMapper.createArrayNode());
        root.set("generators", objectMapper.createArrayNode());
        root.set("shuntCompensators", objectMapper.createArrayNode());
        root.set("busLayout", objectMapper.createArrayNode());
        root.set("edgeLayout", objectMapper.createArrayNode());
        return root;
    }

    private ObjectNode buildGridNode(Grid grid) {
        ObjectNode gridNode = objectMapper.createObjectNode();
        gridNode.put("id", grid.getId().toString());
        gridNode.put("projectId", grid.getProjectId().toString());
        gridNode.put("name", grid.getName());
        gridNode.put("description", grid.getDescription() == null ? "" : grid.getDescription());
        gridNode.put("baseMva", grid.getBaseMva() == null ? DEFAULT_BASE_MVA : grid.getBaseMva());
        gridNode.put("frequencyHz", grid.getFrequencyHz() == null ? DEFAULT_FREQUENCY_HZ : grid.getFrequencyHz());
        return gridNode;
    }

    private ArrayNode buildBusesArray(List<Bus> buses) {
        ArrayNode array = objectMapper.createArrayNode();
        for (Bus bus : buses) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("id", bus.getId().toString());
            node.put("gridId", bus.getGridId().toString());
            node.put("name", bus.getName());
            node.put("nominalVoltageKv", nullableDouble(bus.getNominalVoltageKv()));
            node.put("busType", bus.getBusType() == null ? BusType.PQ.name() : bus.getBusType().name());
            node.put("voltageMagnitudePu", nullableDouble(bus.getVoltageMagnitudePu()));
            node.put("voltageAngleDeg", nullableDouble(bus.getVoltageAngleDeg()));
            node.put("minVoltagePu", nullableDouble(bus.getMinVoltagePu()));
            node.put("maxVoltagePu", nullableDouble(bus.getMaxVoltagePu()));
            node.put("inService", bus.isInService());
            node.put("area", bus.getArea() == null ? "1" : String.valueOf(bus.getArea()));
            node.put("zone", bus.getZone() == null ? "1" : String.valueOf(bus.getZone()));
            array.add(node);
        }
        return array;
    }

    private ArrayNode buildLinesArray(List<Line> lines) {
        ArrayNode array = objectMapper.createArrayNode();
        for (Line line : lines) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("id", line.getId().toString());
            node.put("gridId", line.getGridId().toString());
            node.put("fromBusId", line.getFromBusId().toString());
            node.put("toBusId", line.getToBusId().toString());
            node.put("name", line.getName());
            node.put("resistancePu", nullableDouble(line.getResistancePu()));
            node.put("reactancePu", nullableDouble(line.getReactancePu()));
            node.put("susceptancePu", nullableDouble(line.getSusceptancePu()));
            node.put("ratingMva", nullableDouble(line.getRatingMva()));
            node.put("lengthKm", nullableDouble(line.getLengthKm()));
            node.put("inService", line.isInService());
            node.put("ratingMvaShortTerm", nullableDouble(line.getRatingMvaShortTerm()));
            node.put("maxLoadingPercent", nullableDouble(line.getMaxLoadingPercent()));
            node.put("fromSwitchClosed", line.isFromSwitchClosed());
            node.put("toSwitchClosed", line.isToSwitchClosed());
            array.add(node);
        }
        return array;
    }

    private ArrayNode buildTransformersArray(List<Transformer> transformers) {
        ArrayNode array = objectMapper.createArrayNode();
        for (Transformer transformer : transformers) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("id", transformer.getId().toString());
            node.put("gridId", transformer.getGridId().toString());
            node.put("fromBusId", transformer.getFromBusId().toString());
            node.put("toBusId", transformer.getToBusId().toString());
            node.put("name", transformer.getName());
            node.put("resistancePu", nullableDouble(transformer.getResistancePu()));
            node.put("reactancePu", nullableDouble(transformer.getReactancePu()));
            node.put("ratingMva", nullableDouble(transformer.getRatingMva()));
            node.put("tapRatio", nullableDouble(transformer.getTapRatio()));
            node.put("phaseShiftDeg", nullableDouble(transformer.getPhaseShiftDeg()));
            node.put("inService", transformer.isInService());
            node.put("snMva", nullableDouble(transformer.getSnMva()));
            node.put("tapMin", nullableDouble(transformer.getTapMin()));
            node.put("tapMax", nullableDouble(transformer.getTapMax()));
            node.put("tapStepPercent", nullableDouble(transformer.getTapStepPercent()));
            node.put("tapSide", toFrontendTapSide(transformer.getTapSide()));
            node.put("windingType", toFrontendWindingType(transformer.getWindingType()));
            node.put("maxLoadingPercent", nullableDouble(transformer.getMaxLoadingPercent()));
            node.put("fromSwitchClosed", transformer.isFromSwitchClosed());
            node.put("toSwitchClosed", transformer.isToSwitchClosed());
            array.add(node);
        }
        return array;
    }

    private ArrayNode buildLoadsArray(List<Load> loads) {
        ArrayNode array = objectMapper.createArrayNode();
        for (Load load : loads) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("id", load.getId().toString());
            node.put("busId", load.getBusId().toString());
            node.put("name", load.getName());
            node.put("activePowerMw", nullableDouble(load.getActivePowerMw()));
            node.put("reactivePowerMvar", nullableDouble(load.getReactivePowerMvar()));
            node.put("inService", load.isInService());
            node.put("loadType", load.getLoadType() == null ? LoadType.PQ.name() : load.getLoadType().name());
            node.put("scalingFactor", nullableDouble(load.getScalingFactor()));
            array.add(node);
        }
        return array;
    }

    private ArrayNode buildGeneratorsArray(List<Generator> generators) {
        ArrayNode array = objectMapper.createArrayNode();
        for (Generator generator : generators) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("id", generator.getId().toString());
            node.put("busId", generator.getBusId().toString());
            node.put("name", generator.getName());
            node.put("activePowerMw", nullableDouble(generator.getActivePowerMw()));
            node.put("reactivePowerMvar", nullableDouble(generator.getReactivePowerMvar()));
            node.put("voltagePu", nullableDouble(generator.getVoltagePu()));
            node.put("minMw", nullableDouble(generator.getMinMw()));
            node.put("maxMw", nullableDouble(generator.getMaxMw()));
            node.put("inService", generator.isInService());
            node.put("minMvar", nullableDouble(generator.getMinMvar()));
            node.put("maxMvar", nullableDouble(generator.getMaxMvar()));
            node.put("xdppPu", nullableDouble(generator.getXdppPu()));
            node.put("costA", nullableDouble(generator.getCostA()));
            node.put("costB", nullableDouble(generator.getCostB()));
            node.put("costC", nullableDouble(generator.getCostC()));
            node.put("rampRateMwPerMin", nullableDouble(generator.getRampRateMwPerMin()));
            array.add(node);
        }
        return array;
    }

    private ArrayNode buildShuntsArray(List<ShuntCompensator> shunts) {
        ArrayNode array = objectMapper.createArrayNode();
        for (ShuntCompensator shunt : shunts) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("id", shunt.getId().toString());
            node.put("busId", shunt.getBusId().toString());
            node.put("name", shunt.getName());
            node.put("shuntType", shunt.getShuntType() == null ? ShuntType.CAPACITOR.name() : shunt.getShuntType().name());
            node.put("qMvar", nullableDouble(shunt.getQMvar()));
            node.put("maxStep", shunt.getMaxStep() == null ? 1 : shunt.getMaxStep());
            node.put("currentStep", shunt.getCurrentStep() == null ? 1 : shunt.getCurrentStep());
            node.put("inService", shunt.isInService());
            array.add(node);
        }
        return array;
    }

    private ArrayNode buildBusLayoutsArray(List<BusLayout> busLayouts) {
        ArrayNode array = objectMapper.createArrayNode();
        for (BusLayout layout : busLayouts) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("busId", layout.getBusId().toString());
            node.put("lat", nullableDouble(layout.getLat()));
            node.put("lng", nullableDouble(layout.getLng()));
            node.put("schematicX", nullableDouble(layout.getSchematicX()));
            node.put("schematicY", nullableDouble(layout.getSchematicY()));
            array.add(node);
        }
        return array;
    }

    private ArrayNode buildEdgeLayoutsArray(List<EdgeLayout> edgeLayouts) {
        ArrayNode array = objectMapper.createArrayNode();
        for (EdgeLayout layout : edgeLayouts) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("edgeId", layout.getEdgeId().toString());
            if (layout.getMapMidpointX() != null && layout.getMapMidpointY() != null) {
                ArrayNode tuple = objectMapper.createArrayNode();
                tuple.add(layout.getMapMidpointX());
                tuple.add(layout.getMapMidpointY());
                node.set("mapMidpoint", tuple);
            }
            if (layout.getSchematicMidpointX() != null && layout.getSchematicMidpointY() != null) {
                ArrayNode tuple = objectMapper.createArrayNode();
                tuple.add(layout.getSchematicMidpointX());
                tuple.add(layout.getSchematicMidpointY());
                node.set("schematicMidpoint", tuple);
            }
            array.add(node);
        }
        return array;
    }

    private List<Bus> parseBuses(UUID gridId, JsonNode busesNode, Map<String, UUID> busIdMap) {
        List<Bus> buses = new ArrayList<>();
        if (!(busesNode instanceof ArrayNode busesArray)) {
            return buses;
        }
        for (JsonNode busNode : busesArray) {
            String clientId = getText(busNode, "id", UUID.randomUUID().toString());
            UUID busId = parseUuidOrRandom(clientId);
            busIdMap.put(clientId, busId);
            buses.add(Bus.builder()
                    .id(busId)
                    .gridId(gridId)
                    .name(getText(busNode, "name", "Bus"))
                    .nominalVoltageKv(getDouble(busNode, "nominalVoltageKv", 0.0))
                    .busType(parseBusType(getText(busNode, "busType", BusType.PQ.name())))
                    .voltageMagnitudePu(getDouble(busNode, "voltageMagnitudePu", 1.0))
                    .voltageAngleDeg(getDouble(busNode, "voltageAngleDeg", 0.0))
                    .minVoltagePu(getDouble(busNode, "minVoltagePu", 0.95))
                    .maxVoltagePu(getDouble(busNode, "maxVoltagePu", 1.05))
                    .inService(getBoolean(busNode, "inService", true))
                    .area(parseIntegerLike(busNode, "area", 1))
                    .zone(parseIntegerLike(busNode, "zone", 1))
                    .build());
        }
        return buses;
    }

    private List<Line> parseLines(UUID gridId, JsonNode linesNode, Map<String, UUID> busIdMap, Map<String, UUID> edgeIdMap) {
        List<Line> lines = new ArrayList<>();
        if (!(linesNode instanceof ArrayNode linesArray)) {
            return lines;
        }
        for (JsonNode lineNode : linesArray) {
            UUID fromBusId = mapBusReference(lineNode, "fromBusId", busIdMap);
            UUID toBusId = mapBusReference(lineNode, "toBusId", busIdMap);
            if (fromBusId == null || toBusId == null) {
                continue;
            }
            String clientEdgeId = getText(lineNode, "id", UUID.randomUUID().toString());
            UUID edgeId = parseUuidOrRandom(clientEdgeId);
            edgeIdMap.put(clientEdgeId, edgeId);
            lines.add(Line.builder()
                    .id(edgeId)
                    .gridId(gridId)
                    .fromBusId(fromBusId)
                    .toBusId(toBusId)
                    .name(getText(lineNode, "name", "Line"))
                    .resistancePu(getDouble(lineNode, "resistancePu", 0.0))
                    .reactancePu(getDouble(lineNode, "reactancePu", 0.0))
                    .susceptancePu(getDouble(lineNode, "susceptancePu", 0.0))
                    .ratingMva(getDouble(lineNode, "ratingMva", 0.0))
                    .lengthKm(getDouble(lineNode, "lengthKm", 0.0))
                    .inService(getBoolean(lineNode, "inService", true))
                    .ratingMvaShortTerm(getDouble(lineNode, "ratingMvaShortTerm", 0.0))
                    .maxLoadingPercent(getDouble(lineNode, "maxLoadingPercent", 100.0))
                    .fromSwitchClosed(getBoolean(lineNode, "fromSwitchClosed", true))
                    .toSwitchClosed(getBoolean(lineNode, "toSwitchClosed", true))
                    .build());
        }
        return lines;
    }

    private List<Transformer> parseTransformers(
            UUID gridId,
            JsonNode transformersNode,
            Map<String, UUID> busIdMap,
            Map<String, UUID> edgeIdMap
    ) {
        List<Transformer> transformers = new ArrayList<>();
        if (!(transformersNode instanceof ArrayNode transformersArray)) {
            return transformers;
        }
        for (JsonNode transformerNode : transformersArray) {
            UUID fromBusId = mapBusReference(transformerNode, "fromBusId", busIdMap);
            UUID toBusId = mapBusReference(transformerNode, "toBusId", busIdMap);
            if (fromBusId == null || toBusId == null) {
                continue;
            }
            String clientEdgeId = getText(transformerNode, "id", UUID.randomUUID().toString());
            UUID edgeId = parseUuidOrRandom(clientEdgeId);
            edgeIdMap.put(clientEdgeId, edgeId);
            transformers.add(Transformer.builder()
                    .id(edgeId)
                    .gridId(gridId)
                    .fromBusId(fromBusId)
                    .toBusId(toBusId)
                    .name(getText(transformerNode, "name", "Transformer"))
                    .resistancePu(getDouble(transformerNode, "resistancePu", 0.0))
                    .reactancePu(getDouble(transformerNode, "reactancePu", 0.0))
                    .ratingMva(getDouble(transformerNode, "ratingMva", 0.0))
                    .tapRatio(getDouble(transformerNode, "tapRatio", 1.0))
                    .phaseShiftDeg(getDouble(transformerNode, "phaseShiftDeg", 0.0))
                    .inService(getBoolean(transformerNode, "inService", true))
                    .snMva(getDouble(transformerNode, "snMva", getDouble(transformerNode, "ratingMva", 0.0)))
                    .tapMin(getDouble(transformerNode, "tapMin", 0.9))
                    .tapMax(getDouble(transformerNode, "tapMax", 1.1))
                    .tapStepPercent(getDouble(transformerNode, "tapStepPercent", 1.25))
                    .tapSide(mapTapSide(getText(transformerNode, "tapSide", "FROM")))
                    .windingType(mapWindingType(getText(transformerNode, "windingType", "YNyn")))
                    .maxLoadingPercent(getDouble(transformerNode, "maxLoadingPercent", 100.0))
                    .fromSwitchClosed(getBoolean(transformerNode, "fromSwitchClosed", true))
                    .toSwitchClosed(getBoolean(transformerNode, "toSwitchClosed", true))
                    .build());
        }
        return transformers;
    }

    private List<Load> parseLoads(JsonNode loadsNode, Map<String, UUID> busIdMap) {
        List<Load> loads = new ArrayList<>();
        if (!(loadsNode instanceof ArrayNode loadsArray)) {
            return loads;
        }
        for (JsonNode loadNode : loadsArray) {
            UUID busId = mapBusReference(loadNode, "busId", busIdMap);
            if (busId == null) {
                continue;
            }
            loads.add(Load.builder()
                    .id(parseUuidOrRandom(getText(loadNode, "id", UUID.randomUUID().toString())))
                    .busId(busId)
                    .name(getText(loadNode, "name", "Load"))
                    .activePowerMw(getDouble(loadNode, "activePowerMw", 0.0))
                    .reactivePowerMvar(getDouble(loadNode, "reactivePowerMvar", 0.0))
                    .inService(getBoolean(loadNode, "inService", true))
                    .loadType(parseLoadType(getText(loadNode, "loadType", LoadType.PQ.name())))
                    .scalingFactor(getDouble(loadNode, "scalingFactor", 1.0))
                    .build());
        }
        return loads;
    }

    private List<Generator> parseGenerators(JsonNode generatorsNode, Map<String, UUID> busIdMap) {
        List<Generator> generators = new ArrayList<>();
        if (!(generatorsNode instanceof ArrayNode generatorsArray)) {
            return generators;
        }
        for (JsonNode generatorNode : generatorsArray) {
            UUID busId = mapBusReference(generatorNode, "busId", busIdMap);
            if (busId == null) {
                continue;
            }
            generators.add(Generator.builder()
                    .id(parseUuidOrRandom(getText(generatorNode, "id", UUID.randomUUID().toString())))
                    .busId(busId)
                    .name(getText(generatorNode, "name", "Generator"))
                    .activePowerMw(getDouble(generatorNode, "activePowerMw", 0.0))
                    .reactivePowerMvar(getDouble(generatorNode, "reactivePowerMvar", 0.0))
                    .voltagePu(getDouble(generatorNode, "voltagePu", 1.0))
                    .minMw(getDouble(generatorNode, "minMw", 0.0))
                    .maxMw(getDouble(generatorNode, "maxMw", 0.0))
                    .inService(getBoolean(generatorNode, "inService", true))
                    .minMvar(getDouble(generatorNode, "minMvar", 0.0))
                    .maxMvar(getDouble(generatorNode, "maxMvar", 0.0))
                    .xdppPu(getDouble(generatorNode, "xdppPu", 0.0))
                    .costA(getDouble(generatorNode, "costA", 0.0))
                    .costB(getDouble(generatorNode, "costB", 0.0))
                    .costC(getDouble(generatorNode, "costC", 0.0))
                    .rampRateMwPerMin(getDouble(generatorNode, "rampRateMwPerMin", 0.0))
                    .build());
        }
        return generators;
    }

    private List<ShuntCompensator> parseShunts(JsonNode shuntsNode, Map<String, UUID> busIdMap) {
        List<ShuntCompensator> shunts = new ArrayList<>();
        if (!(shuntsNode instanceof ArrayNode shuntsArray)) {
            return shunts;
        }
        for (JsonNode shuntNode : shuntsArray) {
            UUID busId = mapBusReference(shuntNode, "busId", busIdMap);
            if (busId == null) {
                continue;
            }
            shunts.add(ShuntCompensator.builder()
                    .id(parseUuidOrRandom(getText(shuntNode, "id", UUID.randomUUID().toString())))
                    .busId(busId)
                    .name(getText(shuntNode, "name", "Shunt"))
                    .shuntType(parseShuntType(getText(shuntNode, "shuntType", ShuntType.CAPACITOR.name())))
                    .qMvar(getDouble(shuntNode, "qMvar", 0.0))
                    .maxStep((int) getDouble(shuntNode, "maxStep", 1))
                    .currentStep((int) getDouble(shuntNode, "currentStep", 1))
                    .inService(getBoolean(shuntNode, "inService", true))
                    .build());
        }
        return shunts;
    }

    private List<BusLayout> parseBusLayouts(UUID gridId, JsonNode busLayoutNode, Map<String, UUID> busIdMap) {
        List<BusLayout> busLayouts = new ArrayList<>();
        if (!(busLayoutNode instanceof ArrayNode busLayoutsArray)) {
            return busLayouts;
        }
        for (JsonNode layoutNode : busLayoutsArray) {
            UUID busId = mapBusReference(layoutNode, "busId", busIdMap);
            if (busId == null) {
                continue;
            }
            busLayouts.add(BusLayout.builder()
                    .busId(busId)
                    .gridId(gridId)
                    .lat(getDouble(layoutNode, "lat", 0.0))
                    .lng(getDouble(layoutNode, "lng", 0.0))
                    .schematicX(getDouble(layoutNode, "schematicX", 0.0))
                    .schematicY(getDouble(layoutNode, "schematicY", 0.0))
                    .build());
        }
        return busLayouts;
    }

    private List<EdgeLayout> parseEdgeLayouts(UUID gridId, JsonNode edgeLayoutNode, Map<String, UUID> edgeIdMap) {
        List<EdgeLayout> edgeLayouts = new ArrayList<>();
        if (!(edgeLayoutNode instanceof ArrayNode edgeLayoutsArray)) {
            return edgeLayouts;
        }
        for (JsonNode layoutNode : edgeLayoutsArray) {
            String edgeIdText = getText(layoutNode, "edgeId", null);
            if (edgeIdText == null || edgeIdText.isBlank()) {
                continue;
            }
            UUID edgeId = edgeIdMap.get(edgeIdText);
            if (edgeId == null) {
                continue;
            }
            edgeLayouts.add(EdgeLayout.builder()
                    .edgeId(edgeId)
                    .gridId(gridId)
                    .mapMidpointX(getTupleValue(layoutNode, "mapMidpoint", 0))
                    .mapMidpointY(getTupleValue(layoutNode, "mapMidpoint", 1))
                    .schematicMidpointX(getTupleValue(layoutNode, "schematicMidpoint", 0))
                    .schematicMidpointY(getTupleValue(layoutNode, "schematicMidpoint", 1))
                    .build());
        }
        return edgeLayouts;
    }

    private UUID mapBusReference(JsonNode node, String fieldName, Map<String, UUID> busIdMap) {
        String ref = getText(node, fieldName, null);
        if (ref == null) {
            return null;
        }
        UUID mapped = busIdMap.get(ref);
        if (mapped != null) {
            return mapped;
        }
        return parseUuid(ref);
    }

    private UUID parseUuidOrRandom(String value) {
        UUID parsed = parseUuid(value);
        return parsed != null ? parsed : UUID.randomUUID();
    }

    private UUID parseUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String getText(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) {
            return fallback;
        }
        String text = value.asText();
        return text == null ? fallback : text;
    }

    private double getDouble(JsonNode node, String field, double fallback) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) {
            return fallback;
        }
        return value.asDouble(fallback);
    }

    private boolean getBoolean(JsonNode node, String field, boolean fallback) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) {
            return fallback;
        }
        return value.asBoolean(fallback);
    }

    private Integer parseIntegerLike(JsonNode node, String field, Integer fallback) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) {
            return fallback;
        }
        if (value.isInt() || value.isLong()) {
            return value.asInt();
        }
        String text = value.asText();
        if (text == null || text.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private Double getTupleValue(JsonNode node, String tupleName, int index) {
        JsonNode tuple = node == null ? null : node.get(tupleName);
        if (!(tuple instanceof ArrayNode tupleArray) || tupleArray.size() <= index) {
            return null;
        }
        JsonNode value = tupleArray.get(index);
        return value == null || value.isNull() ? null : value.asDouble();
    }

    private BusType parseBusType(String value) {
        try {
            return BusType.valueOf(value);
        } catch (Exception ex) {
            return BusType.PQ;
        }
    }

    private LoadType parseLoadType(String value) {
        try {
            return LoadType.valueOf(value);
        } catch (Exception ex) {
            return LoadType.PQ;
        }
    }

    private ShuntType parseShuntType(String value) {
        try {
            return ShuntType.valueOf(value);
        } catch (Exception ex) {
            return ShuntType.CAPACITOR;
        }
    }

    private TapSide mapTapSide(String value) {
        if ("HV".equalsIgnoreCase(value) || "FROM".equalsIgnoreCase(value)) {
            return TapSide.FROM;
        }
        if ("LV".equalsIgnoreCase(value) || "TO".equalsIgnoreCase(value)) {
            return TapSide.TO;
        }
        return TapSide.FROM;
    }

    private String toFrontendTapSide(TapSide tapSide) {
        if (tapSide == TapSide.TO) {
            return "LV";
        }
        return "HV";
    }

    private WindingType mapWindingType(String value) {
        if ("THREE_WINDING".equalsIgnoreCase(value)) {
            return WindingType.YNyn;
        }
        if ("TWO_WINDING".equalsIgnoreCase(value)) {
            return WindingType.Yyn;
        }
        try {
            return WindingType.valueOf(value);
        } catch (Exception ex) {
            return WindingType.Yyn;
        }
    }

    private String toFrontendWindingType(WindingType windingType) {
        if (windingType == WindingType.YNyn) {
            return "THREE_WINDING";
        }
        return "TWO_WINDING";
    }

    private double nullableDouble(Double value) {
        return value == null ? 0.0 : value;
    }
}
