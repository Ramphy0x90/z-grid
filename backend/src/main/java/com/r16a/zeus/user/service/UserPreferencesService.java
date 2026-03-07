package com.r16a.zeus.user.service;

import com.r16a.zeus.user.UserDefaultMapView;
import com.r16a.zeus.user.UserMapStyle;
import com.r16a.zeus.user.UserPreferenceCountry;
import com.r16a.zeus.user.UserPreferences;
import com.r16a.zeus.user.dto.UpdateUserPreferencesRequest;
import com.r16a.zeus.user.exception.InvalidUserPreferencesException;
import com.r16a.zeus.user.repository.UserPreferencesRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class UserPreferencesService {
    private static final Pattern VOLTAGE_BUCKET_PATTERN = Pattern.compile("^\\d+(?:\\.\\d+)?kV$");
    private static final Pattern HEX_COLOR_PATTERN = Pattern.compile("^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$");

    private final UserService userService;
    private final UserPreferencesRepository userPreferencesRepository;

    @Transactional
    public UserPreferences getPreferencesByUsername(String username) {
        UUID userId = userService.getUserByUsernameOrThrow(username).getId();
        return userPreferencesRepository.findById(userId)
                .orElseGet(() -> createDefaultPreferences(userId));
    }

    @Transactional
    public UserPreferences updatePreferencesByUsername(String username, UpdateUserPreferencesRequest request) {
        UUID userId = userService.getUserByUsernameOrThrow(username).getId();
        UserPreferences current = userPreferencesRepository.findById(userId)
                .orElseGet(() -> createDefaultPreferences(userId));

        Map<String, String> validatedPalette = sanitizeAndValidatePalette(request.voltageLevelColors());
        current.setMapStyle(request.mapStyle());
        current.setDefaultPowerQualityCountry(request.defaultPowerQualityCountry());
        current.setDefaultHostingCapacityCountry(request.defaultHostingCapacityCountry());
        current.setDefaultMapView(request.defaultMapView());
        current.setVoltageLevelColors(validatedPalette);
        return userPreferencesRepository.save(current);
    }

    private UserPreferences createDefaultPreferences(UUID userId) {
        UserPreferences defaults = UserPreferences.builder()
                .userId(userId)
                .mapStyle(UserMapStyle.cartoDark)
                .defaultPowerQualityCountry(UserPreferenceCountry.DE)
                .defaultHostingCapacityCountry(UserPreferenceCountry.DE)
                .defaultMapView(UserDefaultMapView.map)
                .voltageLevelColors(Map.of())
                .build();
        return userPreferencesRepository.save(defaults);
    }

    private Map<String, String> sanitizeAndValidatePalette(Map<String, String> rawPalette) {
        Map<String, String> cleaned = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : rawPalette.entrySet()) {
            String key = entry.getKey() == null ? "" : entry.getKey().trim();
            String value = entry.getValue() == null ? "" : entry.getValue().trim();
            if (!VOLTAGE_BUCKET_PATTERN.matcher(key).matches()) {
                throw new InvalidUserPreferencesException(
                        "Voltage level color key must match <number>kV format (e.g. 20kV, 0.4kV): " + key
                );
            }
            if (!HEX_COLOR_PATTERN.matcher(value).matches()) {
                throw new InvalidUserPreferencesException(
                        "Voltage level color must be a hex color (#RRGGBB or #RRGGBBAA): " + value
                );
            }
            cleaned.put(key, value);
        }
        return cleaned;
    }
}
