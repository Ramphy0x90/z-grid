export type HostingCapacityConstraintType =
	| 'VOLTAGE_UPPER'
	| 'VOLTAGE_LOWER'
	| 'VOLTAGE_RISE'
	| 'THERMAL_LINE'
	| 'THERMAL_TRANSFORMER'
	| 'SHORT_CIRCUIT'
	| 'POWER_QUALITY'
	| 'NONE';

export type HostingCapacityRunOptions = {
	country?: 'ES' | 'CH' | 'DE' | 'FR' | 'IT' | 'GB';
	candidateBusIds?: string[];
	dgPowerFactor?: number;
	dgType?: 'PV' | 'WIND' | 'BATTERY' | 'GENERIC';
	searchToleranceKw?: number;
	maxDgKw?: number;
	checkThermal?: boolean;
	checkVoltage?: boolean;
	checkVoltageRise?: boolean;
	checkShortCircuit?: boolean;
	checkPowerQuality?: boolean;
};

export type HostingCapacityBusResult = {
	busId: string;
	hcKw: number;
	bindingConstraint: HostingCapacityConstraintType;
	voltageAtHcPu: number;
	voltageRiseAtHcPu: number;
	maxBranchLoadingPct: number;
	maxBranchId: string;
	transformerLoadingPct: number;
	sscSnRatio: number | null;
	allConstraints: Partial<Record<HostingCapacityConstraintType, number>>;
};

export type HostingCapacityResult = {
	country: string;
	constraintsApplied: {
		voltageBandPu: [number, number] | number[];
		voltageRiseLimitLvPu: number;
		voltageRiseLimitMvPu: number;
		thermalOverloadFactor: number;
		minSscSnRatio: number;
	};
	config: {
		dgPowerFactor: number;
		dgType: 'PV' | 'WIND' | 'BATTERY' | 'GENERIC';
		searchToleranceKw: number;
		maxDgKw: number;
		checkThermal: boolean;
		checkVoltage: boolean;
		checkVoltageRise: boolean;
		checkShortCircuit: boolean;
		checkPowerQuality: boolean;
	};
	busResults: HostingCapacityBusResult[];
	warnings: string[];
};

export type HostingCapacityRunStatus = {
	runId: string;
	gridId: string;
	status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
	solver: string;
	errorMessage: string | null;
	createdAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	result: HostingCapacityResult | null;
};

export type StartHostingCapacityRunResponse = {
	runId: string;
	status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
	reusedExisting: boolean;
	createdAt: string;
};
