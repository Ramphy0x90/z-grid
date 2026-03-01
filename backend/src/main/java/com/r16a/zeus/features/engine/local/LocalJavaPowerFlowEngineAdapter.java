package com.r16a.zeus.features.engine.local;

import com.r16a.zeus.features.engine.EngineExecutionRequest;
import com.r16a.zeus.features.engine.EngineExecutionResult;
import com.r16a.zeus.features.engine.EngineFacade;
import com.r16a.zeus.features.engine.powerflow.AcNewtonRaphsonSolver;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowInput;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowInputBuilder;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowOptions;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowResult;
import com.r16a.zeus.features.simulation.model.SimulationType;
import com.r16a.zeus.features.simulation.service.PowerFlowResponseMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class LocalJavaPowerFlowEngineAdapter implements EngineFacade {
    public static final String ENGINE_KEY = "local-java-ac-newton-raphson";

    private final AcPowerFlowInputBuilder inputBuilder;
    private final AcNewtonRaphsonSolver solver;
    private final PowerFlowResponseMapper responseMapper;
    private final ObjectMapper objectMapper;

    @Override
    public SimulationType simulationType() {
        return SimulationType.POWER_FLOW;
    }

    @Override
    public String engineKey() {
        return ENGINE_KEY;
    }

    @Override
    public String engineVersion() {
        return "v1";
    }

    @Override
    public EngineExecutionResult execute(EngineExecutionRequest request) {
        AcPowerFlowInput input = inputBuilder.build(request.gridDataset());
        JsonNode optionsNode = request.options();
        int maxIterations = clampInt(optionsNode, "maxIterations", 30, 5, 200);
        double tolerance = clampDouble(optionsNode, "tolerance", 1e-6, 1e-10, 1e-2);
        AcPowerFlowOptions options = new AcPowerFlowOptions(maxIterations, tolerance);
        AcPowerFlowResult engineResult = solver.solve(input, options);
        var response = responseMapper.fromEngineResult(engineResult);
        JsonNode summary = objectMapper.valueToTree(response.summary());
        JsonNode data = objectMapper.valueToTree(response);
        return new EngineExecutionResult(summary, data);
    }

    private int clampInt(JsonNode node, String field, int fallback, int min, int max) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return fallback;
        }
        int value = node.get(field).asInt(fallback);
        return Math.max(min, Math.min(max, value));
    }

    private double clampDouble(JsonNode node, String field, double fallback, double min, double max) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return fallback;
        }
        double value = node.get(field).asDouble(fallback);
        return Math.max(min, Math.min(max, value));
    }
}
