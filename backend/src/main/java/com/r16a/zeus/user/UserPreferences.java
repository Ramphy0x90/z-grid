package com.r16a.zeus.user;

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
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("user_preferences")
public class UserPreferences {
    @Id
    @Column("user_id")
    private UUID userId;

    @Column("map_style")
    private UserMapStyle mapStyle;

    @Column("default_power_quality_country")
    private UserPreferenceCountry defaultPowerQualityCountry;

    @Column("default_hosting_capacity_country")
    private UserPreferenceCountry defaultHostingCapacityCountry;

    @Column("default_map_view")
    private UserDefaultMapView defaultMapView;

    @Column("voltage_level_colors_json")
    private Map<String, String> voltageLevelColors;

    @CreatedDate
    @Column("created_at")
    private Instant createdAt;

    @LastModifiedDate
    @Column("updated_at")
    private Instant updatedAt;
}
