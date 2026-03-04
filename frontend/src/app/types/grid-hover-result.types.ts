import type { GridDataset } from '../components/grid-viewer/models/grid.models';

export type GridHoverElementKind =
	| 'bus'
	| 'line'
	| 'transformer'
	| 'load'
	| 'generator'
	| 'shunt';

export type GridHoverElementRef = {
	kind: GridHoverElementKind;
	id: string;
};

export type GridHoverResultTone = 'default' | 'ok' | 'warn' | 'critical';

export type GridHoverResultRow = {
	label: string;
	value: string;
	tone?: GridHoverResultTone;
};

export type GridHoverResultCard = {
	title: string;
	subtitle?: string;
	rows: readonly GridHoverResultRow[];
	statusText?: string;
};

export type GridHoverResultContext = {
	hoveredElement: GridHoverElementRef;
	dataset: GridDataset;
};

export type GridHoverResultProvider = (
	context: GridHoverResultContext,
) => GridHoverResultCard | null;
