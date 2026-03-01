import { ProjectGrid } from '../../types/project.types';

export const gridFeatureKey = 'grid';
export type GridEditorMode = 'view' | 'edit' | 'create';

export type GridOperationState = {
	isRunning: boolean;
	error: string | null;
};

export type GridState = {
	grids: ProjectGrid[];
	selectedGridId: string | null;
	editorMode: GridEditorMode;
	duplicate: GridOperationState;
	delete: GridOperationState;
	export: GridOperationState;
};

export const initialGridState: GridState = {
	grids: [],
	selectedGridId: null,
	editorMode: 'view',
	duplicate: {
		isRunning: false,
		error: null,
	},
	delete: {
		isRunning: false,
		error: null,
	},
	export: {
		isRunning: false,
		error: null,
	},
};
