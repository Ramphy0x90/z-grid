import { Project, ProjectGrid } from '../../services/project.service';

export const projectFeatureKey = 'project';

export type ProjectState = {
  projects: Project[];
  grids: ProjectGrid[];
  selectedProjectId: string | null;
  selectedGridId: string | null;
};

export const initialProjectState: ProjectState = {
  projects: [],
  grids: [],
  selectedProjectId: null,
  selectedGridId: null,
};
