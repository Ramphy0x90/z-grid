package com.r16a.zeus.features.simulation.dto;

import com.r16a.zeus.features.simulation.model.SimulationRunStatus;
import com.r16a.zeus.features.simulation.model.SimulationType;

import java.time.Instant;
import java.util.UUID;

public record StartSimulationRunResponse(
        UUID runId,
        SimulationType simulationType,
        String engineKey,
        SimulationRunStatus status,
        boolean reusedExisting,
        Instant createdAt
) {
}
