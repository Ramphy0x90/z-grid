package com.r16a.zeus.features.simulation.service;

import com.r16a.zeus.features.simulation.dto.PowerFlowResultResponse;
import com.r16a.zeus.features.simulation.dto.PowerFlowRunOptions;
import com.r16a.zeus.features.simulation.dto.PowerFlowRunStatusResponse;
import com.r16a.zeus.features.simulation.dto.StartPowerFlowRunRequest;
import com.r16a.zeus.features.simulation.dto.StartPowerFlowRunResponse;
import com.r16a.zeus.features.simulation.exception.SimulationRunNotFoundException;
import com.r16a.zeus.features.simulation.model.PowerFlowResult;
import com.r16a.zeus.features.simulation.model.SimulationRun;
import com.r16a.zeus.features.simulation.model.SimulationRunStatus;
import com.r16a.zeus.features.simulation.repository.PowerFlowResultRepository;
import com.r16a.zeus.features.simulation.repository.SimulationRunRepository;
import com.r16a.zeus.features.grid.service.GridService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PowerFlowSimulationService {
    public static final String SOLVER_NAME = "AC_NEWTON_RAPHSON";
    private static final Duration STALE_QUEUED_TIMEOUT = Duration.ofMinutes(2);
    private static final String STALE_QUEUED_MESSAGE =
            "Run stayed queued for too long and was automatically failed. Please retry.";
    private static final Set<SimulationRunStatus> ACTIVE_STATUSES = EnumSet.of(
            SimulationRunStatus.QUEUED,
            SimulationRunStatus.RUNNING
    );

    private final SimulationRunRepository simulationRunRepository;
    private final PowerFlowResultRepository powerFlowResultRepository;
    private final GridService gridService;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    @Transactional
    public StartPowerFlowRunResponse startRun(UUID gridId, StartPowerFlowRunRequest request) {
        gridService.getGridByIdOrThrow(gridId);

        SimulationRun existing = simulationRunRepository
                .findFirstByGridIdAndStatusInOrderByCreatedAtDesc(gridId, ACTIVE_STATUSES)
                .orElse(null);
        if (isStaleQueued(existing)) {
            existing = failStaleQueuedRun(existing);
            existing = null;
        }
        if (existing != null) {
            return new StartPowerFlowRunResponse(
                    existing.getId(),
                    existing.getStatus(),
                    true,
                    existing.getCreatedAt()
            );
        }

        PowerFlowRunOptions normalizedOptions = normalizeOptions(request == null ? null : request.options());
        SimulationRun created = simulationRunRepository.save(
                SimulationRun.newRun(gridId, SOLVER_NAME, serializeOptions(normalizedOptions))
        );
        eventPublisher.publishEvent(new PowerFlowRunQueuedEvent(created.getId()));
        return new StartPowerFlowRunResponse(created.getId(), created.getStatus(), false, created.getCreatedAt());
    }

    @Transactional
    public PowerFlowRunStatusResponse getRun(UUID gridId, UUID runId) {
        gridService.getGridByIdOrThrow(gridId);
        SimulationRun run = simulationRunRepository.findById(runId)
                .map(this::failStaleQueuedRun)
                .orElse(null);
        if (run != null && gridId.equals(run.getGridId())) {
            return toStatusResponse(run);
        }

        // Fallback protects frontend polling from stale run ids and short consistency windows.
        SimulationRun latestForGrid = simulationRunRepository.findTop20ByGridIdOrderByCreatedAtDesc(gridId)
                .stream()
                .map(this::failStaleQueuedRun)
                .findFirst()
                .orElse(null);
        if (latestForGrid != null) {
            return toStatusResponse(latestForGrid);
        }

        // Return a non-404 placeholder when a specific run has not been observed yet.
        return new PowerFlowRunStatusResponse(
                runId,
                gridId,
                SimulationRunStatus.FAILED,
                SOLVER_NAME,
                "Simulation run not found: " + runId,
                null,
                null,
                null,
                null
        );
    }

    @Transactional
    public List<PowerFlowRunStatusResponse> listRuns(UUID gridId) {
        gridService.getGridByIdOrThrow(gridId);
        return simulationRunRepository.findTop20ByGridIdOrderByCreatedAtDesc(gridId)
                .stream()
                .map(this::failStaleQueuedRun)
                .map(this::toStatusResponse)
                .toList();
    }

    public PowerFlowRunOptions parseOptions(String optionsJson) {
        if (optionsJson == null || optionsJson.isBlank()) {
            return normalizeOptions(null);
        }
        try {
            PowerFlowRunOptions parsed = objectMapper.readValue(optionsJson, PowerFlowRunOptions.class);
            return normalizeOptions(parsed);
        } catch (Exception ex) {
            return normalizeOptions(null);
        }
    }

    @Transactional
    public SimulationRun markRunAsRunning(UUID runId) {
        SimulationRun run = simulationRunRepository.findById(runId)
                .orElseThrow(() -> new SimulationRunNotFoundException("Simulation run not found: " + runId));
        if (run.getStatus() != SimulationRunStatus.QUEUED) {
            return run;
        }
        run.setStatus(SimulationRunStatus.RUNNING);
        run.setStartedAt(Instant.now());
        run.setErrorMessage(null);
        return simulationRunRepository.save(run);
    }

    @Transactional
    public void markRunAsSucceeded(UUID runId, PowerFlowResult result) {
        SimulationRun run = simulationRunRepository.findById(runId)
                .orElseThrow(() -> new SimulationRunNotFoundException("Simulation run not found: " + runId));
        run.setStatus(SimulationRunStatus.SUCCEEDED);
        run.setFinishedAt(Instant.now());
        run.setErrorMessage(null);
        simulationRunRepository.save(run);
        powerFlowResultRepository.save(result);
    }

    @Transactional
    public void markRunAsFailed(UUID runId, String message) {
        SimulationRun run = simulationRunRepository.findById(runId)
                .orElseThrow(() -> new SimulationRunNotFoundException("Simulation run not found: " + runId));
        run.setStatus(SimulationRunStatus.FAILED);
        run.setFinishedAt(Instant.now());
        run.setErrorMessage(message);
        simulationRunRepository.save(run);
    }

    public SimulationRun getRunById(UUID runId) {
        return simulationRunRepository.findById(runId)
                .orElseThrow(() -> new SimulationRunNotFoundException("Simulation run not found: " + runId));
    }

    public PowerFlowRunStatusResponse toStatusResponse(SimulationRun run) {
        PowerFlowResultResponse result = null;
        if (run.getStatus() == SimulationRunStatus.SUCCEEDED) {
            result = powerFlowResultRepository.findByRunId(run.getId())
                    .map(this::deserializeResult)
                    .orElse(null);
        }
        return new PowerFlowRunStatusResponse(
                run.getId(),
                run.getGridId(),
                run.getStatus(),
                run.getSolver(),
                run.getErrorMessage(),
                run.getCreatedAt(),
                run.getStartedAt(),
                run.getFinishedAt(),
                result
        );
    }

    public String serializeResult(PowerFlowResultResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to serialize power flow result.", ex);
        }
    }

    private PowerFlowResultResponse deserializeResult(PowerFlowResult result) {
        try {
            return objectMapper.readValue(result.getResultJson(), PowerFlowResultResponse.class);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to deserialize power flow result.", ex);
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

    private String serializeOptions(PowerFlowRunOptions options) {
        try {
            return objectMapper.writeValueAsString(options);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to serialize power flow options.", ex);
        }
    }

    private boolean isStaleQueued(SimulationRun run) {
        if (run == null || run.getStatus() != SimulationRunStatus.QUEUED || run.getStartedAt() != null) {
            return false;
        }
        Instant createdAt = run.getCreatedAt();
        if (createdAt == null) {
            return false;
        }
        return createdAt.isBefore(Instant.now().minus(STALE_QUEUED_TIMEOUT));
    }

    private SimulationRun failStaleQueuedRun(SimulationRun run) {
        if (!isStaleQueued(run)) {
            return run;
        }
        run.setStatus(SimulationRunStatus.FAILED);
        run.setFinishedAt(Instant.now());
        run.setErrorMessage(STALE_QUEUED_MESSAGE);
        return simulationRunRepository.save(run);
    }
}
