package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.engine.EngineExecutionRequest;
import com.r16a.zeus.features.engine.EngineExecutionResult;
import com.r16a.zeus.features.engine.EngineFacade;
import com.r16a.zeus.features.engine.EngineFacadeRouter;
import com.r16a.zeus.features.grid.service.GridService;
import com.r16a.zeus.features.simulation.application.SimulationExecutionRequest;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.features.simulation.model.SimulationType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HostingCapacitySimulationExecutorTest {
    @Mock
    private GridService gridService;
    @Mock
    private EngineFacadeRouter engineFacadeRouter;
    @Mock
    private EngineFacade engineFacade;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HostingCapacitySimulationExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new HostingCapacitySimulationExecutor(gridService, engineFacadeRouter, objectMapper);
    }

    @Test
    void executeDispatchesToHostingCapacityEngineFacade() {
        UUID runId = UUID.randomUUID();
        UUID gridId = UUID.randomUUID();
        ObjectNode dataset = objectMapper.createObjectNode().put("name", "grid");
        ObjectNode summary = objectMapper.createObjectNode().put("totalCandidateBuses", 1);
        ObjectNode result = objectMapper.createObjectNode().put("country", "DE");

        when(gridService.getGridDataset(gridId)).thenReturn(dataset);
        when(engineFacadeRouter.resolve(SimulationType.HOSTING_CAPACITY, "remote-python-hosting-capacity-v1"))
                .thenReturn(engineFacade);
        when(engineFacade.execute(any(EngineExecutionRequest.class)))
                .thenReturn(new EngineExecutionResult(summary, result));

        var response = executor.execute(new SimulationExecutionRequest(
                runId,
                gridId,
                SimulationType.HOSTING_CAPACITY,
                null,
                "{\"country\":\"DE\",\"checkPowerQuality\":true}"
        ));

        assertEquals(1, response.summary().path("totalCandidateBuses").asInt());
        assertEquals("DE", response.result().path("country").asText());

        ArgumentCaptor<EngineExecutionRequest> captor = ArgumentCaptor.forClass(EngineExecutionRequest.class);
        verify(engineFacade).execute(captor.capture());
        assertEquals("DE", captor.getValue().options().path("country").asText());
        assertEquals(true, captor.getValue().options().path("checkPowerQuality").asBoolean());
    }

    @Test
    void executeMapsInvalidOptionsToValidationError() {
        UUID runId = UUID.randomUUID();
        UUID gridId = UUID.randomUUID();
        when(gridService.getGridDataset(gridId)).thenReturn(objectMapper.createObjectNode());

        SimulationExecutionException ex = assertThrows(
                SimulationExecutionException.class,
                () -> executor.execute(new SimulationExecutionRequest(
                        runId,
                        gridId,
                        SimulationType.HOSTING_CAPACITY,
                        null,
                        "{\"country\":"
                ))
        );
        assertEquals(SimulationFailureCode.VALIDATION, ex.getFailureCode());
    }
}
