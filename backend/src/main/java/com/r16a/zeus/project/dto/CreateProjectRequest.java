package com.r16a.zeus.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateProjectRequest(
        @NotNull
        UUID teamId,

        @NotBlank
        String name,
        String description
) {
}
