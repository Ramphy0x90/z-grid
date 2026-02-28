package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.grid.model.Grid;
import com.r16a.zeus.features.grid.service.GridService;
import com.r16a.zeus.features.simulation.dto.StartPowerFlowRunRequest;
import com.r16a.zeus.features.simulation.dto.StartPowerFlowRunResponse;
import com.r16a.zeus.features.simulation.model.PowerFlowResult;
import com.r16a.zeus.features.simulation.model.SimulationRun;
import com.r16a.zeus.features.simulation.model.SimulationRunStatus;
import com.r16a.zeus.features.simulation.repository.PowerFlowResultRepository;
import com.r16a.zeus.features.simulation.repository.SimulationRunRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PowerFlowSimulationServiceTest {

    @Mock
    private SimulationRunRepository simulationRunRepository;
    @Mock
    private PowerFlowResultRepository powerFlowResultRepository;
    @Mock
    private GridService gridService;
    @Mock
    private PowerFlowRunWorker powerFlowRunWorker;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void startRunQueuesNewRunWhenNoActiveRunExists() {
        UUID gridId = UUID.randomUUID();
        Grid grid = Grid.builder().id(gridId).projectId(UUID.randomUUID()).name("Grid").build();
        when(gridService.getGridByIdOrThrow(gridId)).thenReturn(grid);
        when(simulationRunRepository.findFirstByGridIdAndStatusInOrderByCreatedAtDesc(any(), any(Set.class)))
                .thenReturn(Optional.empty());
        when(simulationRunRepository.save(any(SimulationRun.class))).thenAnswer((invocation) -> invocation.getArgument(0));

        PowerFlowSimulationService service = new PowerFlowSimulationService(
                simulationRunRepository,
                powerFlowResultRepository,
                gridService,
                powerFlowRunWorker,
                objectMapper
        );

        StartPowerFlowRunResponse response = service.startRun(gridId, new StartPowerFlowRunRequest(null));

        assertFalse(response.reusedExisting());
        assertEquals(SimulationRunStatus.QUEUED, response.status());
        verify(powerFlowRunWorker).executeRun(response.runId());

        ArgumentCaptor<SimulationRun> captor = ArgumentCaptor.forClass(SimulationRun.class);
        verify(simulationRunRepository).save(captor.capture());
        SimulationRun saved = captor.getValue();
        assertEquals(gridId, saved.getGridId());
        assertEquals(SimulationRunStatus.QUEUED, saved.getStatus());
    }

    @Test
    void startRunReusesActiveRun() {
        UUID gridId = UUID.randomUUID();
        UUID runId = UUID.randomUUID();
        Grid grid = Grid.builder().id(gridId).projectId(UUID.randomUUID()).name("Grid").build();
        SimulationRun activeRun = SimulationRun.builder()
                .id(runId)
                .gridId(gridId)
                .status(SimulationRunStatus.RUNNING)
                .solver(PowerFlowSimulationService.SOLVER_NAME)
                .build();

        when(gridService.getGridByIdOrThrow(gridId)).thenReturn(grid);
        when(simulationRunRepository.findFirstByGridIdAndStatusInOrderByCreatedAtDesc(any(), any(Set.class)))
                .thenReturn(Optional.of(activeRun));

        PowerFlowSimulationService service = new PowerFlowSimulationService(
                simulationRunRepository,
                powerFlowResultRepository,
                gridService,
                powerFlowRunWorker,
                objectMapper
        );

        StartPowerFlowRunResponse response = service.startRun(gridId, new StartPowerFlowRunRequest(null));

        assertTrue(response.reusedExisting());
        assertEquals(runId, response.runId());
        assertEquals(SimulationRunStatus.RUNNING, response.status());
    }

    @Test
    void toStatusResponseIncludesResultForSucceededRun() {
        UUID runId = UUID.randomUUID();
        UUID gridId = UUID.randomUUID();
        SimulationRun run = SimulationRun.builder()
                .id(runId)
                .gridId(gridId)
                .status(SimulationRunStatus.SUCCEEDED)
                .solver(PowerFlowSimulationService.SOLVER_NAME)
                .build();
        PowerFlowResult result = PowerFlowResult.builder()
                .runId(runId)
                .converged(true)
                .iterations(5)
                .resultJson("""
                        {"converged":true,"iterations":5,"summary":{"totalLoadMw":1.0,"totalGenerationMw":1.1,"lossesMw":0.1},"busResults":[],"branchResults":[],"violations":{"voltage":[],"thermal":[]},"warnings":[]}
                        """)
                .build();
        when(powerFlowResultRepository.findByRunId(runId)).thenReturn(Optional.of(result));

        PowerFlowSimulationService service = new PowerFlowSimulationService(
                simulationRunRepository,
                powerFlowResultRepository,
                gridService,
                powerFlowRunWorker,
                objectMapper
        );

        var status = service.toStatusResponse(run);
        assertEquals(SimulationRunStatus.SUCCEEDED, status.status());
        assertEquals(5, status.result().iterations());
    }
}
