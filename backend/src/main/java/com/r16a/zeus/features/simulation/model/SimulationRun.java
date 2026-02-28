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

    private SimulationRunStatus status;
    private String solver;

    @Column("options_json")
    private String optionsJson;

    @Column("error_message")
    private String errorMessage;

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

    public static SimulationRun newRun(UUID gridId, String solver, String optionsJson) {
        return SimulationRun.builder()
                .id(UUID.randomUUID())
                .gridId(gridId)
                .status(SimulationRunStatus.QUEUED)
                .solver(solver)
                .optionsJson(optionsJson)
                .forceInsert(true)
                .build();
    }
}
