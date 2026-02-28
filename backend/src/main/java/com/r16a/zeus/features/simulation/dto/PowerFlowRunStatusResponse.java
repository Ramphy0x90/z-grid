package com.r16a.zeus.features.simulation.dto;

import com.r16a.zeus.features.simulation.model.SimulationRunStatus;

import java.time.Instant;
import java.util.UUID;

public record PowerFlowRunStatusResponse(
        UUID runId,
        UUID gridId,
        SimulationRunStatus status,
        String solver,
        String errorMessage,
        Instant createdAt,
        Instant startedAt,
        Instant finishedAt,
        PowerFlowResultResponse result
) {
}
