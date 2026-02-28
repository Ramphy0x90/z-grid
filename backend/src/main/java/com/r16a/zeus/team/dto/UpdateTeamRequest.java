package com.r16a.zeus.team.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateTeamRequest(
        @NotBlank
        String name,
        String description
) {
}
