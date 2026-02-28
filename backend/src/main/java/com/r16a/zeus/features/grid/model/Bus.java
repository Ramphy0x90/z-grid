package com.r16a.zeus.features.grid.model;

import com.r16a.zeus.features.grid.model.type.BusType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
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
@Table("buses")
public class Bus {
    @Id
    private UUID id;

    @Column("grid_id")
    private UUID gridId;

    private String name;

    @Column("nominal_voltage_kv")
    private Double nominalVoltageKv;

    @Column("bus_type")
    private BusType busType;

    @Column("voltage_magnitude_pu")
    private Double voltageMagnitudePu;

    @Column("voltage_angle_deg")
    private Double voltageAngleDeg;

    @Column("min_voltage_pu")
    private Double minVoltagePu;

    @Column("max_voltage_pu")
    private Double maxVoltagePu;

    @Column("in_service")
    private boolean inService;

    private Integer area;

    private Integer zone;

    @CreatedDate @Column("created_at")
    private Instant createdAt;

    @LastModifiedDate @Column("updated_at")
    private Instant updatedAt;
}
