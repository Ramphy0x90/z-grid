package com.r16a.zeus.features.simulation.dto;

public record PowerFlowRunOptions(
        Integer maxIterations,
        Double tolerance
) {
}
