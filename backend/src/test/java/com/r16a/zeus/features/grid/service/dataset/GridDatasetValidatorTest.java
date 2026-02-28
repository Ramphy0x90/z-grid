package com.r16a.zeus.features.grid.service.dataset;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.r16a.zeus.features.grid.exception.GridDatasetValidationException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class GridDatasetValidatorTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GridDatasetValidator validator = new GridDatasetValidator();

    @Test
    void validateRejectsMissingBusReference() {
        ObjectNode dataset = objectMapper.createObjectNode();
        ArrayNode buses = objectMapper.createArrayNode();
        buses.add(objectMapper.createObjectNode().put("id", "bus-1"));
        dataset.set("buses", buses);

        ArrayNode lines = objectMapper.createArrayNode();
        lines.add(objectMapper.createObjectNode()
                .put("id", "line-1")
                .put("fromBusId", "bus-1")
                .put("toBusId", "missing-bus"));
        dataset.set("lines", lines);

        assertThrows(GridDatasetValidationException.class, () -> validator.validate(dataset));
    }

    @Test
    void validateAcceptsValidDatasetReferences() {
        ObjectNode dataset = objectMapper.createObjectNode();
        ArrayNode buses = objectMapper.createArrayNode();
        buses.add(objectMapper.createObjectNode().put("id", "bus-1").put("busType", "PQ"));
        buses.add(objectMapper.createObjectNode().put("id", "bus-2").put("busType", "PV"));
        dataset.set("buses", buses);

        ArrayNode lines = objectMapper.createArrayNode();
        lines.add(objectMapper.createObjectNode()
                .put("id", "line-1")
                .put("fromBusId", "bus-1")
                .put("toBusId", "bus-2"));
        dataset.set("lines", lines);

        ArrayNode loads = objectMapper.createArrayNode();
        loads.add(objectMapper.createObjectNode()
                .put("id", "load-1")
                .put("busId", "bus-1")
                .put("loadType", "PQ"));
        dataset.set("loads", loads);

        assertDoesNotThrow(() -> validator.validate(dataset));
    }
}
