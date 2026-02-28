package com.r16a.zeus.features.simulation.repository;

import com.r16a.zeus.features.simulation.model.PowerFlowResult;
import org.springframework.data.repository.CrudRepository;

import java.util.Optional;
import java.util.UUID;

public interface PowerFlowResultRepository extends CrudRepository<PowerFlowResult, UUID> {
    Optional<PowerFlowResult> findByRunId(UUID runId);
}
