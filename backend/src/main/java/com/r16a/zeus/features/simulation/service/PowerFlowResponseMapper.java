package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.engine.powerflow.AcPowerFlowResult;
import com.r16a.zeus.features.simulation.dto.PowerFlowResultResponse;
import org.springframework.stereotype.Component;

@Component
public class PowerFlowResponseMapper {

    public PowerFlowResultResponse fromEngineResult(AcPowerFlowResult result) {
        return new PowerFlowResultResponse(
                result.converged(),
                result.iterations(),
                new PowerFlowResultResponse.Summary(
                        result.summary().totalLoadMw(),
                        result.summary().totalGenerationMw(),
                        result.summary().lossesMw()
                ),
                result.busStates().stream()
                        .map((bus) -> new PowerFlowResultResponse.BusResult(
                                bus.busId(),
                                bus.busName(),
                                bus.voltageMagnitudePu(),
                                bus.voltageAngleDeg()
                        ))
                        .toList(),
                result.branchFlows().stream()
                        .map((flow) -> new PowerFlowResultResponse.BranchResult(
                                flow.elementId(),
                                flow.elementType(),
                                flow.name(),
                                flow.loadingPercent(),
                                flow.pFromMw(),
                                flow.qFromMvar(),
                                flow.pToMw(),
                                flow.qToMvar()
                        ))
                        .toList(),
                new PowerFlowResultResponse.Violations(
                        result.voltageViolations().stream()
                                .map((violation) -> new PowerFlowResultResponse.VoltageViolation(
                                        violation.busId(),
                                        violation.busName(),
                                        violation.valuePu(),
                                        violation.minPu(),
                                        violation.maxPu()
                                ))
                                .toList(),
                        result.thermalViolations().stream()
                                .map((violation) -> new PowerFlowResultResponse.ThermalViolation(
                                        violation.elementId(),
                                        violation.elementType(),
                                        violation.name(),
                                        violation.loadingPercent(),
                                        violation.maxPercent()
                                ))
                                .toList()
                ),
                result.warnings()
        );
    }
}
