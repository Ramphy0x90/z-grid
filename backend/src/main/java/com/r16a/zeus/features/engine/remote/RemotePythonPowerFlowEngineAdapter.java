package com.r16a.zeus.features.engine.remote;

import com.r16a.zeus.features.engine.EngineExecutionRequest;
import com.r16a.zeus.features.engine.EngineExecutionResult;
import com.r16a.zeus.features.engine.EngineFacade;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.features.simulation.model.SimulationType;
import org.springframework.stereotype.Component;

@Component
public class RemotePythonPowerFlowEngineAdapter implements EngineFacade {
    public static final String ENGINE_KEY = "remote-python-powerflow-v1";

    @Override
    public SimulationType simulationType() {
        return SimulationType.POWER_FLOW;
    }

    @Override
    public String engineKey() {
        return ENGINE_KEY;
    }

    @Override
    public String engineVersion() {
        return "v1";
    }

    @Override
    public EngineExecutionResult execute(EngineExecutionRequest request) {
        throw new SimulationExecutionException(
                SimulationFailureCode.ENGINE_ERROR,
                "Remote Python engine adapter is not implemented yet."
        );
    }
}
