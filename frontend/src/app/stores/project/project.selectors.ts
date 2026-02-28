import { createFeatureSelector, createSelector } from '@ngrx/store';
import { projectFeatureKey, ProjectState } from './project.state';

const selectProjectState = createFeatureSelector<ProjectState>(projectFeatureKey);

export const ProjectSelectors = {
  projects: createSelector(selectProjectState, (state) => state.projects),
  grids: createSelector(selectProjectState, (state) => state.grids),
  selectedProjectId: createSelector(selectProjectState, (state) => state.selectedProjectId),
  selectedGridId: createSelector(selectProjectState, (state) => state.selectedGridId),
  hasProjectSelected: createSelector(
    selectProjectState,
    (state) => typeof state.selectedProjectId === 'string' && state.selectedProjectId.length > 0,
  ),
  selectedProject: createSelector(selectProjectState, (state) =>
    state.selectedProjectId
      ? state.projects.find((project) => project.id === state.selectedProjectId) ?? null
      : null,
  ),
  selectedProjectGrids: createSelector(selectProjectState, (state) =>
    state.selectedProjectId
      ? state.grids.filter((grid) => grid.projectId === state.selectedProjectId)
      : [],
  ),
  selectedGrid: createSelector(selectProjectState, (state) =>
    state.selectedGridId ? state.grids.find((grid) => grid.id === state.selectedGridId) ?? null : null,
  ),
  projectById: (projectId: string | null) =>
    createSelector(selectProjectState, (state) =>
      projectId ? state.projects.find((project) => project.id === projectId) ?? null : null,
    ),
};
