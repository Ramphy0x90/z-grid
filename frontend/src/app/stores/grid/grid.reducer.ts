import { createReducer, on } from '@ngrx/store';
import { GridActions } from './grid.actions';
import { initialGridState } from './grid.state';

const withProjectGridSelection = (
	selectedGridIdByProjectId: Record<string, string>,
	projectId: string | null,
	gridId: string | null,
): Record<string, string> => {
	if (!projectId) {
		return selectedGridIdByProjectId;
	}
	if (!gridId) {
		const remainingSelections = { ...selectedGridIdByProjectId };
		delete remainingSelections[projectId];
		return remainingSelections;
	}
	return {
		...selectedGridIdByProjectId,
		[projectId]: gridId,
	};
};

export const gridReducer = createReducer(
	initialGridState,
	on(GridActions.gridsLoaded, (state, { grids }) => {
		const hasValidSelection =
			state.selectedGridId !== null && grids.some((grid) => grid.id === state.selectedGridId);
		const selectedGridIdByProjectId = state.selectedGridId
			? withProjectGridSelection(
					state.selectedGridIdByProjectId,
					state.selectedProjectId,
					hasValidSelection ? state.selectedGridId : null,
				)
			: state.selectedGridIdByProjectId;
		return {
			...state,
			grids,
			selectedGridId: hasValidSelection ? state.selectedGridId : null,
			selectedGridIdByProjectId,
		};
	}),
	on(GridActions.selectedProjectSynced, (state, { projectId }) => {
		if (state.selectedProjectId === projectId) {
			return state;
		}
		return {
			...state,
			selectedProjectId: projectId,
			selectedGridId: projectId ? state.selectedGridIdByProjectId[projectId] ?? null : null,
		};
	}),
	on(GridActions.gridSelected, (state, { gridId }) => {
		const selectedGridId = state.grids.some((grid) => grid.id === gridId)
			? gridId
			: state.selectedGridId;
		if (!selectedGridId) {
			return state;
		}
		const selectedProjectId = state.selectedProjectId;
		return {
			...state,
			selectedGridId,
			selectedGridIdByProjectId: withProjectGridSelection(
				state.selectedGridIdByProjectId,
				selectedProjectId,
				selectedGridId,
			),
		};
	}),
	on(GridActions.gridEditorModeSet, (state, { mode }) => ({
		...state,
		editorMode: mode,
	})),
	on(GridActions.gridDuplicated, (state, { duplicatedGrid }) => ({
		...state,
		grids: [duplicatedGrid, ...state.grids],
		selectedGridId: duplicatedGrid.id,
		selectedGridIdByProjectId: {
			...state.selectedGridIdByProjectId,
			[duplicatedGrid.projectId]: duplicatedGrid.id,
		},
	})),
	on(GridActions.gridDeleted, (state, { gridId, nextSelectedGridId }) => ({
		...state,
		grids: state.grids.filter((grid) => grid.id !== gridId),
		selectedGridId: nextSelectedGridId,
		selectedGridIdByProjectId: withProjectGridSelection(
			state.selectedGridIdByProjectId,
			state.selectedProjectId,
			nextSelectedGridId,
		),
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
		selectedGridIdByProjectId: {
			...state.selectedGridIdByProjectId,
			[duplicatedGrid.projectId]: duplicatedGrid.id,
		},
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
		selectedGridIdByProjectId: withProjectGridSelection(
			state.selectedGridIdByProjectId,
			state.selectedProjectId,
			nextSelectedGridId,
		),
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
	on(GridActions.gridImportRequested, (state) => ({
		...state,
		import: {
			isRunning: true,
			error: null,
		},
	})),
	on(GridActions.gridImportSucceeded, (state, { importedGrid }) => ({
		...state,
		grids: [importedGrid, ...state.grids],
		selectedGridId: importedGrid.id,
		selectedGridIdByProjectId: {
			...state.selectedGridIdByProjectId,
			[importedGrid.projectId]: importedGrid.id,
		},
		import: {
			isRunning: false,
			error: null,
		},
	})),
	on(GridActions.gridImportFailed, (state, { error }) => ({
		...state,
		import: {
			isRunning: false,
			error,
		},
	})),
	on(GridActions.powerFlowRunRequested, (state) => ({
		...state,
		run: {
			isRunning: true,
			error: null,
		},
	})),
	on(GridActions.powerFlowRunSucceeded, (state) => ({
		...state,
		run: {
			isRunning: false,
			error: null,
		},
	})),
	on(GridActions.powerFlowRunFailed, (state, { error }) => ({
		...state,
		run: {
			isRunning: false,
			error,
		},
	})),
	on(GridActions.shortCircuitRunRequested, (state) => ({
		...state,
		shortCircuitRun: {
			isRunning: true,
			error: null,
		},
	})),
	on(GridActions.shortCircuitRunSucceeded, (state) => ({
		...state,
		shortCircuitRun: {
			isRunning: false,
			error: null,
		},
	})),
	on(GridActions.shortCircuitRunFailed, (state, { error }) => ({
		...state,
		shortCircuitRun: {
			isRunning: false,
			error,
		},
	})),
);
