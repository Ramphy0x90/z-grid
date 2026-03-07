package com.r16a.zeus.user.dto;

import com.r16a.zeus.user.UserDefaultMapView;
import com.r16a.zeus.user.UserMapStyle;
import com.r16a.zeus.user.UserPreferenceCountry;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record UpdateUserPreferencesRequest(
        @NotNull
        UserMapStyle mapStyle,
        @NotNull
        UserPreferenceCountry defaultPowerQualityCountry,
        @NotNull
        UserPreferenceCountry defaultHostingCapacityCountry,
        @NotNull
        UserDefaultMapView defaultMapView,
        @NotNull
        Map<String, String> voltageLevelColors
) {
}
