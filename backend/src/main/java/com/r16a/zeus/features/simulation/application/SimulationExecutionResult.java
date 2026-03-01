package com.r16a.zeus.features.simulation.application;

import tools.jackson.databind.JsonNode;

public record SimulationExecutionResult(
        JsonNode summary,
        JsonNode result
) {
}
