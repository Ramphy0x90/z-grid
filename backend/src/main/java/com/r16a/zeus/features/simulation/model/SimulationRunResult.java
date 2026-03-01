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
@Table("simulation_run_results")
public class SimulationRunResult implements Persistable<UUID> {
    @Id
    @Column("run_id")
    private UUID runId;

    @Column("simulation_type")
    private SimulationType simulationType;

    @Column("summary_json")
    private String summaryJson;

    @Column("result_json")
    private String resultJson;

    @CreatedDate
    @Column("created_at")
    private Instant createdAt;

    @LastModifiedDate
    @Column("updated_at")
    private Instant updatedAt;

    @Transient
    private boolean forceInsert;

    @Override
    public UUID getId() {
        return runId;
    }

    @Override
    public boolean isNew() {
        return forceInsert || createdAt == null;
    }
}
