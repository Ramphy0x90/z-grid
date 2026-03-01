export type PowerFlowRunOptions = {
	maxIterations?: number;
	tolerance?: number;
};

export type PowerFlowSummary = {
	totalLoadMw: number;
	totalGenerationMw: number;
	lossesMw: number;
};

export type PowerFlowBusResult = {
	busId: string;
	busName: string;
	voltageMagnitudePu: number;
	voltageAngleDeg: number;
};

export type PowerFlowBranchResult = {
	elementId: string;
	elementType: string;
	name: string;
	loadingPercent: number;
	pFromMw: number;
	qFromMvar: number;
	pToMw: number;
	qToMvar: number;
};

export type PowerFlowVoltageViolation = {
	busId: string;
	busName: string;
	valuePu: number;
	minPu: number;
	maxPu: number;
};

export type PowerFlowThermalViolation = {
	elementId: string;
	elementType: string;
	name: string;
	loadingPercent: number;
	maxPercent: number;
};

export type PowerFlowResult = {
	converged: boolean;
	iterations: number;
	summary: PowerFlowSummary;
	busResults: PowerFlowBusResult[];
	branchResults: PowerFlowBranchResult[];
	violations: {
		voltage: PowerFlowVoltageViolation[];
		thermal: PowerFlowThermalViolation[];
	};
	warnings: string[];
};

export type PowerFlowRunStatus = {
	runId: string;
	gridId: string;
	status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
	solver: string;
	errorMessage: string | null;
	createdAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	result: PowerFlowResult | null;
};

export type StartPowerFlowRunResponse = {
	runId: string;
	status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
	reusedExisting: boolean;
	createdAt: string;
};
