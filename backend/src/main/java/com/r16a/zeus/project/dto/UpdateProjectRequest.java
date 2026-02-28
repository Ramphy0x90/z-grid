package com.r16a.zeus.project.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateProjectRequest(
        @NotBlank
        String name,
        String description
) {
}
