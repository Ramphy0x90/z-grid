import { createReducer, on } from '@ngrx/store';
import { ProjectActions } from './project.actions';
import { initialProjectState } from './project.state';

export const projectReducer = createReducer(
  initialProjectState,
  on(ProjectActions.projectsLoaded, (state, { projects }) => ({ ...state, projects })),
  on(ProjectActions.selectedProjectSynced, (state, { projectId }) => ({
    ...state,
    selectedProjectId: projectId,
  })),
);
