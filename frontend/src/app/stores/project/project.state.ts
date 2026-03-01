import { Project } from '../../types/project.types';

export const projectFeatureKey = 'project';

export type ProjectState = {
  projects: Project[];
  selectedProjectId: string | null;
};

export const initialProjectState: ProjectState = {
  projects: [],
  selectedProjectId: null,
};
