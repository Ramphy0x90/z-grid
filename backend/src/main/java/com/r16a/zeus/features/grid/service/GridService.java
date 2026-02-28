package com.r16a.zeus.features.grid.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import com.r16a.zeus.features.grid.dto.CreateGridRequest;
import com.r16a.zeus.features.grid.dto.GridResponse;
import com.r16a.zeus.features.grid.dto.UpdateGridRequest;
import com.r16a.zeus.features.grid.exception.GridNotFoundException;
import com.r16a.zeus.features.grid.model.*;
import com.r16a.zeus.features.grid.model.type.LoadType;
import com.r16a.zeus.features.grid.model.type.ShuntType;
import com.r16a.zeus.features.grid.model.type.TapSide;
import com.r16a.zeus.features.grid.model.type.WindingType;
import com.r16a.zeus.features.grid.repository.*;
import com.r16a.zeus.project.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GridService {
    private static final double DEFAULT_BASE_MVA = 100.0;
    private static final double DEFAULT_FREQUENCY_HZ = 50.0;

    private final GridRepository gridRepository;
    private final BusRepository busRepository;
    private final LineRepository lineRepository;
    private final TransformerRepository transformerRepository;
    private final LoadRepository loadRepository;
    private final GeneratorRepository generatorRepository;
    private final ShuntCompensatorRepository shuntCompensatorRepository;
    private final BusLayoutRepository busLayoutRepository;
    private final EdgeLayoutRepository edgeLayoutRepository;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final ProjectService projectService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public Grid getGridByIdOrThrow(UUID gridId) {
        return gridRepository.findById(gridId)
                .orElseThrow(() -> new GridNotFoundException("Grid not found: " + gridId));
    }

    public List<GridResponse> getGridsByProject(UUID projectId) {
        projectService.getProjectByIdOrThrow(projectId);
        return gridRepository.findByProjectId(projectId)
                .stream()
                .map((grid) -> GridResponse.from(grid, (int) busRepository.countByGridId(grid.getId())))
                .toList();
    }

    @Transactional
    public GridResponse createGrid(CreateGridRequest request) {
        projectService.getProjectByIdOrThrow(request.projectId());

        Grid grid = Grid.builder()
                .projectId(request.projectId())
                .name(resolveUniqueGridName(request.projectId(), request.name()))
                .description(request.description() == null ? "" : request.description())
                .baseMva(DEFAULT_BASE_MVA)
                .frequencyHz(DEFAULT_FREQUENCY_HZ)
                .datasetJson("{}")
                .build();

        Grid created = gridRepository.save(grid);
        return GridResponse.from(created, 0);
    }

    @Transactional
    public GridResponse updateGrid(UUID gridId, UpdateGridRequest request) {
        Grid existing = getGridByIdOrThrow(gridId);
        String requestedName = request.name() == null ? "" : request.name().trim();
        if (!requestedName.isBlank() && !requestedName.equals(existing.getName())) {
            existing.setName(resolveUniqueGridName(existing.getProjectId(), requestedName));
        }
        existing.setDescription(request.description() == null ? "" : request.description());
        Grid updated = gridRepository.save(existing);
        return GridResponse.from(updated, (int) busRepository.countByGridId(updated.getId()));
    }

    @Transactional
    public void deleteGrid(UUID gridId) {
        getGridByIdOrThrow(gridId);
        gridRepository.deleteById(gridId);
    }

    public JsonNode getGridDataset(UUID gridId) {
        Grid grid = getGridByIdOrThrow(gridId);
        return buildDatasetFromTables(grid);
    }

    @Transactional
    public JsonNode replaceGridDataset(UUID gridId, JsonNode dataset) {
        Grid grid = getGridByIdOrThrow(gridId);
        ObjectNode normalized = dataset != null && dataset.isObject()
                ? (ObjectNode) dataset.deepCopy()
                : objectMapper.createObjectNode();

        JsonNode gridNode = normalized.get("grid");
        if (gridNode != null && gridNode.isObject()) {
            grid.setBaseMva(getDouble(gridNode, "baseMva", grid.getBaseMva() == null ? DEFAULT_BASE_MVA : grid.getBaseMva()));
            grid.setFrequencyHz(getDouble(gridNode, "frequencyHz", grid.getFrequencyHz() == null ? DEFAULT_FREQUENCY_HZ : grid.getFrequencyHz()));
            String incomingName = getText(gridNode, "name", grid.getName());
            if (incomingName != null && !incomingName.isBlank()) {
                grid.setName(incomingName);
            }
            grid.setDescription(getText(gridNode, "description", grid.getDescription() == null ? "" : grid.getDescription()));
            gridRepository.save(grid);
        }

        edgeLayoutRepository.deleteByGridId(gridId);
        busLayoutRepository.deleteByGridId(gridId);
        lineRepository.deleteByGridId(gridId);
        transformerRepository.deleteByGridId(gridId);
        busRepository.deleteByGridId(gridId);

        Map<String, UUID> busIdMap = new HashMap<>();
        List<Bus> busesToSave = new ArrayList<>();
        JsonNode busesNode = normalized.get("buses");
        if (busesNode instanceof ArrayNode busesArray) {
            for (JsonNode busNode : busesArray) {
                String clientId = getText(busNode, "id", UUID.randomUUID().toString());
                UUID busId = parseUuidOrRandom(clientId);
                busIdMap.put(clientId, busId);
                busesToSave.add(Bus.builder()
                        .id(busId)
                        .gridId(gridId)
                        .name(getText(busNode, "name", "Bus"))
                        .nominalVoltageKv(getDouble(busNode, "nominalVoltageKv", 0.0))
                        .busType(parseBusType(getText(busNode, "busType", "PQ")))
                        .voltageMagnitudePu(getDouble(busNode, "voltageMagnitudePu", 1.0))
                        .voltageAngleDeg(getDouble(busNode, "voltageAngleDeg", 0.0))
                        .minVoltagePu(getDouble(busNode, "minVoltagePu", 0.95))
                        .maxVoltagePu(getDouble(busNode, "maxVoltagePu", 1.05))
                        .inService(getBoolean(busNode, "inService", true))
                        .area(parseIntegerLike(busNode, "area", 1))
                        .zone(parseIntegerLike(busNode, "zone", 1))
                        .build());
            }
        }
        if (!busesToSave.isEmpty()) {
            insertBuses(busesToSave);
        }

        Map<String, UUID> edgeIdMap = new HashMap<>();
        List<Line> linesToSave = new ArrayList<>();
        JsonNode linesNode = normalized.get("lines");
        if (linesNode instanceof ArrayNode linesArray) {
            for (JsonNode lineNode : linesArray) {
                UUID fromBusId = mapBusReference(lineNode, "fromBusId", busIdMap);
                UUID toBusId = mapBusReference(lineNode, "toBusId", busIdMap);
                if (fromBusId == null || toBusId == null) {
                    continue;
                }
                String clientEdgeId = getText(lineNode, "id", UUID.randomUUID().toString());
                UUID edgeId = parseUuidOrRandom(clientEdgeId);
                edgeIdMap.put(clientEdgeId, edgeId);
                linesToSave.add(Line.builder()
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
        }
        if (!linesToSave.isEmpty()) {
            insertLines(linesToSave);
        }

        List<Transformer> transformersToSave = new ArrayList<>();
        JsonNode transformersNode = normalized.get("transformers");
        if (transformersNode instanceof ArrayNode transformersArray) {
            for (JsonNode transformerNode : transformersArray) {
                UUID fromBusId = mapBusReference(transformerNode, "fromBusId", busIdMap);
                UUID toBusId = mapBusReference(transformerNode, "toBusId", busIdMap);
                if (fromBusId == null || toBusId == null) {
                    continue;
                }
                String clientEdgeId = getText(transformerNode, "id", UUID.randomUUID().toString());
                UUID edgeId = parseUuidOrRandom(clientEdgeId);
                edgeIdMap.put(clientEdgeId, edgeId);
                transformersToSave.add(Transformer.builder()
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
        }
        if (!transformersToSave.isEmpty()) {
            insertTransformers(transformersToSave);
        }

        List<Load> loadsToSave = new ArrayList<>();
        JsonNode loadsNode = normalized.get("loads");
        if (loadsNode instanceof ArrayNode loadsArray) {
            for (JsonNode loadNode : loadsArray) {
                UUID busId = mapBusReference(loadNode, "busId", busIdMap);
                if (busId == null) {
                    continue;
                }
                loadsToSave.add(Load.builder()
                        .id(parseUuidOrRandom(getText(loadNode, "id", UUID.randomUUID().toString())))
                        .busId(busId)
                        .name(getText(loadNode, "name", "Load"))
                        .activePowerMw(getDouble(loadNode, "activePowerMw", 0.0))
                        .reactivePowerMvar(getDouble(loadNode, "reactivePowerMvar", 0.0))
                        .inService(getBoolean(loadNode, "inService", true))
                        .loadType(parseLoadType(getText(loadNode, "loadType", "PQ")))
                        .scalingFactor(getDouble(loadNode, "scalingFactor", 1.0))
                        .build());
            }
        }
        if (!loadsToSave.isEmpty()) {
            insertLoads(loadsToSave);
        }

        List<Generator> generatorsToSave = new ArrayList<>();
        JsonNode generatorsNode = normalized.get("generators");
        if (generatorsNode instanceof ArrayNode generatorsArray) {
            for (JsonNode generatorNode : generatorsArray) {
                UUID busId = mapBusReference(generatorNode, "busId", busIdMap);
                if (busId == null) {
                    continue;
                }
                generatorsToSave.add(Generator.builder()
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
        }
        if (!generatorsToSave.isEmpty()) {
            insertGenerators(generatorsToSave);
        }

        List<ShuntCompensator> shuntsToSave = new ArrayList<>();
        JsonNode shuntsNode = normalized.get("shuntCompensators");
        if (shuntsNode instanceof ArrayNode shuntsArray) {
            for (JsonNode shuntNode : shuntsArray) {
                UUID busId = mapBusReference(shuntNode, "busId", busIdMap);
                if (busId == null) {
                    continue;
                }
                shuntsToSave.add(ShuntCompensator.builder()
                        .id(parseUuidOrRandom(getText(shuntNode, "id", UUID.randomUUID().toString())))
                        .busId(busId)
                        .name(getText(shuntNode, "name", "Shunt"))
                        .shuntType(parseShuntType(getText(shuntNode, "shuntType", "CAPACITOR")))
                        .qMvar(getDouble(shuntNode, "qMvar", 0.0))
                        .maxStep((int) getDouble(shuntNode, "maxStep", 1))
                        .currentStep((int) getDouble(shuntNode, "currentStep", 1))
                        .inService(getBoolean(shuntNode, "inService", true))
                        .build());
            }
        }
        if (!shuntsToSave.isEmpty()) {
            insertShunts(shuntsToSave);
        }

        List<BusLayout> busLayoutsToSave = new ArrayList<>();
        JsonNode busLayoutNode = normalized.get("busLayout");
        if (busLayoutNode instanceof ArrayNode busLayoutsArray) {
            for (JsonNode layoutNode : busLayoutsArray) {
                UUID busId = mapBusReference(layoutNode, "busId", busIdMap);
                if (busId == null) {
                    continue;
                }
                busLayoutsToSave.add(BusLayout.builder()
                        .busId(busId)
                        .gridId(gridId)
                        .lat(getDouble(layoutNode, "lat", 0.0))
                        .lng(getDouble(layoutNode, "lng", 0.0))
                        .schematicX(getDouble(layoutNode, "schematicX", 0.0))
                        .schematicY(getDouble(layoutNode, "schematicY", 0.0))
                        .build());
            }
        }
        if (!busLayoutsToSave.isEmpty()) {
            insertBusLayouts(busLayoutsToSave);
        }

        List<EdgeLayout> edgeLayoutsToSave = new ArrayList<>();
        JsonNode edgeLayoutNode = normalized.get("edgeLayout");
        if (edgeLayoutNode instanceof ArrayNode edgeLayoutsArray) {
            for (JsonNode layoutNode : edgeLayoutsArray) {
                String edgeIdText = getText(layoutNode, "edgeId", null);
                if (edgeIdText == null || edgeIdText.isBlank()) {
                    continue;
                }
                UUID edgeId = edgeIdMap.get(edgeIdText);
                if (edgeId == null) {
                    continue;
                }
                edgeLayoutsToSave.add(EdgeLayout.builder()
                        .edgeId(edgeId)
                        .gridId(gridId)
                        .mapMidpointX(getTupleValue(layoutNode, "mapMidpoint", 0))
                        .mapMidpointY(getTupleValue(layoutNode, "mapMidpoint", 1))
                        .schematicMidpointX(getTupleValue(layoutNode, "schematicMidpoint", 0))
                        .schematicMidpointY(getTupleValue(layoutNode, "schematicMidpoint", 1))
                        .build());
            }
        }
        if (!edgeLayoutsToSave.isEmpty()) {
            insertEdgeLayouts(edgeLayoutsToSave);
        }

        Grid refreshed = getGridByIdOrThrow(gridId);
        return buildDatasetFromTables(refreshed);
    }

    @Transactional
    public GridResponse duplicateGrid(UUID sourceGridId) {
        Grid source = getGridByIdOrThrow(sourceGridId);
        JsonNode sourceDataset = buildDatasetFromTables(source);

        Grid duplicate = Grid.builder()
                .projectId(source.getProjectId())
                .name(resolveUniqueGridName(source.getProjectId(), source.getName() + " Copy"))
                .description(source.getDescription())
                .baseMva(source.getBaseMva())
                .frequencyHz(source.getFrequencyHz())
                .datasetJson("{}")
                .build();

        Grid created = gridRepository.save(duplicate);
        replaceGridDataset(created.getId(), sourceDataset.deepCopy());
        return GridResponse.from(created, (int) busRepository.countByGridId(created.getId()));
    }

    private String resolveUniqueGridName(UUID projectId, String baseName) {
        String trimmedBase = baseName == null ? "" : baseName.trim();
        String normalizedBase = trimmedBase.isEmpty() ? "New Grid" : trimmedBase;
        if (!gridRepository.existsByProjectIdAndName(projectId, normalizedBase)) {
            return normalizedBase;
        }
        int suffix = 2;
        String candidate = normalizedBase + " " + suffix;
        while (gridRepository.existsByProjectIdAndName(projectId, candidate)) {
            suffix += 1;
            candidate = normalizedBase + " " + suffix;
        }
        return candidate;
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

    private JsonNode buildDatasetFromTables(Grid grid) {
        ObjectNode root = buildDefaultDataset(grid);

        List<Bus> buses = busRepository.findByGridId(grid.getId());
        ArrayNode busesArray = objectMapper.createArrayNode();
        for (Bus bus : buses) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("id", bus.getId().toString());
            node.put("gridId", bus.getGridId().toString());
            node.put("name", bus.getName());
            node.put("nominalVoltageKv", nullableDouble(bus.getNominalVoltageKv()));
            node.put("busType", bus.getBusType() == null ? "PQ" : bus.getBusType().name());
            node.put("voltageMagnitudePu", nullableDouble(bus.getVoltageMagnitudePu()));
            node.put("voltageAngleDeg", nullableDouble(bus.getVoltageAngleDeg()));
            node.put("minVoltagePu", nullableDouble(bus.getMinVoltagePu()));
            node.put("maxVoltagePu", nullableDouble(bus.getMaxVoltagePu()));
            node.put("inService", bus.isInService());
            node.put("area", bus.getArea() == null ? "1" : String.valueOf(bus.getArea()));
            node.put("zone", bus.getZone() == null ? "1" : String.valueOf(bus.getZone()));
            busesArray.add(node);
        }
        root.set("buses", busesArray);

        List<Line> lines = lineRepository.findByGridId(grid.getId());
        ArrayNode linesArray = objectMapper.createArrayNode();
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
            linesArray.add(node);
        }
        root.set("lines", linesArray);

        List<Transformer> transformers = transformerRepository.findByGridId(grid.getId());
        ArrayNode transformersArray = objectMapper.createArrayNode();
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
            transformersArray.add(node);
        }
        root.set("transformers", transformersArray);

        List<UUID> busIds = buses.stream().map(Bus::getId).toList();
        ArrayNode loadsArray = objectMapper.createArrayNode();
        ArrayNode generatorsArray = objectMapper.createArrayNode();
        ArrayNode shuntsArray = objectMapper.createArrayNode();
        if (!busIds.isEmpty()) {
            for (Load load : loadRepository.findByBusIdIn(busIds)) {
                ObjectNode node = objectMapper.createObjectNode();
                node.put("id", load.getId().toString());
                node.put("busId", load.getBusId().toString());
                node.put("name", load.getName());
                node.put("activePowerMw", nullableDouble(load.getActivePowerMw()));
                node.put("reactivePowerMvar", nullableDouble(load.getReactivePowerMvar()));
                node.put("inService", load.isInService());
                node.put("loadType", load.getLoadType() == null ? "PQ" : load.getLoadType().name());
                node.put("scalingFactor", nullableDouble(load.getScalingFactor()));
                loadsArray.add(node);
            }
            for (Generator generator : generatorRepository.findByBusIdIn(busIds)) {
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
                generatorsArray.add(node);
            }
            for (ShuntCompensator shunt : shuntCompensatorRepository.findByBusIdIn(busIds)) {
                ObjectNode node = objectMapper.createObjectNode();
                node.put("id", shunt.getId().toString());
                node.put("busId", shunt.getBusId().toString());
                node.put("name", shunt.getName());
                node.put("shuntType", shunt.getShuntType() == null ? "CAPACITOR" : shunt.getShuntType().name());
                node.put("qMvar", nullableDouble(shunt.getQMvar()));
                node.put("maxStep", shunt.getMaxStep() == null ? 1 : shunt.getMaxStep());
                node.put("currentStep", shunt.getCurrentStep() == null ? 1 : shunt.getCurrentStep());
                node.put("inService", shunt.isInService());
                shuntsArray.add(node);
            }
        }
        root.set("loads", loadsArray);
        root.set("generators", generatorsArray);
        root.set("shuntCompensators", shuntsArray);

        ArrayNode busLayoutArray = objectMapper.createArrayNode();
        for (BusLayout layout : busLayoutRepository.findByGridId(grid.getId())) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("busId", layout.getBusId().toString());
            node.put("lat", nullableDouble(layout.getLat()));
            node.put("lng", nullableDouble(layout.getLng()));
            node.put("schematicX", nullableDouble(layout.getSchematicX()));
            node.put("schematicY", nullableDouble(layout.getSchematicY()));
            busLayoutArray.add(node);
        }
        root.set("busLayout", busLayoutArray);

        ArrayNode edgeLayoutArray = objectMapper.createArrayNode();
        for (EdgeLayout layout : edgeLayoutRepository.findByGridId(grid.getId())) {
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
            edgeLayoutArray.add(node);
        }
        root.set("edgeLayout", edgeLayoutArray);

        return root;
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

    private com.r16a.zeus.features.grid.model.type.BusType parseBusType(String value) {
        try {
            return com.r16a.zeus.features.grid.model.type.BusType.valueOf(value);
        } catch (Exception ex) {
            return com.r16a.zeus.features.grid.model.type.BusType.PQ;
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

    private void insertBuses(List<Bus> buses) {
        String sql = """
                INSERT INTO buses (
                    id, grid_id, name, nominal_voltage_kv, bus_type, voltage_magnitude_pu, voltage_angle_deg,
                    min_voltage_pu, max_voltage_pu, in_service, area, zone
                ) VALUES (
                    :id, :grid_id, :name, :nominal_voltage_kv, :bus_type, :voltage_magnitude_pu, :voltage_angle_deg,
                    :min_voltage_pu, :max_voltage_pu, :in_service, :area, :zone
                )
                """;
        for (Bus bus : buses) {
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
            namedParameterJdbcTemplate.update(sql, params);
        }
    }

    private void insertLines(List<Line> lines) {
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
        for (Line line : lines) {
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
            namedParameterJdbcTemplate.update(sql, params);
        }
    }

    private void insertTransformers(List<Transformer> transformers) {
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
        for (Transformer transformer : transformers) {
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
            namedParameterJdbcTemplate.update(sql, params);
        }
    }

    private void insertLoads(List<Load> loads) {
        String sql = """
                INSERT INTO loads (
                    id, bus_id, name, active_power_mw, reactive_power_mvar, in_service, load_type, scaling_factor
                ) VALUES (
                    :id, :bus_id, :name, :active_power_mw, :reactive_power_mvar, :in_service, :load_type, :scaling_factor
                )
                """;
        for (Load load : loads) {
            Map<String, Object> params = new HashMap<>();
            params.put("id", load.getId());
            params.put("bus_id", load.getBusId());
            params.put("name", load.getName());
            params.put("active_power_mw", load.getActivePowerMw());
            params.put("reactive_power_mvar", load.getReactivePowerMvar());
            params.put("in_service", load.isInService());
            params.put("load_type", load.getLoadType() == null ? "PQ" : load.getLoadType().name());
            params.put("scaling_factor", load.getScalingFactor());
            namedParameterJdbcTemplate.update(sql, params);
        }
    }

    private void insertGenerators(List<Generator> generators) {
        String sql = """
                INSERT INTO generators (
                    id, bus_id, name, active_power_mw, reactive_power_mvar, voltage_pu, min_mw, max_mw,
                    in_service, min_mvar, max_mvar, xdpp_pu, cost_a, cost_b, cost_c, ramp_rate_mw_per_min
                ) VALUES (
                    :id, :bus_id, :name, :active_power_mw, :reactive_power_mvar, :voltage_pu, :min_mw, :max_mw,
                    :in_service, :min_mvar, :max_mvar, :xdpp_pu, :cost_a, :cost_b, :cost_c, :ramp_rate_mw_per_min
                )
                """;
        for (Generator generator : generators) {
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
            namedParameterJdbcTemplate.update(sql, params);
        }
    }

    private void insertShunts(List<ShuntCompensator> shunts) {
        String sql = """
                INSERT INTO shunt_compensators (
                    id, bus_id, name, shunt_type, q_mvar, max_step, current_step, in_service
                ) VALUES (
                    :id, :bus_id, :name, :shunt_type, :q_mvar, :max_step, :current_step, :in_service
                )
                """;
        for (ShuntCompensator shunt : shunts) {
            Map<String, Object> params = new HashMap<>();
            params.put("id", shunt.getId());
            params.put("bus_id", shunt.getBusId());
            params.put("name", shunt.getName());
            params.put("shunt_type", shunt.getShuntType() == null ? "CAPACITOR" : shunt.getShuntType().name());
            params.put("q_mvar", shunt.getQMvar());
            params.put("max_step", shunt.getMaxStep());
            params.put("current_step", shunt.getCurrentStep());
            params.put("in_service", shunt.isInService());
            namedParameterJdbcTemplate.update(sql, params);
        }
    }

    private void insertBusLayouts(List<BusLayout> layouts) {
        String sql = """
                INSERT INTO bus_layouts (
                    bus_id, grid_id, lat, lng, schematic_x, schematic_y
                ) VALUES (
                    :bus_id, :grid_id, :lat, :lng, :schematic_x, :schematic_y
                )
                """;
        for (BusLayout layout : layouts) {
            Map<String, Object> params = new HashMap<>();
            params.put("bus_id", layout.getBusId());
            params.put("grid_id", layout.getGridId());
            params.put("lat", layout.getLat());
            params.put("lng", layout.getLng());
            params.put("schematic_x", layout.getSchematicX());
            params.put("schematic_y", layout.getSchematicY());
            namedParameterJdbcTemplate.update(sql, params);
        }
    }

    private void insertEdgeLayouts(List<EdgeLayout> layouts) {
        String sql = """
                INSERT INTO edge_layouts (
                    edge_id, grid_id, map_midpoint_x, map_midpoint_y, schematic_midpoint_x, schematic_midpoint_y
                ) VALUES (
                    :edge_id, :grid_id, :map_midpoint_x, :map_midpoint_y, :schematic_midpoint_x, :schematic_midpoint_y
                )
                """;
        for (EdgeLayout layout : layouts) {
            Map<String, Object> params = new HashMap<>();
            params.put("edge_id", layout.getEdgeId());
            params.put("grid_id", layout.getGridId());
            params.put("map_midpoint_x", layout.getMapMidpointX());
            params.put("map_midpoint_y", layout.getMapMidpointY());
            params.put("schematic_midpoint_x", layout.getSchematicMidpointX());
            params.put("schematic_midpoint_y", layout.getSchematicMidpointY());
            namedParameterJdbcTemplate.update(sql, params);
        }
    }
}
