package com.r16a.zeus.features.simulation.dto;

import com.r16a.zeus.features.simulation.model.SimulationType;
import tools.jackson.databind.JsonNode;

public record SimulationRunResultResponse(
        SimulationType simulationType,
        JsonNode summary,
        JsonNode data
) {
}
