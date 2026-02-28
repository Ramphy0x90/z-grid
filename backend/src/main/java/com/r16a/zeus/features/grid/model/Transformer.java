package com.r16a.zeus.features.grid.model;

import com.r16a.zeus.features.grid.model.type.TapSide;
import com.r16a.zeus.features.grid.model.type.WindingType;
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
@Table("transformers")
public class Transformer {
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

    @Column("rating_mva")
    private Double ratingMva;

    @Column("tap_ratio")
    private Double tapRatio;

    @Column("phase_shift_deg")
    private Double phaseShiftDeg;

    @Column("in_service")
    private boolean inService;

    @Column("sn_mva")
    private Double snMva;

    @Column("tap_min")
    private Double tapMin;

    @Column("tap_max")
    private Double tapMax;

    @Column("tap_step_percent")
    private Double tapStepPercent;

    @Column("tap_side")
    private TapSide tapSide;

    @Column("winding_type")
    private WindingType windingType;

    @Column("max_loading_percent")
    private Double maxLoadingPercent;

    @Column("from_switch_closed")
    private boolean fromSwitchClosed;

    @Column("to_switch_closed")
    private boolean toSwitchClosed;

    @CreatedDate @Column("created_at")
    private Instant createdAt;

    @LastModifiedDate @Column("updated_at")
    private Instant updatedAt;
}
