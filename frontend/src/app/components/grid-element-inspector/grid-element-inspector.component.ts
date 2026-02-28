import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	output,
	signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
	BusModel,
	GeneratorModel,
	LineModel,
	LoadModel,
	ShuntCompensatorModel,
	TransformerModel,
} from '../grid-viewer/models/grid.models';

type InspectorKind = 'bus' | 'line' | 'transformer' | 'load' | 'generator' | 'shunt';

type ElementByKind = {
	bus: BusModel;
	line: LineModel;
	transformer: TransformerModel;
	load: LoadModel;
	generator: GeneratorModel;
	shunt: ShuntCompensatorModel;
};

export type GridElementInspectorSelection = {
	[K in InspectorKind]: { kind: K; element: ElementByKind[K] };
}[InspectorKind];

export type GridElementInspectorApplyEvent = {
	kind: InspectorKind;
	id: string;
	changes: Record<string, unknown>;
};

type SelectOption = {
	value: string;
	label: string;
};

type FieldDescriptor = {
	key: string;
	label: string;
	inputType: 'text' | 'number' | 'boolean' | 'select';
	step?: string;
	options?: readonly SelectOption[];
};

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

@Component({
	selector: 'app-grid-element-inspector',
	imports: [ReactiveFormsModule],
	templateUrl: './grid-element-inspector.component.html',
	styleUrl: './grid-element-inspector.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridElementInspectorComponent {
	readonly selection = input<GridElementInspectorSelection | null>(null);
	readonly editEnabled = input(false);
	readonly busIds = input<readonly string[]>([]);
	readonly applyRequested = output<GridElementInspectorApplyEvent>();

	private readonly formState = signal<FormGroup<Record<string, FormControl<unknown>>> | null>(null);
	protected readonly form = this.formState.asReadonly();
	protected readonly title = computed(() => this.resolveTitle(this.selection()?.kind ?? null));
	protected readonly fields = computed(() => this.resolveFields(this.selection(), this.busIds()));
	protected readonly canApply = computed(() => {
		const form = this.form();
		return Boolean(form && this.editEnabled() && form.valid && form.dirty);
	});

	constructor() {
		effect(() => {
			const selection = this.selection();
			const fields = this.fields();
			if (!selection) {
				this.formState.set(null);
				return;
			}
			const rawElement = selection.element as Record<string, unknown>;
			const controls: Record<string, FormControl<unknown>> = {};
			for (const field of fields) {
				const initial = this.resolveInitialFieldValue(field, rawElement[field.key]);
				controls[field.key] = new FormControl(initial, {
					nonNullable: true,
					validators: field.inputType === 'number' ? [Validators.required] : [],
				});
			}
			this.formState.set(new FormGroup(controls));
		});
	}

	private resolveInitialFieldValue(field: FieldDescriptor, rawValue: unknown): unknown {
		if (field.inputType === 'number') {
			return typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : 0;
		}
		if (field.inputType === 'boolean') {
			return typeof rawValue === 'boolean' ? rawValue : false;
		}
		if (field.inputType === 'select') {
			if (typeof rawValue === 'string') {
				return rawValue;
			}
			return field.options?.[0]?.value ?? '';
		}
		return typeof rawValue === 'string' ? rawValue : '';
	}

	protected onApply(): void {
		const selection = this.selection();
		const form = this.form();
		if (!selection || !form || !this.editEnabled() || form.invalid || !form.dirty) {
			return;
		}
		this.applyRequested.emit({
			kind: selection.kind,
			id: selection.element.id,
			changes: form.getRawValue(),
		});
	}

	private resolveTitle(kind: InspectorKind | null): string {
		if (kind === 'bus') {
			return 'Bus Inspector';
		}
		if (kind === 'line') {
			return 'Line Inspector';
		}
		if (kind === 'transformer') {
			return 'Transformer Inspector';
		}
		if (kind === 'load') {
			return 'Load Inspector';
		}
		if (kind === 'generator') {
			return 'Generator Inspector';
		}
		if (kind === 'shunt') {
			return 'Shunt Inspector';
		}
		return 'Element Inspector';
	}

	private resolveFields(
		selection: GridElementInspectorSelection | null,
		busIds: readonly string[],
	): readonly FieldDescriptor[] {
		if (!selection) {
			return [];
		}
		const busOptions = busIds.map((id) => ({ value: id, label: id }));
		if (selection.kind === 'bus') {
			return [
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
		}
		if (selection.kind === 'line') {
			return [
				{ key: 'name', label: 'Name', inputType: 'text' },
				{ key: 'fromBusId', label: 'From Bus', inputType: 'select', options: busOptions },
				{ key: 'toBusId', label: 'To Bus', inputType: 'select', options: busOptions },
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
		}
		if (selection.kind === 'transformer') {
			return [
				{ key: 'name', label: 'Name', inputType: 'text' },
				{ key: 'fromBusId', label: 'From Bus', inputType: 'select', options: busOptions },
				{ key: 'toBusId', label: 'To Bus', inputType: 'select', options: busOptions },
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
				{
					key: 'windingType',
					label: 'Winding Type',
					inputType: 'select',
					options: WINDING_TYPE_OPTIONS,
				},
				{ key: 'maxLoadingPercent', label: 'Max Loading (%)', inputType: 'number', step: '0.01' },
				{ key: 'fromSwitchClosed', label: 'From Switch Closed', inputType: 'boolean' },
				{ key: 'toSwitchClosed', label: 'To Switch Closed', inputType: 'boolean' },
			];
		}
		if (selection.kind === 'load') {
			return [
				{ key: 'name', label: 'Name', inputType: 'text' },
				{ key: 'busId', label: 'Bus', inputType: 'select', options: busOptions },
				{ key: 'activePowerMw', label: 'Active Power (MW)', inputType: 'number', step: '0.001' },
				{ key: 'reactivePowerMvar', label: 'Reactive Power (MVAR)', inputType: 'number', step: '0.001' },
				{ key: 'inService', label: 'In Service', inputType: 'boolean' },
				{
					key: 'loadType',
					label: 'Load Type',
					inputType: 'select',
					options: LOAD_TYPE_OPTIONS,
				},
				{ key: 'scalingFactor', label: 'Scaling Factor', inputType: 'number', step: '0.0001' },
			];
		}
		if (selection.kind === 'generator') {
			return [
				{ key: 'name', label: 'Name', inputType: 'text' },
				{ key: 'busId', label: 'Bus', inputType: 'select', options: busOptions },
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
		}
		return [
			{ key: 'name', label: 'Name', inputType: 'text' },
			{ key: 'busId', label: 'Bus', inputType: 'select', options: busOptions },
			{ key: 'shuntType', label: 'Shunt Type', inputType: 'select', options: SHUNT_TYPE_OPTIONS },
			{ key: 'qMvar', label: 'Q (MVAR)', inputType: 'number', step: '0.001' },
			{ key: 'maxStep', label: 'Max Step', inputType: 'number', step: '1' },
			{ key: 'currentStep', label: 'Current Step', inputType: 'number', step: '1' },
			{ key: 'inService', label: 'In Service', inputType: 'boolean' },
		];
	}
}
