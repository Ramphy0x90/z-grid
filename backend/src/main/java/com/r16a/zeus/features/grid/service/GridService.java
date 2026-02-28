package com.r16a.zeus.features.grid.service;

import com.r16a.zeus.features.grid.dto.CreateGridRequest;
import com.r16a.zeus.features.grid.dto.GridResponse;
import com.r16a.zeus.features.grid.dto.UpdateGridRequest;
import com.r16a.zeus.features.grid.exception.GridNotFoundException;
import com.r16a.zeus.features.grid.model.Grid;
import com.r16a.zeus.features.grid.repository.GridRepository;
import com.r16a.zeus.project.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GridService {
    private static final double DEFAULT_BASE_MVA = 100.0;
    private static final double DEFAULT_FREQUENCY_HZ = 50.0;

    private final GridRepository gridRepository;
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
                .map((grid) -> GridResponse.from(grid, getBusCount(parseDatasetJson(grid.getDatasetJson()))))
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
        ObjectNode dataset = buildDefaultDataset(created);
        created.setDatasetJson(writeDatasetJson(dataset));
        created = gridRepository.save(created);
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

        ObjectNode dataset = normalizeDataset(existing, parseDatasetJson(existing.getDatasetJson()));
        existing.setDatasetJson(writeDatasetJson(dataset));
        Grid updated = gridRepository.save(existing);
        return GridResponse.from(updated, getBusCount(dataset));
    }

    @Transactional
    public void deleteGrid(UUID gridId) {
        getGridByIdOrThrow(gridId);
        gridRepository.deleteById(gridId);
    }

    public JsonNode getGridDataset(UUID gridId) {
        Grid grid = getGridByIdOrThrow(gridId);
        return normalizeDataset(grid, parseDatasetJson(grid.getDatasetJson()));
    }

    @Transactional
    public JsonNode replaceGridDataset(UUID gridId, JsonNode dataset) {
        Grid grid = getGridByIdOrThrow(gridId);
        ObjectNode normalized = normalizeDataset(grid, dataset);
        grid.setDatasetJson(writeDatasetJson(normalized));
        gridRepository.save(grid);
        return normalized;
    }

    @Transactional
    public GridResponse duplicateGrid(UUID sourceGridId) {
        Grid source = getGridByIdOrThrow(sourceGridId);
        JsonNode sourceDataset = normalizeDataset(source, parseDatasetJson(source.getDatasetJson()));

        Grid duplicate = Grid.builder()
                .projectId(source.getProjectId())
                .name(resolveUniqueGridName(source.getProjectId(), source.getName() + " Copy"))
                .description(source.getDescription())
                .baseMva(source.getBaseMva())
                .frequencyHz(source.getFrequencyHz())
                .datasetJson("{}")
                .build();

        Grid created = gridRepository.save(duplicate);
        ObjectNode clonedDataset = normalizeDataset(created, sourceDataset.deepCopy());
        created.setDatasetJson(writeDatasetJson(clonedDataset));
        created = gridRepository.save(created);

        return GridResponse.from(created, getBusCount(clonedDataset));
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

    private ObjectNode normalizeDataset(Grid grid, JsonNode rawDataset) {
        ObjectNode root = rawDataset != null && rawDataset.isObject()
                ? (ObjectNode) rawDataset.deepCopy()
                : objectMapper.createObjectNode();

        root.set("grid", buildGridNode(grid));
        ensureArray(root, "buses");
        ensureArray(root, "lines");
        ensureArray(root, "transformers");
        ensureArray(root, "loads");
        ensureArray(root, "generators");
        ensureArray(root, "shuntCompensators");
        ensureArray(root, "busLayout");
        ensureArray(root, "edgeLayout");
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

    private void ensureArray(ObjectNode root, String fieldName) {
        JsonNode node = root.get(fieldName);
        if (node != null && node.isArray()) {
            return;
        }
        root.set(fieldName, objectMapper.createArrayNode());
    }

    private int getBusCount(JsonNode dataset) {
        JsonNode buses = dataset.get("buses");
        if (buses instanceof ArrayNode busesArray) {
            return busesArray.size();
        }
        return 0;
    }

    private JsonNode parseDatasetJson(String datasetJson) {
        if (datasetJson == null || datasetJson.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(datasetJson);
        } catch (Exception ex) {
            return objectMapper.createObjectNode();
        }
    }

    private String writeDatasetJson(JsonNode dataset) {
        try {
            return objectMapper.writeValueAsString(dataset);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to serialize grid dataset", ex);
        }
    }
}
