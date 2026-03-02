import { createReducer, on } from '@ngrx/store';
import { ProjectActions } from './project.actions';
import { initialProjectState } from './project.state';

export const projectReducer = createReducer(
  initialProjectState,
  on(ProjectActions.projectsLoaded, (state, { projects }) => ({ ...state, projects })),
  on(ProjectActions.projectUpdated, (state, { project }) => ({
    ...state,
    projects: state.projects.map((item) => (item.id === project.id ? project : item)),
  })),
  on(ProjectActions.projectDeleted, (state, { projectId }) => ({
    ...state,
    projects: state.projects.filter((project) => project.id !== projectId),
    selectedProjectId: state.selectedProjectId === projectId ? null : state.selectedProjectId,
  })),
  on(ProjectActions.selectedProjectSynced, (state, { projectId }) => ({
    ...state,
    selectedProjectId: projectId,
  })),
);
