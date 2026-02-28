package com.r16a.zeus.features.grid.service.dataset;

import com.r16a.zeus.features.grid.exception.GridDatasetValidationException;
import com.r16a.zeus.features.grid.model.type.BusType;
import com.r16a.zeus.features.grid.model.type.LoadType;
import com.r16a.zeus.features.grid.model.type.ShuntType;
import com.r16a.zeus.features.grid.model.type.WindingType;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;

@Component
public class GridDatasetValidator {
    public void validate(JsonNode dataset) {
        if (dataset != null && !dataset.isObject()) {
            throw new GridDatasetValidationException("Dataset payload must be a JSON object.");
        }

        JsonNode safeDataset = dataset == null ? NullNodeHolder.INSTANCE : dataset;
        List<String> errors = new ArrayList<>();

        Set<String> busIds = collectIds(safeDataset.get("buses"), "buses", errors);
        Set<String> edgeIds = collectIds(safeDataset.get("lines"), "lines", errors);
        edgeIds.addAll(collectIds(safeDataset.get("transformers"), "transformers", errors));

        validateBusReferences(safeDataset.get("lines"), "lines", "fromBusId", busIds, errors);
        validateBusReferences(safeDataset.get("lines"), "lines", "toBusId", busIds, errors);
        validateBusReferences(safeDataset.get("transformers"), "transformers", "fromBusId", busIds, errors);
        validateBusReferences(safeDataset.get("transformers"), "transformers", "toBusId", busIds, errors);
        validateBusReferences(safeDataset.get("loads"), "loads", "busId", busIds, errors);
        validateBusReferences(safeDataset.get("generators"), "generators", "busId", busIds, errors);
        validateBusReferences(safeDataset.get("shuntCompensators"), "shuntCompensators", "busId", busIds, errors);
        validateBusReferences(safeDataset.get("busLayout"), "busLayout", "busId", busIds, errors);
        validateEdgeReferences(safeDataset.get("edgeLayout"), edgeIds, errors);

        validateEnumValues(safeDataset.get("buses"), "buses", "busType", enumNames(BusType.class), errors);
        validateEnumValues(safeDataset.get("loads"), "loads", "loadType", enumNames(LoadType.class), errors);
        validateEnumValues(safeDataset.get("shuntCompensators"), "shuntCompensators", "shuntType", enumNames(ShuntType.class), errors);
        validateEnumValues(safeDataset.get("transformers"), "transformers", "tapSide", Set.of("HV", "LV", "FROM", "TO"), errors);

        Set<String> windingValues = enumNames(WindingType.class);
        windingValues.add("TWO_WINDING");
        windingValues.add("THREE_WINDING");
        validateEnumValues(safeDataset.get("transformers"), "transformers", "windingType", windingValues, errors);

        if (!errors.isEmpty()) {
            throw new GridDatasetValidationException("Invalid grid dataset: " + String.join("; ", errors));
        }
    }

    private Set<String> collectIds(JsonNode node, String section, List<String> errors) {
        Set<String> ids = new HashSet<>();
        if (!(node instanceof ArrayNode array)) {
            return ids;
        }
        for (int i = 0; i < array.size(); i++) {
            JsonNode item = array.get(i);
            String id = getText(item, "id");
            if (id == null || id.isBlank()) {
                errors.add(section + "[" + i + "].id is required");
                continue;
            }
            if (!ids.add(id)) {
                errors.add(section + "[" + i + "].id is duplicated: " + id);
            }
        }
        return ids;
    }

    private void validateBusReferences(
            JsonNode node,
            String section,
            String field,
            Set<String> busIds,
            List<String> errors
    ) {
        if (!(node instanceof ArrayNode array)) {
            return;
        }
        for (int i = 0; i < array.size(); i++) {
            String ref = getText(array.get(i), field);
            if (ref == null || ref.isBlank()) {
                errors.add(section + "[" + i + "]." + field + " is required");
                continue;
            }
            if (!busIds.contains(ref)) {
                errors.add(section + "[" + i + "]." + field + " references missing bus id: " + ref);
            }
        }
    }

    private void validateEdgeReferences(JsonNode node, Set<String> edgeIds, List<String> errors) {
        if (!(node instanceof ArrayNode array)) {
            return;
        }
        for (int i = 0; i < array.size(); i++) {
            String ref = getText(array.get(i), "edgeId");
            if (ref == null || ref.isBlank()) {
                errors.add("edgeLayout[" + i + "].edgeId is required");
                continue;
            }
            if (!edgeIds.contains(ref)) {
                errors.add("edgeLayout[" + i + "].edgeId references missing edge id: " + ref);
            }
        }
    }

    private void validateEnumValues(
            JsonNode node,
            String section,
            String field,
            Set<String> allowedValues,
            List<String> errors
    ) {
        if (!(node instanceof ArrayNode array)) {
            return;
        }
        for (int i = 0; i < array.size(); i++) {
            String value = getText(array.get(i), field);
            if (value == null || value.isBlank()) {
                continue;
            }
            if (!allowedValues.contains(value)) {
                errors.add(section + "[" + i + "]." + field + " has invalid value: " + value);
            }
        }
    }

    private Set<String> enumNames(Class<? extends Enum<?>> enumClass) {
        Set<String> names = new HashSet<>();
        for (Enum<?> enumValue : enumClass.getEnumConstants()) {
            names.add(enumValue.name());
        }
        return names;
    }

    private String getText(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        return value.asText();
    }

    private static final class NullNodeHolder {
        private static final JsonNode INSTANCE = new tools.jackson.databind.ObjectMapper().createObjectNode();
    }
}
