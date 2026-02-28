import { createReducer, on } from '@ngrx/store';
import { ProjectActions } from './project.actions';
import { initialProjectState } from './project.state';

const getDefaultGridId = (
  projectId: string | null,
  grids: { id: string; projectId: string }[],
): string | null => {
  if (!projectId) {
    return null;
  }
  return grids.find((grid) => grid.projectId === projectId)?.id ?? null;
};

export const projectReducer = createReducer(
  initialProjectState,
  on(ProjectActions.projectsLoaded, (state, { projects }) => ({ ...state, projects })),
  on(ProjectActions.gridsLoaded, (state, { grids }) => {
    const hasValidSelection =
      state.selectedProjectId !== null &&
      state.selectedGridId !== null &&
      grids.some(
        (grid) => grid.id === state.selectedGridId && grid.projectId === state.selectedProjectId,
      );
    return {
      ...state,
      grids,
      selectedGridId: hasValidSelection
        ? state.selectedGridId
        : getDefaultGridId(state.selectedProjectId, grids),
    };
  }),
  on(ProjectActions.selectedProjectSynced, (state, { projectId }) => ({
    ...state,
    selectedProjectId: projectId,
    selectedGridId:
      projectId === null
        ? null
        : projectId === state.selectedProjectId
        ? state.selectedGridId
        : getDefaultGridId(projectId, state.grids),
  })),
  on(ProjectActions.gridSelected, (state, { gridId }) => ({
    ...state,
    selectedGridId:
      state.selectedProjectId !== null &&
      state.grids.some(
        (grid) => grid.id === gridId && grid.projectId === state.selectedProjectId,
      )
        ? gridId
        : state.selectedGridId,
  })),
);
