import type {
	BusModel,
	GeneratorModel,
	LineModel,
	LoadModel,
	ShuntCompensatorModel,
	TransformerModel,
} from '../../grid-viewer/models/grid.models';

export type InspectorKind = 'bus' | 'line' | 'transformer' | 'load' | 'generator' | 'shunt';

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

export type SelectOption = {
	value: string;
	label: string;
};

export type FieldDescriptor = {
	key: string;
	label: string;
	inputType: 'text' | 'number' | 'boolean' | 'select';
	step?: string;
	options?: readonly SelectOption[];
};
