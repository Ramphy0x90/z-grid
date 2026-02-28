package com.r16a.zeus.features.grid.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.r16a.zeus.features.grid.model.Grid;
import com.r16a.zeus.features.grid.repository.BusLayoutRepository;
import com.r16a.zeus.features.grid.repository.BusRepository;
import com.r16a.zeus.features.grid.repository.EdgeLayoutRepository;
import com.r16a.zeus.features.grid.repository.GeneratorRepository;
import com.r16a.zeus.features.grid.repository.GridRepository;
import com.r16a.zeus.features.grid.repository.LineRepository;
import com.r16a.zeus.features.grid.repository.LoadRepository;
import com.r16a.zeus.features.grid.repository.ShuntCompensatorRepository;
import com.r16a.zeus.features.grid.repository.TransformerRepository;
import com.r16a.zeus.features.grid.service.dataset.GridDatasetImportModel;
import com.r16a.zeus.features.grid.service.dataset.GridDatasetMapper;
import com.r16a.zeus.features.grid.service.dataset.GridDatasetPersistenceService;
import com.r16a.zeus.features.grid.service.dataset.GridDatasetSnapshot;
import com.r16a.zeus.features.grid.service.dataset.GridDatasetValidator;
import com.r16a.zeus.project.service.ProjectService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@ExtendWith(MockitoExtension.class)
class GridServiceTest {
    @Mock
    private GridRepository gridRepository;
    @Mock
    private BusRepository busRepository;
    @Mock
    private LineRepository lineRepository;
    @Mock
    private TransformerRepository transformerRepository;
    @Mock
    private LoadRepository loadRepository;
    @Mock
    private GeneratorRepository generatorRepository;
    @Mock
    private ShuntCompensatorRepository shuntCompensatorRepository;
    @Mock
    private BusLayoutRepository busLayoutRepository;
    @Mock
    private EdgeLayoutRepository edgeLayoutRepository;
    @Mock
    private ProjectService projectService;
    @Mock
    private GridDatasetMapper gridDatasetMapper;
    @Mock
    private GridDatasetValidator gridDatasetValidator;
    @Mock
    private GridDatasetPersistenceService gridDatasetPersistenceService;

    @InjectMocks
    private GridService gridService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void replaceGridDatasetUsesUniqueNamePolicyForImportedName() {
        UUID gridId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        Grid existing = Grid.builder()
                .id(gridId)
                .projectId(projectId)
                .name("Original")
                .description("")
                .baseMva(100.0)
                .frequencyHz(50.0)
                .build();

        GridDatasetImportModel importModel = new GridDatasetImportModel(
                "Imported Name",
                "Desc",
                110.0,
                60.0,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
        ObjectNode emptyDataset = objectMapper.createObjectNode();
        JsonNode response = objectMapper.createObjectNode().put("ok", true);

        when(gridRepository.findById(gridId)).thenReturn(Optional.of(existing));
        when(gridDatasetMapper.fromJson(eq(gridId), eq(existing), any(JsonNode.class))).thenReturn(importModel);
        when(gridRepository.existsByProjectIdAndNameAndIdNot(projectId, "Imported Name", gridId)).thenReturn(true);
        when(gridRepository.existsByProjectIdAndNameAndIdNot(projectId, "Imported Name 2", gridId)).thenReturn(false);
        when(gridRepository.save(any(Grid.class))).thenAnswer(inv -> inv.getArgument(0));
        when(busRepository.findByGridId(gridId)).thenReturn(List.of());
        when(lineRepository.findByGridId(gridId)).thenReturn(List.of());
        when(transformerRepository.findByGridId(gridId)).thenReturn(List.of());
        when(busLayoutRepository.findByGridId(gridId)).thenReturn(List.of());
        when(edgeLayoutRepository.findByGridId(gridId)).thenReturn(List.of());
        when(gridDatasetMapper.toJson(eq(existing), any(GridDatasetSnapshot.class))).thenReturn(response);

        JsonNode result = gridService.replaceGridDataset(gridId, emptyDataset);

        assertEquals(response, result);
        assertEquals("Imported Name 2", existing.getName());
        verify(gridDatasetValidator).validate(emptyDataset);
        verify(gridDatasetPersistenceService).replaceGridData(gridId, importModel);
    }
}
