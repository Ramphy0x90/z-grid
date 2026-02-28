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
@Table("power_flow_results")
public class PowerFlowResult implements Persistable<UUID> {
    @Id
    @Column("run_id")
    private UUID runId;

    private boolean converged;
    private int iterations;

    @Column("total_load_mw")
    private double totalLoadMw;

    @Column("total_generation_mw")
    private double totalGenerationMw;

    @Column("losses_mw")
    private double lossesMw;

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
