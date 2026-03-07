package com.r16a.zeus.user.controller;

import com.r16a.zeus.user.dto.UpdateUserPreferencesRequest;
import com.r16a.zeus.user.dto.UserPreferencesResponse;
import com.r16a.zeus.user.service.UserPreferencesService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user/preferences")
@RequiredArgsConstructor
public class UserPreferencesController {
    private final UserPreferencesService userPreferencesService;

    @GetMapping("/me")
    public UserPreferencesResponse getMyPreferences(Authentication authentication) {
        return UserPreferencesResponse.from(
                userPreferencesService.getPreferencesByUsername(authentication.getName())
        );
    }

    @PutMapping("/me")
    public UserPreferencesResponse updateMyPreferences(
            Authentication authentication,
            @Valid @RequestBody UpdateUserPreferencesRequest request
    ) {
        return UserPreferencesResponse.from(
                userPreferencesService.updatePreferencesByUsername(authentication.getName(), request)
        );
    }
}
