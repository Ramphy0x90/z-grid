package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.simulation.model.SimulationType;

import java.util.UUID;

public record SimulationRunQueuedEvent(
        UUID runId,
        SimulationType simulationType,
        String engineKey
) {
}
