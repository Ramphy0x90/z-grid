import { createActionGroup, props } from '@ngrx/store';
import { ProjectGrid } from '../../services/project.service';

export const GridActions = createActionGroup({
	source: 'Grid',
	events: {
		'Grids Loaded': props<{ grids: ProjectGrid[] }>(),
		'Selected Project Synced': props<{ projectId: string | null }>(),
		'Grid Selected': props<{ gridId: string }>(),
		'Grid Duplicated': props<{ duplicatedGrid: ProjectGrid }>(),
		'Grid Deleted': props<{ gridId: string; nextSelectedGridId: string | null }>(),
	},
});
