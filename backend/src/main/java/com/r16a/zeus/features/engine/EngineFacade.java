package com.r16a.zeus.features.engine;

import com.r16a.zeus.features.simulation.model.SimulationType;

public interface EngineFacade {
    SimulationType simulationType();
    String engineKey();
    String engineVersion();
    EngineExecutionResult execute(EngineExecutionRequest request);
}
