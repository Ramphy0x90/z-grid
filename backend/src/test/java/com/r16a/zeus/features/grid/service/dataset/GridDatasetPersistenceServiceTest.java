package com.r16a.zeus.features.grid.service.dataset;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.r16a.zeus.features.grid.model.Bus;
import com.r16a.zeus.features.grid.model.Line;
import com.r16a.zeus.features.grid.repository.BusLayoutRepository;
import com.r16a.zeus.features.grid.repository.BusRepository;
import com.r16a.zeus.features.grid.repository.EdgeLayoutRepository;
import com.r16a.zeus.features.grid.repository.LineRepository;
import com.r16a.zeus.features.grid.repository.TransformerRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@ExtendWith(MockitoExtension.class)
class GridDatasetPersistenceServiceTest {
    @Mock
    private BusRepository busRepository;
    @Mock
    private LineRepository lineRepository;
    @Mock
    private TransformerRepository transformerRepository;
    @Mock
    private BusLayoutRepository busLayoutRepository;
    @Mock
    private EdgeLayoutRepository edgeLayoutRepository;
    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @InjectMocks
    private GridDatasetPersistenceService service;

    @Test
    void replaceGridDataUsesBatchInsertsAndDeletesExistingGraphFirst() {
        UUID gridId = UUID.randomUUID();
        UUID bus1 = UUID.randomUUID();
        UUID bus2 = UUID.randomUUID();

        GridDatasetImportModel importModel = new GridDatasetImportModel(
                "Grid",
                "",
                100.0,
                50.0,
                List.of(
                        Bus.builder().id(bus1).gridId(gridId).name("B1").inService(true).build(),
                        Bus.builder().id(bus2).gridId(gridId).name("B2").inService(true).build()
                ),
                List.of(Line.builder()
                        .id(UUID.randomUUID())
                        .gridId(gridId)
                        .fromBusId(bus1)
                        .toBusId(bus2)
                        .name("L1")
                        .inService(true)
                        .build()),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );

        service.replaceGridData(gridId, importModel);

        verify(edgeLayoutRepository).deleteByGridId(gridId);
        verify(busLayoutRepository).deleteByGridId(gridId);
        verify(lineRepository).deleteByGridId(gridId);
        verify(transformerRepository).deleteByGridId(gridId);
        verify(busRepository).deleteByGridId(gridId);

        verify(namedParameterJdbcTemplate, times(2)).batchUpdate(contains("INSERT INTO"), any(Map[].class));
    }
}
