package com.r16a.zeus.features.simulation.dto;

import com.r16a.zeus.features.simulation.model.SimulationRunStatus;

import java.time.Instant;
import java.util.UUID;

public record StartPowerFlowRunResponse(
        UUID runId,
        SimulationRunStatus status,
        boolean reusedExisting,
        Instant createdAt
) {
}
