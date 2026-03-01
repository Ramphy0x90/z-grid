package com.r16a.zeus.features.engine;

import tools.jackson.databind.JsonNode;

public record EngineExecutionRequest(
        JsonNode gridDataset,
        JsonNode options
) {
}
