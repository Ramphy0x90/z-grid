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
@Table("grids")
public class Grid {
    @Id
    private UUID id;

    @Column("project_id")
    private UUID projectId;

    private String name;
    private String description;

    @Column("base_mva")
    private Double baseMva;

    @Column("frequency_hz")
    private Double frequencyHz;

    @CreatedDate @Column("created_at")
    private Instant createdAt;

    @LastModifiedDate @Column("updated_at")
    private Instant updatedAt;
}
