package com.r16a.zeus.features.grid.model;

import com.r16a.zeus.features.grid.model.type.ShuntType;
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
@Table("shunt_compensators")
public class ShuntCompensator {
    @Id
    private UUID id;

    @Column("bus_id")
    private UUID busId;

    private String name;

    @Column("shunt_type")
    private ShuntType shuntType;

    @Column("q_mvar")
    private Double qMvar;

    @Column("max_step")
    private Integer maxStep;

    @Column("current_step")
    private Integer currentStep;

    @Column("in_service")
    private boolean inService;

    @CreatedDate @Column("created_at")
    private Instant createdAt;

    @LastModifiedDate @Column("updated_at")
    private Instant updatedAt;
}
