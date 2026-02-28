import { createActionGroup, props } from '@ngrx/store';
import { Project, ProjectGrid } from '../../services/project.service';

export const ProjectActions = createActionGroup({
  source: 'Project',
  events: {
    'Projects Loaded': props<{ projects: Project[] }>(),
    'Grids Loaded': props<{ grids: ProjectGrid[] }>(),
    'Selected Project Synced': props<{ projectId: string | null }>(),
    'Grid Selected': props<{ gridId: string }>(),
  },
});
