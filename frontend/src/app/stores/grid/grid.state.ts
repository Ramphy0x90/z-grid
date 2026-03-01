import { ProjectGrid } from '../../types/project.types';

export const gridFeatureKey = 'grid';

export type GridOperationState = {
	isRunning: boolean;
	error: string | null;
};

export type GridState = {
	grids: ProjectGrid[];
	selectedGridId: string | null;
	duplicate: GridOperationState;
	delete: GridOperationState;
	export: GridOperationState;
};

export const initialGridState: GridState = {
	grids: [],
	selectedGridId: null,
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
