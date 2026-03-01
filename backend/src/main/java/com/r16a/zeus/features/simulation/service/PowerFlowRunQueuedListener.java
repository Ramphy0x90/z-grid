package com.r16a.zeus.features.simulation.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class PowerFlowRunQueuedListener {
    private final PowerFlowRunWorker powerFlowRunWorker;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRunQueued(PowerFlowRunQueuedEvent event) {
        powerFlowRunWorker.executeRun(event.runId());
    }
}
