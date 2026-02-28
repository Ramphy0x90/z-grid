package com.r16a.zeus.user.dto;

import com.r16a.zeus.core.security.authorization.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateUserRequest(
        @NotBlank
        String username,

        @NotBlank
        String email,

        @NotBlank
        String fullName,

        @NotNull
        Role role,
        boolean active
) {
}
