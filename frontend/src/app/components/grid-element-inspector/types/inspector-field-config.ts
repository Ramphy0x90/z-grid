import type { FieldDescriptor, InspectorKind, SelectOption } from './inspector.types';

const BUS_TYPE_OPTIONS: readonly SelectOption[] = [
	{ value: 'PQ', label: 'PQ' },
	{ value: 'PV', label: 'PV' },
	{ value: 'SLACK', label: 'SLACK' },
];

const LOAD_TYPE_OPTIONS: readonly SelectOption[] = [
	{ value: 'PQ', label: 'PQ' },
	{ value: 'I', label: 'I' },
	{ value: 'Z', label: 'Z' },
];

const SHUNT_TYPE_OPTIONS: readonly SelectOption[] = [
	{ value: 'CAPACITOR', label: 'Capacitor' },
	{ value: 'REACTOR', label: 'Reactor' },
];

const TAP_SIDE_OPTIONS: readonly SelectOption[] = [
	{ value: 'HV', label: 'HV' },
	{ value: 'LV', label: 'LV' },
];

const WINDING_TYPE_OPTIONS: readonly SelectOption[] = [
	{ value: 'TWO_WINDING', label: 'Two winding' },
	{ value: 'THREE_WINDING', label: 'Three winding' },
];

const BUS_FIELDS: readonly FieldDescriptor[] = [
	{ key: 'name', label: 'Name', inputType: 'text' },
	{ key: 'nominalVoltageKv', label: 'Nominal Voltage (kV)', inputType: 'number', step: '0.001' },
	{ key: 'busType', label: 'Bus Type', inputType: 'select', options: BUS_TYPE_OPTIONS },
	{ key: 'voltageMagnitudePu', label: 'Voltage Magnitude (p.u.)', inputType: 'number', step: '0.0001' },
	{ key: 'voltageAngleDeg', label: 'Voltage Angle (deg)', inputType: 'number', step: '0.0001' },
	{ key: 'minVoltagePu', label: 'Min Voltage (p.u.)', inputType: 'number', step: '0.0001' },
	{ key: 'maxVoltagePu', label: 'Max Voltage (p.u.)', inputType: 'number', step: '0.0001' },
	{ key: 'inService', label: 'In Service', inputType: 'boolean' },
	{ key: 'area', label: 'Area', inputType: 'text' },
	{ key: 'zone', label: 'Zone', inputType: 'text' },
];

const SHUNT_FIELDS_WITHOUT_BUS: readonly FieldDescriptor[] = [
	{ key: 'shuntType', label: 'Shunt Type', inputType: 'select', options: SHUNT_TYPE_OPTIONS },
	{ key: 'qMvar', label: 'Q (MVAR)', inputType: 'number', step: '0.001' },
	{ key: 'maxStep', label: 'Max Step', inputType: 'number', step: '1' },
	{ key: 'currentStep', label: 'Current Step', inputType: 'number', step: '1' },
	{ key: 'inService', label: 'In Service', inputType: 'boolean' },
];

const withBusOptions = (
	busOptions: readonly SelectOption[],
	fields: readonly FieldDescriptor[],
): readonly FieldDescriptor[] =>
	fields.map((field) => (field.options === undefined ? field : { ...field, options: busOptions }));

const LINE_FIELDS: readonly FieldDescriptor[] = [
	{ key: 'name', label: 'Name', inputType: 'text' },
	{ key: 'fromBusId', label: 'From Bus', inputType: 'select', options: [] },
	{ key: 'toBusId', label: 'To Bus', inputType: 'select', options: [] },
	{ key: 'resistancePu', label: 'Resistance (p.u.)', inputType: 'number', step: '0.000001' },
	{ key: 'reactancePu', label: 'Reactance (p.u.)', inputType: 'number', step: '0.000001' },
	{ key: 'susceptancePu', label: 'Susceptance (p.u.)', inputType: 'number', step: '0.000001' },
	{ key: 'ratingMva', label: 'Rating (MVA)', inputType: 'number', step: '0.001' },
	{ key: 'lengthKm', label: 'Length (km)', inputType: 'number', step: '0.001' },
	{ key: 'inService', label: 'In Service', inputType: 'boolean' },
	{ key: 'ratingMvaShortTerm', label: 'Short-term Rating (MVA)', inputType: 'number', step: '0.001' },
	{ key: 'maxLoadingPercent', label: 'Max Loading (%)', inputType: 'number', step: '0.01' },
	{ key: 'fromSwitchClosed', label: 'From Switch Closed', inputType: 'boolean' },
	{ key: 'toSwitchClosed', label: 'To Switch Closed', inputType: 'boolean' },
];

const TRANSFORMER_FIELDS: readonly FieldDescriptor[] = [
	{ key: 'name', label: 'Name', inputType: 'text' },
	{ key: 'fromBusId', label: 'From Bus', inputType: 'select', options: [] },
	{ key: 'toBusId', label: 'To Bus', inputType: 'select', options: [] },
	{ key: 'resistancePu', label: 'Resistance (p.u.)', inputType: 'number', step: '0.000001' },
	{ key: 'reactancePu', label: 'Reactance (p.u.)', inputType: 'number', step: '0.000001' },
	{
		key: 'magnetizingSusceptancePu',
		label: 'Magnetizing Susceptance (p.u.)',
		inputType: 'number',
		step: '0.000001',
	},
	{ key: 'ratingMva', label: 'Rating (MVA)', inputType: 'number', step: '0.001' },
	{ key: 'inService', label: 'In Service', inputType: 'boolean' },
	{ key: 'tapRatio', label: 'Tap Ratio', inputType: 'number', step: '0.0001' },
	{ key: 'tapMin', label: 'Tap Min', inputType: 'number', step: '0.0001' },
	{ key: 'tapMax', label: 'Tap Max', inputType: 'number', step: '0.0001' },
	{ key: 'tapStepPercent', label: 'Tap Step (%)', inputType: 'number', step: '0.0001' },
	{ key: 'tapSide', label: 'Tap Side', inputType: 'select', options: TAP_SIDE_OPTIONS },
	{ key: 'windingType', label: 'Winding Type', inputType: 'select', options: WINDING_TYPE_OPTIONS },
	{ key: 'maxLoadingPercent', label: 'Max Loading (%)', inputType: 'number', step: '0.01' },
	{ key: 'fromSwitchClosed', label: 'From Switch Closed', inputType: 'boolean' },
	{ key: 'toSwitchClosed', label: 'To Switch Closed', inputType: 'boolean' },
];

const LOAD_FIELDS: readonly FieldDescriptor[] = [
	{ key: 'name', label: 'Name', inputType: 'text' },
	{ key: 'busId', label: 'Bus', inputType: 'select', options: [] },
	{ key: 'activePowerMw', label: 'Active Power (MW)', inputType: 'number', step: '0.001' },
	{ key: 'reactivePowerMvar', label: 'Reactive Power (MVAR)', inputType: 'number', step: '0.001' },
	{ key: 'inService', label: 'In Service', inputType: 'boolean' },
	{ key: 'loadType', label: 'Load Type', inputType: 'select', options: LOAD_TYPE_OPTIONS },
	{ key: 'scalingFactor', label: 'Scaling Factor', inputType: 'number', step: '0.0001' },
];

const GENERATOR_FIELDS: readonly FieldDescriptor[] = [
	{ key: 'name', label: 'Name', inputType: 'text' },
	{ key: 'busId', label: 'Bus', inputType: 'select', options: [] },
	{ key: 'activePowerMw', label: 'Active Power (MW)', inputType: 'number', step: '0.001' },
	{ key: 'reactivePowerMvar', label: 'Reactive Power (MVAR)', inputType: 'number', step: '0.001' },
	{ key: 'voltagePu', label: 'Voltage (p.u.)', inputType: 'number', step: '0.0001' },
	{ key: 'minMw', label: 'Min MW', inputType: 'number', step: '0.001' },
	{ key: 'maxMw', label: 'Max MW', inputType: 'number', step: '0.001' },
	{ key: 'inService', label: 'In Service', inputType: 'boolean' },
	{ key: 'minMvar', label: 'Min MVAR', inputType: 'number', step: '0.001' },
	{ key: 'maxMvar', label: 'Max MVAR', inputType: 'number', step: '0.001' },
	{ key: 'xdppPu', label: 'Xdpp (p.u.)', inputType: 'number', step: '0.0001' },
	{ key: 'costA', label: 'Cost A', inputType: 'number', step: '0.0001' },
	{ key: 'costB', label: 'Cost B', inputType: 'number', step: '0.0001' },
	{ key: 'costC', label: 'Cost C', inputType: 'number', step: '0.0001' },
	{ key: 'rampRateMwPerMin', label: 'Ramp Rate (MW/min)', inputType: 'number', step: '0.001' },
];

const SHUNT_FIELDS: readonly FieldDescriptor[] = [
	{ key: 'name', label: 'Name', inputType: 'text' },
	{ key: 'busId', label: 'Bus', inputType: 'select', options: [] },
	...SHUNT_FIELDS_WITHOUT_BUS,
];

export const INSPECTOR_TITLES: Record<InspectorKind, string> = {
	bus: 'Bus Inspector',
	line: 'Line Inspector',
	transformer: 'Transformer Inspector',
	load: 'Load Inspector',
	generator: 'Generator Inspector',
	shunt: 'Shunt Inspector',
};

export const resolveInspectorFields = (
	kind: InspectorKind,
	busIds: readonly string[],
): readonly FieldDescriptor[] => {
	const busOptions = busIds.map((id) => ({ value: id, label: id }));
	if (kind === 'bus') {
		return BUS_FIELDS;
	}
	if (kind === 'line') {
		return withBusOptions(busOptions, LINE_FIELDS);
	}
	if (kind === 'transformer') {
		return withBusOptions(busOptions, TRANSFORMER_FIELDS);
	}
	if (kind === 'load') {
		return withBusOptions(busOptions, LOAD_FIELDS);
	}
	if (kind === 'generator') {
		return withBusOptions(busOptions, GENERATOR_FIELDS);
	}
	return withBusOptions(busOptions, SHUNT_FIELDS);
};
