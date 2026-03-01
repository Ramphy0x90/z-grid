import { ProjectGrid } from '../../types/project.types';

export const gridFeatureKey = 'grid';
export type GridEditorMode = 'view' | 'edit' | 'create';

export type GridOperationState = {
	isRunning: boolean;
	error: string | null;
};

export type GridState = {
	grids: ProjectGrid[];
	selectedProjectId: string | null;
	selectedGridId: string | null;
	editorMode: GridEditorMode;
	duplicate: GridOperationState;
	delete: GridOperationState;
	export: GridOperationState;
};

export const initialGridState: GridState = {
	grids: [],
	selectedProjectId: null,
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
