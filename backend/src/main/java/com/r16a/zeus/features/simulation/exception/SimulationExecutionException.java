package com.r16a.zeus.features.simulation.exception;

import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import lombok.Getter;

@Getter
public class SimulationExecutionException extends RuntimeException {
    private final SimulationFailureCode failureCode;

    public SimulationExecutionException(SimulationFailureCode failureCode, String message) {
        super(message);
        this.failureCode = failureCode;
    }

    public SimulationExecutionException(SimulationFailureCode failureCode, String message, Throwable cause) {
        super(message, cause);
        this.failureCode = failureCode;
    }
}
