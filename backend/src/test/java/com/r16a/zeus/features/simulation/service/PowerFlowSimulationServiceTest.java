package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.grid.model.Grid;
import com.r16a.zeus.features.grid.service.GridService;
import com.r16a.zeus.features.simulation.application.SimulationExecutor;
import com.r16a.zeus.features.simulation.application.SimulationFacade;
import com.r16a.zeus.features.simulation.application.SimulationResultStore;
import com.r16a.zeus.features.simulation.dto.StartSimulationRunRequest;
import com.r16a.zeus.features.simulation.dto.StartSimulationRunResponse;
import com.r16a.zeus.features.simulation.model.SimulationRun;
import com.r16a.zeus.features.simulation.model.SimulationRunStatus;
import com.r16a.zeus.features.simulation.model.SimulationType;
import com.r16a.zeus.features.simulation.repository.SimulationRunRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
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
    private static final String PY_ENGINE_KEY = "remote-python-powerflow-v1";

    @Mock
    private SimulationRunRepository simulationRunRepository;
    @Mock
    private SimulationResultStore simulationResultStore;
    @Mock
    private GridService gridService;
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Mock
    private SimulationExecutor powerFlowExecutor;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void startRunQueuesNewRunWhenNoActiveRunExists() {
        UUID gridId = UUID.randomUUID();
        Grid grid = Grid.builder().id(gridId).projectId(UUID.randomUUID()).name("Grid").build();
        when(gridService.getGridByIdOrThrow(gridId)).thenReturn(grid);
        when(powerFlowExecutor.simulationType()).thenReturn(SimulationType.POWER_FLOW);
        when(powerFlowExecutor.defaultEngineKey()).thenReturn(PY_ENGINE_KEY);
        when(simulationRunRepository.findFirstByGridIdAndSimulationTypeAndStatusInOrderByCreatedAtDesc(
                any(),
                any(),
                any(Set.class)
        )).thenReturn(Optional.empty());
        when(simulationRunRepository.save(any(SimulationRun.class))).thenAnswer((invocation) -> invocation.getArgument(0));

        SimulationFacade facade = new SimulationFacade(
                simulationRunRepository,
                simulationResultStore,
                gridService,
                eventPublisher,
                objectMapper,
                List.of(powerFlowExecutor)
        );

        StartSimulationRunResponse response = facade.startRun(
                gridId,
                new StartSimulationRunRequest(SimulationType.POWER_FLOW, null, null, null)
        );

        assertFalse(response.reusedExisting());
        assertEquals(SimulationRunStatus.QUEUED, response.status());
        verify(eventPublisher).publishEvent(new SimulationRunQueuedEvent(
                response.runId(),
                SimulationType.POWER_FLOW,
                PY_ENGINE_KEY
        ));
    }

    @Test
    void startRunReusesActiveRun() {
        UUID gridId = UUID.randomUUID();
        UUID runId = UUID.randomUUID();
        Grid grid = Grid.builder().id(gridId).projectId(UUID.randomUUID()).name("Grid").build();
        SimulationRun activeRun = SimulationRun.builder()
                .id(runId)
                .gridId(gridId)
                .simulationType(SimulationType.POWER_FLOW)
                .status(SimulationRunStatus.RUNNING)
                .engineKey(PY_ENGINE_KEY)
                .build();

        when(gridService.getGridByIdOrThrow(gridId)).thenReturn(grid);
        when(powerFlowExecutor.simulationType()).thenReturn(SimulationType.POWER_FLOW);
        when(powerFlowExecutor.defaultEngineKey()).thenReturn(PY_ENGINE_KEY);
        when(simulationRunRepository.findFirstByGridIdAndSimulationTypeAndStatusInOrderByCreatedAtDesc(
                any(),
                any(),
                any(Set.class)
        )).thenReturn(Optional.of(activeRun));

        SimulationFacade facade = new SimulationFacade(
                simulationRunRepository,
                simulationResultStore,
                gridService,
                eventPublisher,
                objectMapper,
                List.of(powerFlowExecutor)
        );

        StartSimulationRunResponse response = facade.startRun(
                gridId,
                new StartSimulationRunRequest(SimulationType.POWER_FLOW, null, null, null)
        );

        assertTrue(response.reusedExisting());
        assertEquals(runId, response.runId());
        assertEquals(SimulationRunStatus.RUNNING, response.status());
    }

    @Test
    void startRunFailsStaleQueuedRunAndCreatesNewRun() {
        UUID gridId = UUID.randomUUID();
        Grid grid = Grid.builder().id(gridId).projectId(UUID.randomUUID()).name("Grid").build();
        SimulationRun staleQueued = SimulationRun.builder()
                .id(UUID.randomUUID())
                .gridId(gridId)
                .simulationType(SimulationType.POWER_FLOW)
                .status(SimulationRunStatus.QUEUED)
                .engineKey(PY_ENGINE_KEY)
                .createdAt(Instant.now().minusSeconds(180))
                .build();

        when(gridService.getGridByIdOrThrow(gridId)).thenReturn(grid);
        when(powerFlowExecutor.simulationType()).thenReturn(SimulationType.POWER_FLOW);
        when(powerFlowExecutor.defaultEngineKey()).thenReturn(PY_ENGINE_KEY);
        when(simulationRunRepository.findFirstByGridIdAndSimulationTypeAndStatusInOrderByCreatedAtDesc(
                any(),
                any(),
                any(Set.class)
        )).thenReturn(Optional.of(staleQueued));
        when(simulationRunRepository.save(any(SimulationRun.class))).thenAnswer((invocation) -> invocation.getArgument(0));

        SimulationFacade facade = new SimulationFacade(
                simulationRunRepository,
                simulationResultStore,
                gridService,
                eventPublisher,
                objectMapper,
                List.of(powerFlowExecutor)
        );

        StartSimulationRunResponse response = facade.startRun(
                gridId,
                new StartSimulationRunRequest(SimulationType.POWER_FLOW, null, null, null)
        );

        assertFalse(response.reusedExisting());
        ArgumentCaptor<SimulationRun> captor = ArgumentCaptor.forClass(SimulationRun.class);
        verify(simulationRunRepository, org.mockito.Mockito.times(2)).save(captor.capture());
        SimulationRun firstSave = captor.getAllValues().get(0);
        assertEquals(SimulationRunStatus.FAILED, firstSave.getStatus());
        assertEquals(response.simulationType(), SimulationType.POWER_FLOW);
    }
}
