package com.r16a.zeus.features.grid.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateGridRequest(
        @NotBlank String name,
        String description
) {
}
