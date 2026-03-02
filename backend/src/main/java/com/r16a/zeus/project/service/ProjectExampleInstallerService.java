package com.r16a.zeus.project.service;

import com.r16a.zeus.features.grid.dto.CreateGridRequest;
import com.r16a.zeus.features.grid.dto.GridResponse;
import com.r16a.zeus.features.grid.service.GridService;
import com.r16a.zeus.project.Project;
import com.r16a.zeus.project.dto.InstallExampleProjectRequest;
import com.r16a.zeus.project.dto.ProjectResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@Service
@RequiredArgsConstructor
public class ProjectExampleInstallerService {
    private final ProjectService projectService;
    private final GridService gridService;
    private final ProjectExampleCatalogService projectExampleCatalogService;
    private final ObjectMapper objectMapper;

    @Transactional
    public ProjectResponse installExampleProject(InstallExampleProjectRequest request) {
        ProjectExampleCatalogService.ProjectExampleCatalogEntry entry =
                projectExampleCatalogService.getExampleByKeyOrThrow(request.exampleKey());

        Project createdProject = projectService.createProject(Project.builder()
                .name(resolveName(request.projectName(), entry.defaultProjectName()))
                .description("Static grid example for " + entry.cityLabel() + ".")
                .build());

        String gridName = resolveName(request.gridName(), entry.defaultGridName());
        GridResponse createdGrid = gridService.createGrid(new CreateGridRequest(
                createdProject.getId(),
                gridName,
                "Installed from static " + entry.cityLabel() + " dataset."
        ));

        JsonNode dataset = projectExampleCatalogService.loadDataset(entry);
        JsonNode datasetToInstall = applyGridNameOverride(dataset, request.gridName());
        gridService.replaceGridDataset(createdGrid.id(), datasetToInstall);

        return ProjectResponse.from(createdProject);
    }

    private JsonNode applyGridNameOverride(JsonNode dataset, String requestedGridName) {
        String normalizedGridName = normalize(requestedGridName);
        if (normalizedGridName.isEmpty()) {
            return dataset;
        }
        ObjectNode root = dataset != null && dataset.isObject()
                ? (ObjectNode) dataset.deepCopy()
                : objectMapper.createObjectNode();
        ObjectNode grid = root.has("grid") && root.get("grid").isObject()
                ? (ObjectNode) root.get("grid")
                : root.putObject("grid");
        grid.put("name", normalizedGridName);
        return root;
    }

    private String resolveName(String requestedName, String fallbackName) {
        String normalizedName = normalize(requestedName);
        return normalizedName.isEmpty() ? fallbackName : normalizedName;
    }

    private String normalize(String rawValue) {
        return rawValue == null ? "" : rawValue.trim();
    }
}
