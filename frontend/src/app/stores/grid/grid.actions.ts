import { createActionGroup, props } from '@ngrx/store';
import { ProjectGrid } from '../../types/project.types';
import type { GridEditorMode } from './grid.state';

export const GridActions = createActionGroup({
	source: 'Grid',
	events: {
		'Grids Loaded': props<{ grids: ProjectGrid[] }>(),
		'Selected Project Synced': props<{ projectId: string | null }>(),
		'Grid Selected': props<{ gridId: string }>(),
		'Grid Duplicated': props<{ duplicatedGrid: ProjectGrid }>(),
		'Grid Deleted': props<{ gridId: string; nextSelectedGridId: string | null }>(),
		'Grid Duplicate Requested': props<{ gridId: string }>(),
		'Grid Duplicate Succeeded': props<{ duplicatedGrid: ProjectGrid }>(),
		'Grid Duplicate Failed': props<{ error: string }>(),
		'Grid Delete Requested': props<{ gridId: string }>(),
		'Grid Delete Succeeded': props<{ gridId: string; nextSelectedGridId: string | null }>(),
		'Grid Delete Failed': props<{ error: string }>(),
		'Grid Export Requested': props<{ gridId: string }>(),
		'Grid Export Succeeded': props<{ gridId: string }>(),
		'Grid Export Failed': props<{ error: string }>(),
		'Grid Editor Mode Set': props<{ mode: GridEditorMode }>(),
	},
});
