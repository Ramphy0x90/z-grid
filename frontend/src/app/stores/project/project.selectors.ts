import { createFeatureSelector, createSelector } from '@ngrx/store';
import { projectFeatureKey, ProjectState } from './project.state';

const selectProjectState = createFeatureSelector<ProjectState>(projectFeatureKey);

export const ProjectSelectors = {
  projects: createSelector(selectProjectState, (state) => state.projects),
  selectedProjectId: createSelector(selectProjectState, (state) => state.selectedProjectId),
  hasProjectSelected: createSelector(
    selectProjectState,
    (state) => state.selectedProjectId !== null,
  ),
  selectedProject: createSelector(selectProjectState, (state) =>
    state.selectedProjectId
      ? state.projects.find((project) => project.id === state.selectedProjectId) ?? null
      : null,
  ),
  projectById: (projectId: string | null) =>
    createSelector(selectProjectState, (state) =>
      projectId ? state.projects.find((project) => project.id === projectId) ?? null : null,
    ),
};
