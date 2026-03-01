package com.r16a.zeus.features.simulation.application;

import com.r16a.zeus.features.simulation.model.SimulationType;
import com.r16a.zeus.features.simulation.model.SimulationRunResult;

import java.util.Optional;
import java.util.UUID;

public interface SimulationResultStore {
    void save(UUID runId, SimulationType simulationType, SimulationExecutionResult result);
    Optional<SimulationRunResult> findByRunId(UUID runId);
}
