package com.r16a.zeus.features.grid.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateGridRequest(
        @NotNull UUID projectId,
        @NotBlank String name,
        String description
) {
}
