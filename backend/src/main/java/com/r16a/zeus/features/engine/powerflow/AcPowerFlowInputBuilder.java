package com.r16a.zeus.features.engine.powerflow;

import com.r16a.zeus.features.grid.model.type.BusType;
import com.r16a.zeus.features.grid.model.type.ShuntType;
import com.r16a.zeus.features.simulation.exception.PowerFlowCalculationException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class AcPowerFlowInputBuilder {

    public AcPowerFlowInput build(JsonNode dataset) {
        double baseMva = readDouble(dataset.path("grid"), "baseMva", 100.0);
        ArrayNode busesNode = asArray(dataset.get("buses"));
        ArrayNode linesNode = asArray(dataset.get("lines"));
        ArrayNode transformersNode = asArray(dataset.get("transformers"));
        ArrayNode loadsNode = asArray(dataset.get("loads"));
        ArrayNode generatorsNode = asArray(dataset.get("generators"));
        ArrayNode shuntsNode = asArray(dataset.get("shuntCompensators"));

        List<JsonNode> activeBusNodes = new ArrayList<>();
        Map<UUID, Integer> busIndexById = new HashMap<>();
        for (JsonNode busNode : busesNode) {
            if (!readBoolean(busNode, "inService", true)) {
                continue;
            }
            UUID busId = readUuid(busNode, "id");
            if (busId == null) {
                continue;
            }
            int index = activeBusNodes.size();
            activeBusNodes.add(busNode);
            busIndexById.put(busId, index);
        }

        if (activeBusNodes.isEmpty()) {
            throw new PowerFlowCalculationException("Power flow requires at least one in-service bus.");
        }

        Map<UUID, Double> loadPByBus = new HashMap<>();
        Map<UUID, Double> loadQByBus = new HashMap<>();
        for (JsonNode loadNode : loadsNode) {
            if (!readBoolean(loadNode, "inService", true)) {
                continue;
            }
            UUID busId = readUuid(loadNode, "busId");
            if (busId == null) {
                continue;
            }
            double scaling = readDouble(loadNode, "scalingFactor", 1.0);
            loadPByBus.merge(busId, readDouble(loadNode, "activePowerMw", 0.0) * scaling, Double::sum);
            loadQByBus.merge(busId, readDouble(loadNode, "reactivePowerMvar", 0.0) * scaling, Double::sum);
        }

        Map<UUID, Double> genPByBus = new HashMap<>();
        Map<UUID, Double> genQByBus = new HashMap<>();
        Map<UUID, Double> genVoltageByBus = new HashMap<>();
        int inServiceGeneratorCount = 0;
        for (JsonNode genNode : generatorsNode) {
            if (!readBoolean(genNode, "inService", true)) {
                continue;
            }
            UUID busId = readUuid(genNode, "busId");
            if (busId == null) {
                continue;
            }
            inServiceGeneratorCount += 1;
            genPByBus.merge(busId, readDouble(genNode, "activePowerMw", 0.0), Double::sum);
            genQByBus.merge(busId, readDouble(genNode, "reactivePowerMvar", 0.0), Double::sum);
            genVoltageByBus.putIfAbsent(busId, readDouble(genNode, "voltagePu", 1.0));
        }
        if (inServiceGeneratorCount == 0) {
            throw new PowerFlowCalculationException("Power flow requires at least one in-service generator.");
        }

        Map<UUID, Double> shuntQByBus = new HashMap<>();
        for (JsonNode shuntNode : shuntsNode) {
            if (!readBoolean(shuntNode, "inService", true)) {
                continue;
            }
            UUID busId = readUuid(shuntNode, "busId");
            if (busId == null) {
                continue;
            }
            String shuntTypeRaw = readText(shuntNode, "shuntType", ShuntType.CAPACITOR.name());
            ShuntType shuntType;
            try {
                shuntType = ShuntType.valueOf(shuntTypeRaw);
            } catch (Exception ignored) {
                shuntType = ShuntType.CAPACITOR;
            }
            double qMvar = readDouble(shuntNode, "qMvar", 0.0);
            double signedQ = shuntType == ShuntType.REACTOR ? -Math.abs(qMvar) : Math.abs(qMvar);
            shuntQByBus.merge(busId, signedQ, Double::sum);
        }

        List<AcPowerFlowInput.BusNode> buses = new ArrayList<>();
        int slackBusCount = 0;
        for (JsonNode busNode : activeBusNodes) {
            UUID busId = readUuid(busNode, "id");
            if (busId == null) {
                continue;
            }
            String busName = readText(busNode, "name", "Bus");
            AcPowerFlowInput.BusCategory category = toCategory(readText(busNode, "busType", BusType.PQ.name()));
            if (category == AcPowerFlowInput.BusCategory.SLACK) {
                slackBusCount += 1;
            }
            double vmInit = readDouble(busNode, "voltageMagnitudePu", 1.0);
            double vaInit = readDouble(busNode, "voltageAngleDeg", 0.0);
            double minV = readDouble(busNode, "minVoltagePu", 0.95);
            double maxV = readDouble(busNode, "maxVoltagePu", 1.05);
            double vSet = genVoltageByBus.getOrDefault(busId, vmInit);

            double pSpecMw = genPByBus.getOrDefault(busId, 0.0) - loadPByBus.getOrDefault(busId, 0.0);
            double qSpecMvar = genQByBus.getOrDefault(busId, 0.0) - loadQByBus.getOrDefault(busId, 0.0)
                    + shuntQByBus.getOrDefault(busId, 0.0);

            buses.add(new AcPowerFlowInput.BusNode(
                    busId,
                    busName,
                    category,
                    vmInit,
                    vaInit,
                    vSet,
                    pSpecMw / baseMva,
                    qSpecMvar / baseMva,
                    minV,
                    maxV
            ));
        }

        if (slackBusCount != 1) {
            throw new PowerFlowCalculationException("Power flow requires exactly one slack bus.");
        }

        List<AcPowerFlowInput.BranchEdge> branches = new ArrayList<>();
        for (JsonNode lineNode : linesNode) {
            if (!readBoolean(lineNode, "inService", true)
                    || !readBoolean(lineNode, "fromSwitchClosed", true)
                    || !readBoolean(lineNode, "toSwitchClosed", true)) {
                continue;
            }
            UUID fromBus = readUuid(lineNode, "fromBusId");
            UUID toBus = readUuid(lineNode, "toBusId");
            if (!busIndexById.containsKey(fromBus) || !busIndexById.containsKey(toBus)) {
                continue;
            }
            branches.add(new AcPowerFlowInput.BranchEdge(
                    readUuidOrRandom(lineNode, "id"),
                    "LINE",
                    readText(lineNode, "name", "Line"),
                    busIndexById.get(fromBus),
                    busIndexById.get(toBus),
                    readDouble(lineNode, "resistancePu", 0.0),
                    readDouble(lineNode, "reactancePu", 0.0),
                    readDouble(lineNode, "susceptancePu", 0.0),
                    1.0,
                    0.0,
                    readDouble(lineNode, "ratingMva", 0.0),
                    readDouble(lineNode, "maxLoadingPercent", 100.0)
            ));
        }

        for (JsonNode trNode : transformersNode) {
            if (!readBoolean(trNode, "inService", true)
                    || !readBoolean(trNode, "fromSwitchClosed", true)
                    || !readBoolean(trNode, "toSwitchClosed", true)) {
                continue;
            }
            UUID fromBus = readUuid(trNode, "fromBusId");
            UUID toBus = readUuid(trNode, "toBusId");
            if (!busIndexById.containsKey(fromBus) || !busIndexById.containsKey(toBus)) {
                continue;
            }
            branches.add(new AcPowerFlowInput.BranchEdge(
                    readUuidOrRandom(trNode, "id"),
                    "TRANSFORMER",
                    readText(trNode, "name", "Transformer"),
                    busIndexById.get(fromBus),
                    busIndexById.get(toBus),
                    readDouble(trNode, "resistancePu", 0.0),
                    readDouble(trNode, "reactancePu", 0.0),
                    0.0,
                    Math.max(readDouble(trNode, "tapRatio", 1.0), 1e-4),
                    readDouble(trNode, "phaseShiftDeg", 0.0),
                    readDouble(trNode, "ratingMva", 0.0),
                    readDouble(trNode, "maxLoadingPercent", 100.0)
            ));
        }

        if (branches.isEmpty()) {
            throw new PowerFlowCalculationException("Power flow requires at least one in-service branch.");
        }

        return new AcPowerFlowInput(baseMva, buses, branches, slackBusCount);
    }

    private ArrayNode asArray(JsonNode node) {
        return node instanceof ArrayNode array ? array : JsonNodeFactory.instance.arrayNode();
    }

    private AcPowerFlowInput.BusCategory toCategory(String busTypeRaw) {
        try {
            BusType busType = BusType.valueOf(busTypeRaw);
            return switch (busType) {
                case SLACK -> AcPowerFlowInput.BusCategory.SLACK;
                case PV -> AcPowerFlowInput.BusCategory.PV;
                case PQ -> AcPowerFlowInput.BusCategory.PQ;
            };
        } catch (Exception ignored) {
            return AcPowerFlowInput.BusCategory.PQ;
        }
    }

    private UUID readUuid(JsonNode node, String field) {
        String raw = readText(node, field, null);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private UUID readUuidOrRandom(JsonNode node, String field) {
        UUID parsed = readUuid(node, field);
        return parsed == null ? UUID.randomUUID() : parsed;
    }

    private String readText(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) {
            return fallback;
        }
        return value.asText(fallback);
    }

    private double readDouble(JsonNode node, String field, double fallback) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) {
            return fallback;
        }
        return value.asDouble(fallback);
    }

    private boolean readBoolean(JsonNode node, String field, boolean fallback) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) {
            return fallback;
        }
        return value.asBoolean(fallback);
    }
}
