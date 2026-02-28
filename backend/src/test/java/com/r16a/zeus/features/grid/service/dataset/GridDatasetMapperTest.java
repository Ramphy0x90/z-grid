package com.r16a.zeus.features.grid.service.dataset;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.r16a.zeus.features.grid.model.Grid;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class GridDatasetMapperTest {
    private final GridDatasetMapper mapper = new GridDatasetMapper(new ObjectMapper());
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void fromJsonAndToJsonPreserveCoreMetadataAndReferences() {
        UUID gridId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        Grid existing = Grid.builder()
                .id(gridId)
                .projectId(projectId)
                .name("Original")
                .description("Old desc")
                .baseMva(100.0)
                .frequencyHz(50.0)
                .build();

        ObjectNode dataset = objectMapper.createObjectNode();
        dataset.set("grid", objectMapper.createObjectNode()
                .put("name", "Imported Name")
                .put("description", "Imported Desc")
                .put("baseMva", 110.0)
                .put("frequencyHz", 60.0));

        ArrayNode buses = objectMapper.createArrayNode();
        buses.add(objectMapper.createObjectNode().put("id", "bus-1").put("name", "Bus A"));
        buses.add(objectMapper.createObjectNode().put("id", "bus-2").put("name", "Bus B"));
        dataset.set("buses", buses);

        ArrayNode lines = objectMapper.createArrayNode();
        lines.add(objectMapper.createObjectNode()
                .put("id", "line-1")
                .put("fromBusId", "bus-1")
                .put("toBusId", "bus-2")
                .put("name", "L1"));
        dataset.set("lines", lines);

        GridDatasetImportModel importModel = mapper.fromJson(gridId, existing, dataset);
        assertEquals("Imported Name", importModel.name());
        assertEquals(2, importModel.buses().size());
        assertEquals(1, importModel.lines().size());
        assertEquals(importModel.buses().get(0).getId(), importModel.lines().get(0).getFromBusId());

        Grid updated = Grid.builder()
                .id(gridId)
                .projectId(projectId)
                .name(importModel.name())
                .description(importModel.description())
                .baseMva(importModel.baseMva())
                .frequencyHz(importModel.frequencyHz())
                .build();
        JsonNode exported = mapper.toJson(updated, new GridDatasetSnapshot(
                importModel.buses(),
                importModel.lines(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        ));

        assertEquals("Imported Name", exported.get("grid").get("name").asText());
        assertEquals(2, exported.get("buses").size());
        assertEquals(1, exported.get("lines").size());
    }
}
