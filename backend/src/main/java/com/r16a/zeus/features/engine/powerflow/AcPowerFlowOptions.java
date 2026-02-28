package com.r16a.zeus.features.engine.powerflow;

public record AcPowerFlowOptions(
        int maxIterations,
        double tolerance
) {
    public static AcPowerFlowOptions defaults() {
        return new AcPowerFlowOptions(30, 1e-6);
    }
}
