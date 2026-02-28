package com.r16a.zeus.features.engine.powerflow;

import java.util.List;
import java.util.UUID;

public record AcPowerFlowInput(
        double baseMva,
        List<BusNode> buses,
        List<BranchEdge> branches,
        int slackBusCount
) {
    public record BusNode(
            UUID busId,
            String busName,
            BusCategory busType,
            double voltageMagnitudeInitPu,
            double voltageAngleInitDeg,
            double voltageSetpointPu,
            double pSpecPu,
            double qSpecPu,
            double minVoltagePu,
            double maxVoltagePu
    ) {
    }

    public record BranchEdge(
            UUID elementId,
            String elementType,
            String name,
            int fromIndex,
            int toIndex,
            double resistancePu,
            double reactancePu,
            double shuntSusceptancePu,
            double tapRatio,
            double phaseShiftDeg,
            double ratingMva,
            double maxLoadingPercent
    ) {
    }

    public enum BusCategory {
        SLACK,
        PV,
        PQ
    }
}
