package com.r16a.zeus.features.engine;

import tools.jackson.databind.JsonNode;

public record EngineExecutionResult(
        JsonNode summary,
        JsonNode data
) {
}
