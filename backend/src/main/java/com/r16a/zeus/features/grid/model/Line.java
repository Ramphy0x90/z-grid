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
@Table("lines")
public class Line {
    @Id
    private UUID id;

    @Column("grid_id")
    private UUID gridId;

    @Column("from_bus_id")
    private UUID fromBusId;

    @Column("to_bus_id")
    private UUID toBusId;

    private String name;

    @Column("resistance_pu")
    private Double resistancePu;

    @Column("reactance_pu")
    private Double reactancePu;

    @Column("susceptance_pu")
    private Double susceptancePu;

    @Column("rating_mva")
    private Double ratingMva;

    @Column("length_km")
    private Double lengthKm;

    @Column("in_service")
    private boolean inService;

    @Column("rating_mva_short_term")
    private Double ratingMvaShortTerm;

    @Column("max_loading_percent")
    private Double maxLoadingPercent;

    @Column("r0_pu")
    private Double r0Pu;

    @Column("x0_pu")
    private Double x0Pu;

    @Column("b0_pu")
    private Double b0Pu;

    @Column("from_switch_closed")
    private boolean fromSwitchClosed;

    @Column("to_switch_closed")
    private boolean toSwitchClosed;

    @CreatedDate @Column("created_at")
    private Instant createdAt;

    @LastModifiedDate @Column("updated_at")
    private Instant updatedAt;
}
