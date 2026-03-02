import { createActionGroup, props } from '@ngrx/store';
import { Project } from '../../types/project.types';

export const ProjectActions = createActionGroup({
  source: 'Project',
  events: {
    'Projects Loaded': props<{ projects: Project[] }>(),
    'Project Updated': props<{ project: Project }>(),
    'Project Deleted': props<{ projectId: string }>(),
    'Selected Project Synced': props<{ projectId: string | null }>(),
  },
});
