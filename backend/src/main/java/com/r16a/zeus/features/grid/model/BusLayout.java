package com.r16a.zeus.features.grid.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("bus_layouts")
public class BusLayout {
    @Id
    @Column("bus_id")
    private UUID busId;

    @Column("grid_id")
    private UUID gridId;

    private Double lat;
    private Double lng;

    @Column("schematic_x")
    private Double schematicX;

    @Column("schematic_y")
    private Double schematicY;
}
