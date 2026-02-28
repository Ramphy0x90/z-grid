package com.r16a.zeus.features.engine.powerflow;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AcNewtonRaphsonSolverTest {

    @Test
    void solvesSimpleTwoBusCase() {
        UUID slackId = UUID.randomUUID();
        UUID loadId = UUID.randomUUID();
        UUID lineId = UUID.randomUUID();

        AcPowerFlowInput input = new AcPowerFlowInput(
                100.0,
                List.of(
                        new AcPowerFlowInput.BusNode(
                                slackId,
                                "Slack",
                                AcPowerFlowInput.BusCategory.SLACK,
                                1.0,
                                0.0,
                                1.0,
                                1.0,
                                0.0,
                                0.95,
                                1.05
                        ),
                        new AcPowerFlowInput.BusNode(
                                loadId,
                                "LoadBus",
                                AcPowerFlowInput.BusCategory.PQ,
                                1.0,
                                0.0,
                                1.0,
                                -1.0,
                                -0.2,
                                0.90,
                                1.10
                        )
                ),
                List.of(
                        new AcPowerFlowInput.BranchEdge(
                                lineId,
                                "LINE",
                                "Line 1-2",
                                0,
                                1,
                                0.02,
                                0.06,
                                0.0,
                                1.0,
                                0.0,
                                120.0,
                                100.0
                        )
                ),
                1
        );

        AcNewtonRaphsonSolver solver = new AcNewtonRaphsonSolver();
        AcPowerFlowResult result = solver.solve(input, new AcPowerFlowOptions(40, 1e-6));

        assertTrue(result.converged());
        assertTrue(result.iterations() > 0);
        assertEquals(2, result.busStates().size());
        assertEquals(1, result.branchFlows().size());
    }
}
