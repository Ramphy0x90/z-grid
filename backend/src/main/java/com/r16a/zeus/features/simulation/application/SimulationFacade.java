package com.r16a.zeus.features.simulation.application;

import com.r16a.zeus.features.grid.service.GridService;
import com.r16a.zeus.features.simulation.dto.SimulationRunResultResponse;
import com.r16a.zeus.features.simulation.dto.SimulationRunStatusResponse;
import com.r16a.zeus.features.simulation.dto.StartSimulationRunRequest;
import com.r16a.zeus.features.simulation.dto.StartSimulationRunResponse;
import com.r16a.zeus.features.simulation.exception.SimulationRunNotFoundException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.features.simulation.model.SimulationRun;
import com.r16a.zeus.features.simulation.model.SimulationRunStatus;
import com.r16a.zeus.features.simulation.model.SimulationRunResult;
import com.r16a.zeus.features.simulation.model.SimulationType;
import com.r16a.zeus.features.simulation.service.SimulationRunQueuedEvent;
import com.r16a.zeus.features.simulation.repository.SimulationRunRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SimulationFacade {
    private static final Duration STALE_QUEUED_TIMEOUT = Duration.ofMinutes(2);
    private static final String STALE_QUEUED_MESSAGE =
            "Run stayed queued for too long and was automatically failed. Please retry.";
    private static final Set<SimulationRunStatus> ACTIVE_STATUSES = EnumSet.of(
            SimulationRunStatus.QUEUED,
            SimulationRunStatus.RUNNING
    );

    private final SimulationRunRepository simulationRunRepository;
    private final SimulationResultStore simulationResultStore;
    private final GridService gridService;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final List<SimulationExecutor> simulationExecutors;

    @Transactional
    public StartSimulationRunResponse startRun(UUID gridId, StartSimulationRunRequest request) {
        gridService.getGridByIdOrThrow(gridId);
        SimulationType simulationType = request == null || request.simulationType() == null
                ? SimulationType.POWER_FLOW
                : request.simulationType();
        SimulationExecutor executor = resolveExecutor(simulationType);
        String engineKey = request == null || request.engineKey() == null || request.engineKey().isBlank()
                ? executor.defaultEngineKey()
                : request.engineKey();
        String idempotencyKey = request == null ? null : normalizeBlank(request.idempotencyKey());

        if (idempotencyKey != null) {
            SimulationRun byKey = simulationRunRepository.findFirstByGridIdAndSimulationTypeAndIdempotencyKeyOrderByCreatedAtDesc(
                    gridId,
                    simulationType,
                    idempotencyKey
            ).map(this::failStaleQueuedRun).orElse(null);
            if (byKey != null) {
                return toStartResponse(byKey, true);
            }
        }

        SimulationRun existing = simulationRunRepository
                .findFirstByGridIdAndSimulationTypeAndStatusInOrderByCreatedAtDesc(gridId, simulationType, ACTIVE_STATUSES)
                .map(this::failStaleQueuedRun)
                .orElse(null);
        if (existing != null && ACTIVE_STATUSES.contains(existing.getStatus())) {
            return toStartResponse(existing, true);
        }

        SimulationRun created = simulationRunRepository.save(
                SimulationRun.newRun(
                        gridId,
                        simulationType,
                        engineKey,
                        "v1",
                        serializeOptions(request == null ? null : request.options()),
                        idempotencyKey
                )
        );
        eventPublisher.publishEvent(new SimulationRunQueuedEvent(created.getId(), simulationType, engineKey));
        return toStartResponse(created, false);
    }

    @Transactional
    public SimulationRunStatusResponse getRun(UUID gridId, UUID runId) {
        gridService.getGridByIdOrThrow(gridId);
        SimulationRun run = simulationRunRepository.findByIdAndGridId(runId, gridId)
                .map(this::failStaleQueuedRun)
                .orElseThrow(() -> new SimulationRunNotFoundException("Simulation run not found: " + runId));
        return toStatusResponse(run);
    }

    @Transactional
    public List<SimulationRunStatusResponse> listRuns(UUID gridId, SimulationType simulationType) {
        gridService.getGridByIdOrThrow(gridId);
        return simulationRunRepository.findTop20ByGridIdAndSimulationTypeOrderByCreatedAtDesc(gridId, simulationType)
                .stream()
                .map(this::failStaleQueuedRun)
                .map(this::toStatusResponse)
                .toList();
    }

    @Transactional
    public SimulationRun markRunAsRunning(UUID runId) {
        SimulationRun run = getRunById(runId);
        if (run.getStatus() != SimulationRunStatus.QUEUED) {
            return run;
        }
        run.setStatus(SimulationRunStatus.RUNNING);
        run.setStartedAt(Instant.now());
        run.setErrorMessage(null);
        run.setFailureCode(null);
        return simulationRunRepository.save(run);
    }

    @Transactional
    public void markRunAsSucceeded(UUID runId, SimulationExecutionResult result) {
        SimulationRun run = getRunById(runId);
        run.setStatus(SimulationRunStatus.SUCCEEDED);
        run.setFinishedAt(Instant.now());
        run.setErrorMessage(null);
        run.setFailureCode(null);
        simulationRunRepository.save(run);
        simulationResultStore.save(runId, run.getSimulationType(), result);
    }

    @Transactional
    public void markRunAsFailed(UUID runId, SimulationFailureCode failureCode, String message) {
        SimulationRun run = getRunById(runId);
        run.setStatus(SimulationRunStatus.FAILED);
        run.setFinishedAt(Instant.now());
        run.setFailureCode(failureCode);
        run.setErrorMessage(message);
        simulationRunRepository.save(run);
    }

    public SimulationRun getRunById(UUID runId) {
        return simulationRunRepository.findById(runId)
                .orElseThrow(() -> new SimulationRunNotFoundException("Simulation run not found: " + runId));
    }

    public SimulationExecutor resolveExecutor(SimulationType simulationType) {
        Map<SimulationType, SimulationExecutor> byType = simulationExecutors.stream()
                .collect(Collectors.toMap(SimulationExecutor::simulationType, Function.identity()));
        SimulationExecutor executor = byType.get(simulationType);
        if (executor == null) {
            throw new IllegalArgumentException("No executor registered for simulation type: " + simulationType);
        }
        return executor;
    }

    public SimulationRunStatusResponse toStatusResponse(SimulationRun run) {
        SimulationRunResultResponse result = null;
        if (run.getStatus() == SimulationRunStatus.SUCCEEDED) {
            result = simulationResultStore.findByRunId(run.getId())
                    .map(this::toResultResponse)
                    .orElse(null);
        }
        Instant now = Instant.now();
        Instant createdAt = run.getCreatedAt() == null ? now : run.getCreatedAt();
        long queueWaitMs = run.getStartedAt() == null
                ? Math.max(0L, Duration.between(createdAt, now).toMillis())
                : Math.max(0L, Duration.between(createdAt, run.getStartedAt()).toMillis());
        Long runDurationMs = run.getStartedAt() != null && run.getFinishedAt() != null
                ? Math.max(0L, Duration.between(run.getStartedAt(), run.getFinishedAt()).toMillis())
                : null;

        return new SimulationRunStatusResponse(
                run.getId(),
                run.getGridId(),
                run.getSimulationType(),
                run.getEngineKey(),
                run.getEngineVersion(),
                run.getStatus(),
                run.getFailureCode(),
                run.getErrorMessage(),
                run.getCreatedAt(),
                run.getStartedAt(),
                run.getFinishedAt(),
                queueWaitMs,
                runDurationMs,
                result
        );
    }

    private SimulationRunResultResponse toResultResponse(SimulationRunResult result) {
        return new SimulationRunResultResponse(
                result.getSimulationType(),
                deserializeJson(result.getSummaryJson()),
                deserializeJson(result.getResultJson())
        );
    }

    private JsonNode deserializeJson(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to deserialize simulation result payload.", ex);
        }
    }

    private String serializeOptions(JsonNode options) {
        try {
            return options == null ? null : objectMapper.writeValueAsString(options);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to serialize simulation options.", ex);
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
        run.setFailureCode(SimulationFailureCode.SYSTEM_ERROR);
        run.setFinishedAt(Instant.now());
        run.setErrorMessage(STALE_QUEUED_MESSAGE);
        return simulationRunRepository.save(run);
    }

    private StartSimulationRunResponse toStartResponse(SimulationRun run, boolean reusedExisting) {
        return new StartSimulationRunResponse(
                run.getId(),
                run.getSimulationType(),
                run.getEngineKey(),
                run.getStatus(),
                reusedExisting,
                run.getCreatedAt()
        );
    }

    private String normalizeBlank(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }
}
