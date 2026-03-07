package com.r16a.zeus.user.dto;

import com.r16a.zeus.user.UserDefaultMapView;
import com.r16a.zeus.user.UserMapStyle;
import com.r16a.zeus.user.UserPreferenceCountry;
import com.r16a.zeus.user.UserPreferences;

import java.util.Map;
import java.util.UUID;

public record UserPreferencesResponse(
        UUID userId,
        UserMapStyle mapStyle,
        UserPreferenceCountry defaultPowerQualityCountry,
        UserPreferenceCountry defaultHostingCapacityCountry,
        UserDefaultMapView defaultMapView,
        Map<String, String> voltageLevelColors
) {
    public static UserPreferencesResponse from(UserPreferences preferences) {
        return new UserPreferencesResponse(
                preferences.getUserId(),
                preferences.getMapStyle(),
                preferences.getDefaultPowerQualityCountry(),
                preferences.getDefaultHostingCapacityCountry(),
                preferences.getDefaultMapView(),
                preferences.getVoltageLevelColors()
        );
    }
}
