package com.r16a.zeus.features.simulation.dto;

import java.util.List;
import java.util.UUID;

public record PowerFlowResultResponse(
        boolean converged,
        int iterations,
        Summary summary,
        List<BusResult> busResults,
        List<BranchResult> branchResults,
        Violations violations,
        List<String> warnings
) {
    public record Summary(
            double totalLoadMw,
            double totalGenerationMw,
            double lossesMw
    ) {
    }

    public record BusResult(
            UUID busId,
            String busName,
            double voltageMagnitudePu,
            double voltageAngleDeg
    ) {
    }

    public record BranchResult(
            UUID elementId,
            String elementType,
            String name,
            double loadingPercent,
            double pFromMw,
            double qFromMvar,
            double pToMw,
            double qToMvar
    ) {
    }

    public record Violations(
            List<VoltageViolation> voltage,
            List<ThermalViolation> thermal
    ) {
    }

    public record VoltageViolation(
            UUID busId,
            String busName,
            double valuePu,
            double minPu,
            double maxPu
    ) {
    }

    public record ThermalViolation(
            UUID elementId,
            String elementType,
            String name,
            double loadingPercent,
            double maxPercent
    ) {
    }
}
