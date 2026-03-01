package com.r16a.zeus.features.simulation.dto;

import com.r16a.zeus.features.simulation.model.SimulationType;
import tools.jackson.databind.JsonNode;

public record StartSimulationRunRequest(
        SimulationType simulationType,
        String engineKey,
        JsonNode options,
        String idempotencyKey
) {
}
