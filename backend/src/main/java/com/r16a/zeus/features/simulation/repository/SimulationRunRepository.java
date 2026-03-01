package com.r16a.zeus.features.simulation.repository;

import com.r16a.zeus.features.simulation.model.SimulationRun;
import com.r16a.zeus.features.simulation.model.SimulationRunStatus;
import com.r16a.zeus.features.simulation.model.SimulationType;
import org.springframework.data.repository.CrudRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SimulationRunRepository extends CrudRepository<SimulationRun, UUID> {
    Optional<SimulationRun> findByIdAndGridId(UUID runId, UUID gridId);
    Optional<SimulationRun> findFirstByGridIdAndStatusInOrderByCreatedAtDesc(
            UUID gridId,
            Collection<SimulationRunStatus> statuses
    );
    Optional<SimulationRun> findFirstByGridIdAndSimulationTypeAndStatusInOrderByCreatedAtDesc(
            UUID gridId,
            SimulationType simulationType,
            Collection<SimulationRunStatus> statuses
    );
    Optional<SimulationRun> findFirstByGridIdAndSimulationTypeAndIdempotencyKeyOrderByCreatedAtDesc(
            UUID gridId,
            SimulationType simulationType,
            String idempotencyKey
    );
    List<SimulationRun> findTop20ByGridIdOrderByCreatedAtDesc(UUID gridId);
    List<SimulationRun> findTop20ByGridIdAndSimulationTypeOrderByCreatedAtDesc(UUID gridId, SimulationType simulationType);
}
