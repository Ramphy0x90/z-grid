export type PowerQualityCountry = 'ES' | 'CH' | 'DE' | 'FR' | 'IT' | 'GB';
export type PowerQualityDgType = 'PV' | 'WIND' | 'BATTERY' | 'GENERIC';
export type PowerQualityLimitingMetric = 'THD' | 'FLICKER' | 'UNBALANCE' | 'NONE';

export type PowerQualityRunOptions = {
	country?: PowerQualityCountry;
	dgKw?: number;
	dgType?: PowerQualityDgType;
	dgPowerFactor?: number;
	targetBusIds?: string[];
};

export type PowerQualityBusResult = {
	busId: string;
	thdPct: number;
	flickerPlt: number;
	voltageUnbalancePct: number;
	sscSnRatio: number | null;
	passes: boolean;
	failedMetrics: ('THD' | 'FLICKER' | 'UNBALANCE')[];
	limitingMetric: PowerQualityLimitingMetric;
};

export type PowerQualityResult = {
	country: PowerQualityCountry;
	constraintsApplied: {
		thdLimitPct: number;
		flickerPltLimit: number;
		voltageUnbalanceLimitPct: number;
	};
	config: {
		dgKw: number;
		dgType: PowerQualityDgType;
		dgPowerFactor: number;
	};
	busResults: PowerQualityBusResult[];
	warnings: string[];
};

export type PowerQualityRunStatus = {
	runId: string;
	gridId: string;
	status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
	solver: string;
	errorMessage: string | null;
	createdAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	result: PowerQualityResult | null;
};

export type StartPowerQualityRunResponse = {
	runId: string;
	status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
	reusedExisting: boolean;
	createdAt: string;
};
