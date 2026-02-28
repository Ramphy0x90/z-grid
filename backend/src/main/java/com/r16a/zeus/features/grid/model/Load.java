package com.r16a.zeus.features.grid.model;

import com.r16a.zeus.features.grid.model.type.LoadType;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Table("loads")
public class Load {
    @Id
    private UUID id;
    @Column("bus_id")
    private UUID busId;
    private String name;
    @Column("active_power_mw")
    private Double activePowerMw;
    @Column("reactive_power_mvar")
    private Double reactivePowerMvar;
    @Column("in_service")
    private boolean inService;
    @Column("load_type")
    private LoadType loadType;
    @Column("scaling_factor")
    private Double scalingFactor;
    @CreatedDate @Column("created_at")
    private Instant createdAt;
    @LastModifiedDate @Column("updated_at")
    private Instant updatedAt;
}
