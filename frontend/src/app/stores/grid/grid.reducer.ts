import { createReducer, on } from '@ngrx/store';
import { GridActions } from './grid.actions';
import { initialGridState } from './grid.state';

const getDefaultGridId = (
  projectId: string | null,
  grids: { id: string; projectId: string }[],
): string | null => {
  if (!projectId) {
    return null;
  }
  return grids.find((grid) => grid.projectId === projectId)?.id ?? null;
};

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
  on(GridActions.selectedProjectSynced, (state, { projectId }) => ({
    ...state,
    selectedGridId:
      projectId === null
        ? null
        : state.selectedGridId !== null &&
          state.grids.some(
            (grid) => grid.id === state.selectedGridId && grid.projectId === projectId,
          )
        ? state.selectedGridId
        : getDefaultGridId(projectId, state.grids),
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
);
