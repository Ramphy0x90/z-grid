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
@Table("edge_layouts")
public class EdgeLayout {
    @Id
    @Column("edge_id")
    private UUID edgeId;

    @Column("grid_id")
    private UUID gridId;

    @Column("map_midpoint_x")
    private Double mapMidpointX;

    @Column("map_midpoint_y")
    private Double mapMidpointY;

    @Column("schematic_midpoint_x")
    private Double schematicMidpointX;

    @Column("schematic_midpoint_y")
    private Double schematicMidpointY;
}
