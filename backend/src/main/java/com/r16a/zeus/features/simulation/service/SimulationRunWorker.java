package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.simulation.application.SimulationExecutionRequest;
import com.r16a.zeus.features.simulation.application.SimulationExecutionResult;
import com.r16a.zeus.features.simulation.application.SimulationExecutor;
import com.r16a.zeus.features.simulation.application.SimulationFacade;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.features.simulation.model.SimulationRun;
import com.r16a.zeus.features.simulation.model.SimulationRunStatus;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SimulationRunWorker {
    private static final Logger log = LoggerFactory.getLogger(SimulationRunWorker.class);

    private final SimulationFacade simulationFacade;

    @Async("simulationTaskExecutor")
    public void executeRun(UUID runId) {
        SimulationRun run = simulationFacade.getRunById(runId);
        if (run.getStatus() != SimulationRunStatus.QUEUED && run.getStatus() != SimulationRunStatus.RUNNING) {
            return;
        }

        simulationFacade.markRunAsRunning(runId);
        Instant started = Instant.now();
        long queueWaitMs = run.getCreatedAt() == null ? 0L : Math.max(0L, Duration.between(run.getCreatedAt(), started).toMillis());
        log.info(
                "simulation.run.started runId={} type={} engine={} queueWaitMs={}",
                runId,
                run.getSimulationType(),
                run.getEngineKey(),
                queueWaitMs
        );

        try {
            SimulationExecutor executor = simulationFacade.resolveExecutor(run.getSimulationType());
            SimulationExecutionResult executionResult = executor.execute(
                    new SimulationExecutionRequest(
                            runId,
                            run.getGridId(),
                            run.getSimulationType(),
                            run.getEngineKey(),
                            run.getOptionsJson()
                    )
            );
            simulationFacade.markRunAsSucceeded(runId, executionResult);
            long runDurationMs = Math.max(0L, Duration.between(started, Instant.now()).toMillis());
            log.info(
                    "simulation.run.succeeded runId={} type={} engine={} runDurationMs={}",
                    runId,
                    run.getSimulationType(),
                    run.getEngineKey(),
                    runDurationMs
            );
        } catch (SimulationExecutionException ex) {
            simulationFacade.markRunAsFailed(runId, ex.getFailureCode(), ex.getMessage());
            log.warn(
                    "simulation.run.failed runId={} type={} engine={} failureCode={} message={}",
                    runId,
                    run.getSimulationType(),
                    run.getEngineKey(),
                    ex.getFailureCode(),
                    ex.getMessage()
            );
        } catch (Exception ex) {
            simulationFacade.markRunAsFailed(runId, SimulationFailureCode.SYSTEM_ERROR, ex.getMessage());
            log.error(
                    "simulation.run.failed runId={} type={} engine={} failureCode={} message={}",
                    runId,
                    run.getSimulationType(),
                    run.getEngineKey(),
                    SimulationFailureCode.SYSTEM_ERROR,
                    ex.getMessage(),
                    ex
            );
        }
    }
}
