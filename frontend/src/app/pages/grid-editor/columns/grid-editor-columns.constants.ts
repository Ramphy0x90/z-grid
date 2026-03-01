import type { PaneId, TableColumn } from './grid-editor-columns.types';

const GRID_EDITOR_COLUMNS_BY_PANE: Record<PaneId, readonly TableColumn[]> = {
	buses: [
		{ key: 'name', label: 'Name' },
		{ key: 'nominalVoltageKv', label: 'Nominal kV' },
		{ key: 'busType', label: 'Type' },
		{ key: 'voltageMagnitudePu', label: 'Voltage p.u.' },
		{ key: 'inService', label: 'In Service' },
	],
	lines: [
		{ key: 'name', label: 'Name' },
		{ key: 'fromBusId', label: 'From Bus' },
		{ key: 'toBusId', label: 'To Bus' },
		{ key: 'ratingMva', label: 'Rating MVA' },
		{ key: 'inService', label: 'In Service' },
	],
	transformers: [
		{ key: 'name', label: 'Name' },
		{ key: 'fromBusId', label: 'From Bus' },
		{ key: 'toBusId', label: 'To Bus' },
		{ key: 'ratingMva', label: 'Rating MVA' },
		{ key: 'tapRatio', label: 'Tap Ratio' },
		{ key: 'inService', label: 'In Service' },
	],
	loads: [
		{ key: 'name', label: 'Name' },
		{ key: 'busId', label: 'Bus' },
		{ key: 'activePowerMw', label: 'P MW' },
		{ key: 'reactivePowerMvar', label: 'Q MVAR' },
		{ key: 'inService', label: 'In Service' },
	],
	generators: [
		{ key: 'name', label: 'Name' },
		{ key: 'busId', label: 'Bus' },
		{ key: 'activePowerMw', label: 'P MW' },
		{ key: 'reactivePowerMvar', label: 'Q MVAR' },
		{ key: 'voltagePu', label: 'Voltage p.u.' },
		{ key: 'inService', label: 'In Service' },
	],
	shuntCompensators: [
		{ key: 'name', label: 'Name' },
		{ key: 'busId', label: 'Bus' },
		{ key: 'shuntType', label: 'Type' },
		{ key: 'qMvar', label: 'Q MVAR' },
		{ key: 'currentStep', label: 'Step' },
		{ key: 'inService', label: 'In Service' },
	],
};

export const getColumnsForPane = (paneId: PaneId): readonly TableColumn[] =>
	GRID_EDITOR_COLUMNS_BY_PANE[paneId];
