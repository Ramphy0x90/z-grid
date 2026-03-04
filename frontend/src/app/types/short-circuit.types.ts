export type ShortCircuitFaultType = '3PH' | 'SLG' | 'LL' | 'DLG';

export type ShortCircuitRunOptions = {
	faultTypes?: ShortCircuitFaultType[];
	faultResistancePu?: number;
	faultReactancePu?: number;
	voltageFactor?: number;
	targetBusIds?: string[];
};

export type ShortCircuitFaultMetrics = {
	ikssKa: number;
	skssMva: number;
};

export type ShortCircuitBusResult = {
	busId: string;
	busName: string;
	nominalVoltageKv: number;
	faults: Partial<Record<ShortCircuitFaultType, ShortCircuitFaultMetrics>>;
	maxIkssKa: number;
};

export type ShortCircuitResult = {
	faultTypes: ShortCircuitFaultType[];
	voltageFactor: number;
	faultImpedancePu: {
		r: number;
		x: number;
	};
	busResults: ShortCircuitBusResult[];
	warnings: string[];
};

export type ShortCircuitRunStatus = {
	runId: string;
	gridId: string;
	status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
	solver: string;
	errorMessage: string | null;
	createdAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	result: ShortCircuitResult | null;
};

export type StartShortCircuitRunResponse = {
	runId: string;
	status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
	reusedExisting: boolean;
	createdAt: string;
};
