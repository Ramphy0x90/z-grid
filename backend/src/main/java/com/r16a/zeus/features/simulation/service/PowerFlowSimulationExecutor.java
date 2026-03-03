package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.engine.EngineExecutionRequest;
import com.r16a.zeus.features.engine.EngineExecutionResult;
import com.r16a.zeus.features.engine.EngineFacade;
import com.r16a.zeus.features.engine.EngineFacadeRouter;
import com.r16a.zeus.features.engine.remote.RemotePythonPowerFlowEngineAdapter;
import com.r16a.zeus.features.grid.service.GridService;
import com.r16a.zeus.features.simulation.application.SimulationExecutionRequest;
import com.r16a.zeus.features.simulation.application.SimulationExecutionResult;
import com.r16a.zeus.features.simulation.application.SimulationExecutor;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.features.simulation.model.SimulationType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class PowerFlowSimulationExecutor implements SimulationExecutor {
    private final GridService gridService;
    private final EngineFacadeRouter engineFacadeRouter;
    private final ObjectMapper objectMapper;

    @Override
    public SimulationType simulationType() {
        return SimulationType.POWER_FLOW;
    }

    @Override
    public String defaultEngineKey() {
        return RemotePythonPowerFlowEngineAdapter.ENGINE_KEY;
    }

    @Override
    public SimulationExecutionResult execute(SimulationExecutionRequest request) {
        JsonNode dataset = gridService.getGridDataset(request.gridId());
        JsonNode options = parseOptions(request.optionsJson());
        String engineKey = request.engineKey() == null || request.engineKey().isBlank()
                ? defaultEngineKey()
                : request.engineKey();

        try {
            EngineFacade engineFacade = engineFacadeRouter.resolve(SimulationType.POWER_FLOW, engineKey);
            EngineExecutionResult engineResult = engineFacade.execute(new EngineExecutionRequest(dataset, options));
            return new SimulationExecutionResult(engineResult.summary(), engineResult.data());
        } catch (SimulationExecutionException ex) {
            throw ex;
        } catch (IllegalArgumentException ex) {
            throw new SimulationExecutionException(SimulationFailureCode.VALIDATION, ex.getMessage(), ex);
        } catch (Exception ex) {
            throw new SimulationExecutionException(SimulationFailureCode.ENGINE_ERROR, ex.getMessage(), ex);
        }
    }

    private JsonNode parseOptions(String optionsJson) {
        if (optionsJson == null || optionsJson.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(optionsJson);
        } catch (Exception ex) {
            throw new SimulationExecutionException(SimulationFailureCode.VALIDATION, "Invalid options payload.", ex);
        }
    }
}
