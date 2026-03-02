package com.r16a.zeus.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.r16a.zeus.features.grid.dto.GridResponse;
import com.r16a.zeus.features.grid.exception.GridDatasetValidationException;
import com.r16a.zeus.features.grid.service.GridService;
import com.r16a.zeus.project.dto.InstallExampleProjectRequest;
import com.r16a.zeus.project.dto.ProjectResponse;
import com.r16a.zeus.project.exception.ProjectExampleNotFoundException;
import com.r16a.zeus.project.service.ProjectExampleCatalogService;
import com.r16a.zeus.project.service.ProjectExampleInstallerService;
import com.r16a.zeus.project.service.ProjectService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@ExtendWith(MockitoExtension.class)
class ProjectExampleInstallerServiceTest {
    @Mock
    private ProjectService projectService;
    @Mock
    private GridService gridService;
    @Mock
    private ProjectExampleCatalogService projectExampleCatalogService;
    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private ProjectExampleInstallerService installerService;

    @Test
    void installExampleProjectCreatesProjectGridAndDataset() {
        UUID projectId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID gridId = UUID.randomUUID();
        InstallExampleProjectRequest request = new InstallExampleProjectRequest("zurich", null, null);
        ProjectExampleCatalogService.ProjectExampleCatalogEntry entry =
                new ProjectExampleCatalogService.ProjectExampleCatalogEntry(
                        "zurich",
                        "Zurich",
                        "project-examples/zurich.json",
                        "Zurich Example Project",
                        "Zurich Metropolitan Grid"
                );
        ObjectNode dataset = new ObjectMapper().createObjectNode();

        when(projectExampleCatalogService.getExampleByKeyOrThrow("zurich")).thenReturn(entry);
        when(projectService.createProject(any(Project.class)))
                .thenReturn(Project.builder().id(projectId).teamId(teamId).name("Zurich Example Project").description("").build());
        when(projectExampleCatalogService.loadDataset(entry)).thenReturn(dataset);
        when(gridService.createGrid(any())).thenReturn(new GridResponse(gridId, projectId, "Zurich Metropolitan Grid", "", 0));

        ProjectResponse result = installerService.installExampleProject(request);

        assertEquals(projectId, result.id());
        verify(gridService).replaceGridDataset(eq(gridId), any());
    }

    @Test
    void installExampleProjectRejectsUnknownKey() {
        InstallExampleProjectRequest request = new InstallExampleProjectRequest("bad-key", null, null);
        when(projectExampleCatalogService.getExampleByKeyOrThrow("bad-key"))
                .thenThrow(new ProjectExampleNotFoundException("bad key"));

        assertThrows(ProjectExampleNotFoundException.class, () -> installerService.installExampleProject(request));
    }

    @Test
    void installExampleProjectPropagatesDatasetValidationFailure() {
        UUID projectId = UUID.randomUUID();
        UUID gridId = UUID.randomUUID();
        InstallExampleProjectRequest request = new InstallExampleProjectRequest("tokyo", null, null);
        ProjectExampleCatalogService.ProjectExampleCatalogEntry entry =
                new ProjectExampleCatalogService.ProjectExampleCatalogEntry(
                        "tokyo",
                        "Tokyo",
                        "project-examples/tokyo.json",
                        "Tokyo Example Project",
                        "Tokyo Urban Grid"
                );
        ObjectNode dataset = new ObjectMapper().createObjectNode();

        when(projectExampleCatalogService.getExampleByKeyOrThrow("tokyo")).thenReturn(entry);
        when(projectService.createProject(any(Project.class)))
                .thenReturn(Project.builder().id(projectId).name("Tokyo Example Project").description("").build());
        when(projectExampleCatalogService.loadDataset(entry)).thenReturn(dataset);
        when(gridService.createGrid(any())).thenReturn(new GridResponse(gridId, projectId, "Tokyo Urban Grid", "", 0));
        when(gridService.replaceGridDataset(eq(gridId), any()))
                .thenThrow(new GridDatasetValidationException("invalid dataset"));

        assertThrows(GridDatasetValidationException.class, () -> installerService.installExampleProject(request));
    }
}
