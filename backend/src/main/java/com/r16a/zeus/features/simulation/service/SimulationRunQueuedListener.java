package com.r16a.zeus.features.simulation.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class SimulationRunQueuedListener {
    private final SimulationRunWorker simulationRunWorker;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRunQueued(SimulationRunQueuedEvent event) {
        simulationRunWorker.executeRun(event.runId());
    }
}
