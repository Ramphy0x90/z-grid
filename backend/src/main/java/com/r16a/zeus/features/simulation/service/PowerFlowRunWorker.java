package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.engine.powerflow.AcNewtonRaphsonSolver;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowInput;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowInputBuilder;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowOptions;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowResult;
import com.r16a.zeus.features.grid.service.GridService;
import com.r16a.zeus.features.simulation.dto.PowerFlowResultResponse;
import com.r16a.zeus.features.simulation.dto.PowerFlowRunOptions;
import com.r16a.zeus.features.simulation.model.PowerFlowResult;
import com.r16a.zeus.features.simulation.model.SimulationRun;
import com.r16a.zeus.features.simulation.model.SimulationRunStatus;
import com.r16a.zeus.features.simulation.repository.PowerFlowResultRepository;
import com.r16a.zeus.features.simulation.repository.SimulationRunRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PowerFlowRunWorker {
    private final SimulationRunRepository simulationRunRepository;
    private final PowerFlowResultRepository powerFlowResultRepository;
    private final GridService gridService;
    private final AcPowerFlowInputBuilder inputBuilder;
    private final AcNewtonRaphsonSolver solver;
    private final PowerFlowResponseMapper responseMapper;
    private final ObjectMapper objectMapper;

    @Async("simulationTaskExecutor")
    public void executeRun(UUID runId) {
        SimulationRun run = simulationRunRepository.findById(runId).orElse(null);
        if (run == null) {
            return;
        }
        if (run.getStatus() == SimulationRunStatus.QUEUED) {
            run.setStatus(SimulationRunStatus.RUNNING);
            run.setStartedAt(Instant.now());
            run.setErrorMessage(null);
            run = simulationRunRepository.save(run);
        }
        try {
            JsonNode dataset = gridService.getGridDataset(run.getGridId());
            AcPowerFlowInput input = inputBuilder.build(dataset);
            PowerFlowRunOptions parsedOptions = parseOptions(run.getOptionsJson());
            AcPowerFlowOptions options = new AcPowerFlowOptions(
                    parsedOptions.maxIterations(),
                    parsedOptions.tolerance()
            );
            AcPowerFlowResult engineResult = solver.solve(input, options);
            PowerFlowResultResponse response = responseMapper.fromEngineResult(engineResult);
            run.setStatus(SimulationRunStatus.SUCCEEDED);
            run.setFinishedAt(Instant.now());
            run.setErrorMessage(null);
            simulationRunRepository.save(run);

            powerFlowResultRepository.save(
                    PowerFlowResult.builder()
                            .runId(runId)
                            .converged(response.converged())
                            .iterations(response.iterations())
                            .totalLoadMw(response.summary().totalLoadMw())
                            .totalGenerationMw(response.summary().totalGenerationMw())
                            .lossesMw(response.summary().lossesMw())
                            .resultJson(serializeResult(response))
                            .forceInsert(true)
                            .build()
            );
        } catch (Exception ex) {
            run.setStatus(SimulationRunStatus.FAILED);
            run.setFinishedAt(Instant.now());
            run.setErrorMessage(ex.getMessage());
            simulationRunRepository.save(run);
        }
    }

    private PowerFlowRunOptions parseOptions(String optionsJson) {
        if (optionsJson == null || optionsJson.isBlank()) {
            return defaults();
        }
        try {
            PowerFlowRunOptions parsed = objectMapper.readValue(optionsJson, PowerFlowRunOptions.class);
            return normalizeOptions(parsed);
        } catch (Exception ex) {
            return defaults();
        }
    }

    private PowerFlowRunOptions normalizeOptions(PowerFlowRunOptions options) {
        int maxIterations = options == null || options.maxIterations() == null
                ? 30
                : Math.max(5, Math.min(200, options.maxIterations()));
        double tolerance = options == null || options.tolerance() == null
                ? 1e-6
                : Math.max(1e-10, Math.min(1e-2, options.tolerance()));
        return new PowerFlowRunOptions(maxIterations, tolerance);
    }

    private PowerFlowRunOptions defaults() {
        return new PowerFlowRunOptions(30, 1e-6);
    }

    private String serializeResult(PowerFlowResultResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to serialize power flow result.", ex);
        }
    }
}
