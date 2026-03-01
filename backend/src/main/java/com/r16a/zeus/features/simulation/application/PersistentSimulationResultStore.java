package com.r16a.zeus.features.simulation.application;

import com.r16a.zeus.features.simulation.model.SimulationRunResult;
import com.r16a.zeus.features.simulation.model.SimulationType;
import com.r16a.zeus.features.simulation.repository.SimulationRunResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PersistentSimulationResultStore implements SimulationResultStore {
    private final SimulationRunResultRepository simulationRunResultRepository;
    private final ObjectMapper objectMapper;

    @Override
    public void save(UUID runId, SimulationType simulationType, SimulationExecutionResult result) {
        simulationRunResultRepository.save(
                SimulationRunResult.builder()
                        .runId(runId)
                        .simulationType(simulationType)
                        .summaryJson(writeJson(result.summary()))
                        .resultJson(writeJson(result.result()))
                        .forceInsert(true)
                        .build()
        );
    }

    @Override
    public Optional<SimulationRunResult> findByRunId(UUID runId) {
        return simulationRunResultRepository.findByRunId(runId);
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to serialize simulation result payload.", ex);
        }
    }
}
