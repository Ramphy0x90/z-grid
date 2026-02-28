import { Project } from '../../services/project.service';

export const projectFeatureKey = 'project';

export type ProjectState = {
  projects: Project[];
  selectedProjectId: string | null;
};

export const initialProjectState: ProjectState = {
  projects: [],
  selectedProjectId: null,
};
