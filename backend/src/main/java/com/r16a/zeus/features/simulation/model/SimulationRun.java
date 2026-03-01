package com.r16a.zeus.features.simulation.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("simulation_runs")
public class SimulationRun implements Persistable<UUID> {
    @Id
    private UUID id;

    @Column("grid_id")
    private UUID gridId;

    @Column("simulation_type")
    private SimulationType simulationType;

    private SimulationRunStatus status;

    // Legacy column kept for backward compatibility during schema transition.
    private String solver;

    @Column("engine_key")
    private String engineKey;

    @Column("engine_version")
    private String engineVersion;

    @Column("options_json")
    private String optionsJson;

    @Column("idempotency_key")
    private String idempotencyKey;

    @Column("error_message")
    private String errorMessage;

    @Column("failure_code")
    private SimulationFailureCode failureCode;

    @CreatedDate
    @Column("created_at")
    private Instant createdAt;

    @Column("started_at")
    private Instant startedAt;

    @Column("finished_at")
    private Instant finishedAt;

    @LastModifiedDate
    @Column("updated_at")
    private Instant updatedAt;

    @Transient
    private boolean forceInsert;

    @Override
    public boolean isNew() {
        return forceInsert || createdAt == null;
    }

    public static SimulationRun newRun(
            UUID gridId,
            SimulationType simulationType,
            String engineKey,
            String engineVersion,
            String optionsJson,
            String idempotencyKey
    ) {
        return SimulationRun.builder()
                .id(UUID.randomUUID())
                .gridId(gridId)
                .simulationType(simulationType)
                .status(SimulationRunStatus.QUEUED)
                .solver(engineKey)
                .engineKey(engineKey)
                .engineVersion(engineVersion)
                .optionsJson(optionsJson)
                .idempotencyKey(idempotencyKey)
                .forceInsert(true)
                .build();
    }
}
