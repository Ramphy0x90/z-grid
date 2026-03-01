package com.r16a.zeus.features.simulation.repository;

import com.r16a.zeus.features.simulation.model.SimulationRunResult;
import org.springframework.data.repository.CrudRepository;

import java.util.Optional;
import java.util.UUID;

public interface SimulationRunResultRepository extends CrudRepository<SimulationRunResult, UUID> {
    Optional<SimulationRunResult> findByRunId(UUID runId);
}
