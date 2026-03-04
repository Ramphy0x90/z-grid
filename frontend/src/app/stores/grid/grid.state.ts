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
	selectedGridIdByProjectId: Record<string, string>;
	editorMode: GridEditorMode;
	duplicate: GridOperationState;
	delete: GridOperationState;
	export: GridOperationState;
	import: GridOperationState;
	run: GridOperationState;
	shortCircuitRun: GridOperationState;
};

export const initialGridState: GridState = {
	grids: [],
	selectedProjectId: null,
	selectedGridId: null,
	selectedGridIdByProjectId: {},
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
	import: {
		isRunning: false,
		error: null,
	},
	run: {
		isRunning: false,
		error: null,
	},
	shortCircuitRun: {
		isRunning: false,
		error: null,
	},
};
