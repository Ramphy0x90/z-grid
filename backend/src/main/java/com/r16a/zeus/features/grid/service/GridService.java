package com.r16a.zeus.features.grid.service;

import com.r16a.zeus.features.grid.dto.CreateGridRequest;
import com.r16a.zeus.features.grid.dto.GridResponse;
import com.r16a.zeus.features.grid.dto.UpdateGridRequest;
import com.r16a.zeus.features.grid.exception.GridNotFoundException;
import com.r16a.zeus.features.grid.model.*;
import com.r16a.zeus.features.grid.repository.*;
import com.r16a.zeus.features.grid.service.dataset.*;
import com.r16a.zeus.project.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GridService {
    private static final String DEFAULT_GRID_NAME = "New Grid";

    private final GridRepository gridRepository;
    private final BusRepository busRepository;
    private final LineRepository lineRepository;
    private final TransformerRepository transformerRepository;
    private final LoadRepository loadRepository;
    private final GeneratorRepository generatorRepository;
    private final ShuntCompensatorRepository shuntCompensatorRepository;
    private final BusLayoutRepository busLayoutRepository;
    private final EdgeLayoutRepository edgeLayoutRepository;
    private final ProjectService projectService;
    private final GridDatasetMapper gridDatasetMapper;
    private final GridDatasetValidator gridDatasetValidator;
    private final GridDatasetPersistenceService gridDatasetPersistenceService;

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
                .name(resolveUniqueGridName(request.projectId(), request.name(), null))
                .description(request.description() == null ? "" : request.description())
                .baseMva(GridDatasetMapper.DEFAULT_BASE_MVA)
                .frequencyHz(GridDatasetMapper.DEFAULT_FREQUENCY_HZ)
                .build();

        Grid created = gridRepository.save(grid);
        return GridResponse.from(created, 0);
    }

    @Transactional
    public GridResponse updateGrid(UUID gridId, UpdateGridRequest request) {
        Grid existing = getGridByIdOrThrow(gridId);
        String requestedName = request.name() == null ? "" : request.name().trim();
        if (!requestedName.isBlank() && !requestedName.equals(existing.getName())) {
            existing.setName(resolveUniqueGridName(existing.getProjectId(), requestedName, existing.getId()));
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
        return gridDatasetMapper.toJson(grid, loadSnapshot(grid.getId()));
    }

    @Transactional
    public JsonNode replaceGridDataset(UUID gridId, JsonNode dataset) {
        Grid grid = getGridByIdOrThrow(gridId);
        gridDatasetValidator.validate(dataset);
        GridDatasetImportModel importModel = gridDatasetMapper.fromJson(gridId, grid, dataset);

        updateGridMetadataFromDataset(grid, importModel);
        gridRepository.save(grid);

        gridDatasetPersistenceService.replaceGridData(gridId, importModel);

        Grid refreshed = getGridByIdOrThrow(gridId);
        return gridDatasetMapper.toJson(refreshed, loadSnapshot(refreshed.getId()));
    }

    @Transactional
    public GridResponse duplicateGrid(UUID sourceGridId) {
        Grid source = getGridByIdOrThrow(sourceGridId);
        JsonNode sourceDataset = gridDatasetMapper.toJson(source, loadSnapshot(source.getId()));

        Grid duplicate = Grid.builder()
                .projectId(source.getProjectId())
                .name(resolveUniqueGridName(source.getProjectId(), source.getName() + " Copy", null))
                .description(source.getDescription())
                .baseMva(source.getBaseMva())
                .frequencyHz(source.getFrequencyHz())
                .build();

        Grid created = gridRepository.save(duplicate);
        replaceGridDataset(created.getId(), sourceDataset.deepCopy());
        return GridResponse.from(created, (int) busRepository.countByGridId(created.getId()));
    }

    private void updateGridMetadataFromDataset(Grid grid, GridDatasetImportModel importModel) {
        grid.setBaseMva(importModel.baseMva());
        grid.setFrequencyHz(importModel.frequencyHz());

        String incomingName = importModel.name() == null ? "" : importModel.name().trim();
        if (!incomingName.isBlank() && !incomingName.equals(grid.getName())) {
            grid.setName(resolveUniqueGridName(grid.getProjectId(), incomingName, grid.getId()));
        }
        grid.setDescription(importModel.description() == null ? "" : importModel.description());
    }

    private String resolveUniqueGridName(UUID projectId, String baseName, UUID excludeGridId) {
        String trimmedBase = baseName == null ? "" : baseName.trim();
        String normalizedBase = trimmedBase.isEmpty() ? DEFAULT_GRID_NAME : trimmedBase;
        if (!existsByProjectAndName(projectId, normalizedBase, excludeGridId)) {
            return normalizedBase;
        }
        int suffix = 2;
        String candidate = normalizedBase + " " + suffix;
        while (existsByProjectAndName(projectId, candidate, excludeGridId)) {
            suffix += 1;
            candidate = normalizedBase + " " + suffix;
        }
        return candidate;
    }

    private boolean existsByProjectAndName(UUID projectId, String name, UUID excludeGridId) {
        if (excludeGridId == null) {
            return gridRepository.existsByProjectIdAndName(projectId, name);
        }
        return gridRepository.existsByProjectIdAndNameAndIdNot(projectId, name, excludeGridId);
    }

    private GridDatasetSnapshot loadSnapshot(UUID gridId) {
        List<Bus> buses = busRepository.findByGridId(gridId);
        List<UUID> busIds = buses.stream().map(Bus::getId).toList();
        List<Load> loads = busIds.isEmpty() ? List.of() : loadRepository.findByBusIdIn(busIds);
        List<Generator> generators = busIds.isEmpty() ? List.of() : generatorRepository.findByBusIdIn(busIds);
        List<ShuntCompensator> shunts = busIds.isEmpty() ? List.of() : shuntCompensatorRepository.findByBusIdIn(busIds);
        return new GridDatasetSnapshot(
                buses,
                lineRepository.findByGridId(gridId),
                transformerRepository.findByGridId(gridId),
                loads,
                generators,
                shunts,
                busLayoutRepository.findByGridId(gridId),
                edgeLayoutRepository.findByGridId(gridId)
        );
    }
}
