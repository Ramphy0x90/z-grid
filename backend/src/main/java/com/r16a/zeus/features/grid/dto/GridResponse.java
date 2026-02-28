package com.r16a.zeus.features.grid.dto;

import com.r16a.zeus.features.grid.model.Grid;

import java.util.UUID;

public record GridResponse(
        UUID id,
        UUID projectId,
        String name,
        String description,
        int busCount
) {
    public static GridResponse from(Grid grid, int busCount) {
        return new GridResponse(
                grid.getId(),
                grid.getProjectId(),
                grid.getName(),
                grid.getDescription(),
                busCount
        );
    }
}
