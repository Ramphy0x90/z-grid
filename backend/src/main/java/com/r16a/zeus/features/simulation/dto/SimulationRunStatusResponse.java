package com.r16a.zeus.features.simulation.dto;

import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.features.simulation.model.SimulationRunStatus;
import com.r16a.zeus.features.simulation.model.SimulationType;

import java.time.Instant;
import java.util.UUID;

public record SimulationRunStatusResponse(
        UUID runId,
        UUID gridId,
        SimulationType simulationType,
        String engineKey,
        String engineVersion,
        SimulationRunStatus status,
        SimulationFailureCode failureCode,
        String errorMessage,
        Instant createdAt,
        Instant startedAt,
        Instant finishedAt,
        long queueWaitMs,
        Long runDurationMs,
        SimulationRunResultResponse result
) {
}
