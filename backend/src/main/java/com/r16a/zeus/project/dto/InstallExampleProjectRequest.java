package com.r16a.zeus.project.dto;

import jakarta.validation.constraints.NotBlank;

public record InstallExampleProjectRequest(
        @NotBlank
        String exampleKey,
        String projectName,
        String gridName
) {
}
