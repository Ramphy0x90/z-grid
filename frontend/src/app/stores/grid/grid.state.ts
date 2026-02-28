import { ProjectGrid } from '../../services/project.service';

export const gridFeatureKey = 'grid';

export type GridState = {
  grids: ProjectGrid[];
  selectedGridId: string | null;
};

export const initialGridState: GridState = {
  grids: [],
  selectedGridId: null,
};
