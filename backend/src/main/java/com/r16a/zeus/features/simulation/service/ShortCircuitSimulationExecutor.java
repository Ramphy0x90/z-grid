package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.simulation.application.SimulationExecutionRequest;
import com.r16a.zeus.features.simulation.application.SimulationExecutionResult;
import com.r16a.zeus.features.simulation.application.SimulationExecutor;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.features.simulation.model.SimulationType;
import org.springframework.stereotype.Component;

@Component
public class ShortCircuitSimulationExecutor implements SimulationExecutor {
    @Override
    public SimulationType simulationType() {
        return SimulationType.SHORT_CIRCUIT;
    }

    @Override
    public String defaultEngineKey() {
        return "local-java-short-circuit-v1";
    }

    @Override
    public SimulationExecutionResult execute(SimulationExecutionRequest request) {
        throw new SimulationExecutionException(
                SimulationFailureCode.ENGINE_ERROR,
                "Short-circuit simulation is not implemented yet."
        );
    }
}
