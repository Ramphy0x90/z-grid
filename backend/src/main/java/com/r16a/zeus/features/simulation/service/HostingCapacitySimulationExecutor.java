package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.simulation.application.SimulationExecutionRequest;
import com.r16a.zeus.features.simulation.application.SimulationExecutionResult;
import com.r16a.zeus.features.simulation.application.SimulationExecutor;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.features.simulation.model.SimulationType;
import org.springframework.stereotype.Component;

@Component
public class HostingCapacitySimulationExecutor implements SimulationExecutor {
    @Override
    public SimulationType simulationType() {
        return SimulationType.HOSTING_CAPACITY;
    }

    @Override
    public String defaultEngineKey() {
        return "local-java-hosting-capacity-v1";
    }

    @Override
    public SimulationExecutionResult execute(SimulationExecutionRequest request) {
        throw new SimulationExecutionException(
                SimulationFailureCode.ENGINE_ERROR,
                "Hosting capacity simulation is not implemented yet."
        );
    }
}
