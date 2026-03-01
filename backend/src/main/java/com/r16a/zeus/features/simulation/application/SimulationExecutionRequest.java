package com.r16a.zeus.features.simulation.application;

import com.r16a.zeus.features.simulation.model.SimulationType;

import java.util.UUID;

public record SimulationExecutionRequest(
        UUID runId,
        UUID gridId,
        SimulationType simulationType,
        String engineKey,
        String optionsJson
) {
}
