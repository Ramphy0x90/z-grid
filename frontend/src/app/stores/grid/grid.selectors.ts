import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ProjectSelectors } from '../project/project.selectors';
import { GridState, gridFeatureKey } from './grid.state';

const selectGridState = createFeatureSelector<GridState>(gridFeatureKey);

export const GridSelectors = {
	grids: createSelector(selectGridState, (state) => state.grids),
	selectedGridId: createSelector(selectGridState, (state) => state.selectedGridId),
	editorMode: createSelector(selectGridState, (state) => state.editorMode),
	isViewMode: createSelector(selectGridState, (state) => state.editorMode === 'view'),
	isGridEditState: createSelector(
		selectGridState,
		(state) => state.editorMode === 'edit' || state.editorMode === 'create',
	),
	selectedProjectGrids: createSelector(
		selectGridState,
		ProjectSelectors.selectedProjectId,
		(state, selectedProjectId) =>
			selectedProjectId
				? state.grids.filter((grid) => grid.projectId === selectedProjectId)
				: [],
	),
	selectedGrid: createSelector(selectGridState, (state) =>
		state.selectedGridId ? state.grids.find((grid) => grid.id === state.selectedGridId) ?? null : null,
	),
	duplicateOperation: createSelector(selectGridState, (state) => state.duplicate),
	deleteOperation: createSelector(selectGridState, (state) => state.delete),
	exportOperation: createSelector(selectGridState, (state) => state.export),
	importOperation: createSelector(selectGridState, (state) => state.import),
	runOperation: createSelector(selectGridState, (state) => state.run),
};
