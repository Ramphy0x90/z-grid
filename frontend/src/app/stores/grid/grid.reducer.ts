import { createReducer, on } from '@ngrx/store';
import { GridActions } from './grid.actions';
import { initialGridState } from './grid.state';

export const gridReducer = createReducer(
	initialGridState,
	on(GridActions.gridsLoaded, (state, { grids }) => {
		const hasValidSelection =
			state.selectedGridId !== null && grids.some((grid) => grid.id === state.selectedGridId);
		return {
			...state,
			grids,
			selectedGridId: hasValidSelection ? state.selectedGridId : null,
		};
	}),
	on(GridActions.selectedProjectSynced, (state) => ({
		...state,
		selectedGridId: null,
	})),
	on(GridActions.gridSelected, (state, { gridId }) => ({
		...state,
		selectedGridId: state.grids.some((grid) => grid.id === gridId) ? gridId : state.selectedGridId,
	})),
	on(GridActions.gridDuplicated, (state, { duplicatedGrid }) => ({
		...state,
		grids: [duplicatedGrid, ...state.grids],
		selectedGridId: duplicatedGrid.id,
	})),
	on(GridActions.gridDeleted, (state, { gridId, nextSelectedGridId }) => ({
		...state,
		grids: state.grids.filter((grid) => grid.id !== gridId),
		selectedGridId: nextSelectedGridId,
	})),
	on(GridActions.gridDuplicateRequested, (state) => ({
		...state,
		duplicate: {
			isRunning: true,
			error: null,
		},
	})),
	on(GridActions.gridDuplicateSucceeded, (state, { duplicatedGrid }) => ({
		...state,
		grids: [duplicatedGrid, ...state.grids],
		selectedGridId: duplicatedGrid.id,
		duplicate: {
			isRunning: false,
			error: null,
		},
	})),
	on(GridActions.gridDuplicateFailed, (state, { error }) => ({
		...state,
		duplicate: {
			isRunning: false,
			error,
		},
	})),
	on(GridActions.gridDeleteRequested, (state) => ({
		...state,
		delete: {
			isRunning: true,
			error: null,
		},
	})),
	on(GridActions.gridDeleteSucceeded, (state, { gridId, nextSelectedGridId }) => ({
		...state,
		grids: state.grids.filter((grid) => grid.id !== gridId),
		selectedGridId: nextSelectedGridId,
		delete: {
			isRunning: false,
			error: null,
		},
	})),
	on(GridActions.gridDeleteFailed, (state, { error }) => ({
		...state,
		delete: {
			isRunning: false,
			error,
		},
	})),
	on(GridActions.gridExportRequested, (state) => ({
		...state,
		export: {
			isRunning: true,
			error: null,
		},
	})),
	on(GridActions.gridExportSucceeded, (state) => ({
		...state,
		export: {
			isRunning: false,
			error: null,
		},
	})),
	on(GridActions.gridExportFailed, (state, { error }) => ({
		...state,
		export: {
			isRunning: false,
			error,
		},
	})),
);
