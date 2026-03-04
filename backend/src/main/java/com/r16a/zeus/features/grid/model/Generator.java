package com.r16a.zeus.features.grid.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("generators")
public class Generator {
    @Id
    private UUID id;

    @Column("bus_id")
    private UUID busId;

    private String name;

    @Column("active_power_mw")
    private Double activePowerMw;

    @Column("reactive_power_mvar")
    private Double reactivePowerMvar;

    @Column("voltage_pu")
    private Double voltagePu;

    @Column("min_mw")
    private Double minMw;

    @Column("max_mw")
    private Double maxMw;

    @Column("in_service")
    private boolean inService;

    @Column("min_mvar")
    private Double minMvar;

    @Column("max_mvar")
    private Double maxMvar;

    @Column("xdpp_pu")
    private Double xdppPu;

    @Column("x2_pu")
    private Double x2Pu;

    @Column("x0_pu")
    private Double x0Pu;

    @Column("neutral_grounded")
    private Boolean neutralGrounded;

    @Column("neutral_resistance_pu")
    private Double neutralResistancePu;

    @Column("neutral_reactance_pu")
    private Double neutralReactancePu;

    @Column("cost_a")
    private Double costA;

    @Column("cost_b")
    private Double costB;

    @Column("cost_c")
    private Double costC;

    @Column("ramp_rate_mw_per_min")
    private Double rampRateMwPerMin;

    @CreatedDate @Column("created_at")
    private Instant createdAt;

    @LastModifiedDate @Column("updated_at")
    private Instant updatedAt;
}
