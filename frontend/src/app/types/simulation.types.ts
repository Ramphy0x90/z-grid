export type SimulationType = 'POWER_FLOW' | 'HOSTING_CAPACITY' | 'SHORT_CIRCUIT' | 'POWER_QUALITY';

export type SimulationRunStatusValue = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type StartSimulationRunRequest = {
  simulationType: SimulationType;
  engineKey?: string;
  options?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type StartSimulationRunResponse = {
  runId: string;
  simulationType: SimulationType;
  engineKey: string;
  status: SimulationRunStatusValue;
  reusedExisting: boolean;
  createdAt: string;
};

export type SimulationRunResultPayload = {
  simulationType: SimulationType;
  summary: Record<string, unknown>;
  data: Record<string, unknown>;
};

export type SimulationRunStatus = {
  runId: string;
  gridId: string;
  simulationType: SimulationType;
  engineKey: string;
  engineVersion: string | null;
  status: SimulationRunStatusValue;
  failureCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  queueWaitMs: number;
  runDurationMs: number | null;
  result: SimulationRunResultPayload | null;
};
