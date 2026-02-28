package com.r16a.zeus.auth.dto;

import com.r16a.zeus.core.security.authorization.Role;
import com.r16a.zeus.user.User;

import java.util.UUID;

public record LoginResponse(
        UUID id,
        String username,
        String email,
        String fullName,
        Role role,
        boolean active
) {
    public static LoginResponse from(User user) {
        return new LoginResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.isActive()
        );
    }
}
