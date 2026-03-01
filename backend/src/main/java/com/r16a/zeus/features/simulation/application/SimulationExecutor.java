package com.r16a.zeus.features.simulation.application;

import com.r16a.zeus.features.simulation.model.SimulationType;

public interface SimulationExecutor {
    SimulationType simulationType();
    String defaultEngineKey();
    SimulationExecutionResult execute(SimulationExecutionRequest request);
}
