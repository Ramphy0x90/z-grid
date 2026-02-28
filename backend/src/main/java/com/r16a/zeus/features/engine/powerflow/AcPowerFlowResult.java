package com.r16a.zeus.features.engine.powerflow;

import java.util.List;
import java.util.UUID;

public record AcPowerFlowResult(
        boolean converged,
        int iterations,
        Summary summary,
        List<BusState> busStates,
        List<BranchFlow> branchFlows,
        List<VoltageViolation> voltageViolations,
        List<ThermalViolation> thermalViolations,
        List<String> warnings
) {
    public record Summary(
            double totalLoadMw,
            double totalGenerationMw,
            double lossesMw
    ) {
    }

    public record BusState(
            UUID busId,
            String busName,
            double voltageMagnitudePu,
            double voltageAngleDeg
    ) {
    }

    public record BranchFlow(
            UUID elementId,
            String elementType,
            String name,
            double loadingPercent,
            double pFromMw,
            double qFromMvar,
            double pToMw,
            double qToMvar,
            double maxLoadingPercent
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
