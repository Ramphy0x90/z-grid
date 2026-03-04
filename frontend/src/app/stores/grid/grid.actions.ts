import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ProjectGrid } from '../../types/project.types';
import type { GridEditorMode } from './grid.state';
import type { GridDataset } from '../../components/grid-viewer/models/grid.models';
import type { ShortCircuitRunOptions } from '../../types/short-circuit.types';

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
		'Grid Import Requested': props<{
			projectId: string;
			fileName: string;
			dataset: GridDataset;
		}>(),
		'Grid Import Succeeded': props<{ importedGrid: ProjectGrid }>(),
		'Grid Import Failed': props<{ error: string }>(),
		'Grid Submit Requested': props<{
			projectId: string;
			selectedGridId: string | null;
			isEditing: boolean;
			name: string;
			description: string;
		}>(),
		'Grid Submit Failed': props<{ error: string }>(),
		'Power Flow Run Requested': props<{ projectId: string; gridId: string }>(),
		'Power Flow Run Succeeded': emptyProps(),
		'Power Flow Run Failed': props<{ error: string }>(),
		'Short Circuit Run Requested': props<{
			projectId: string;
			gridId: string;
			options?: ShortCircuitRunOptions;
		}>(),
		'Short Circuit Run Succeeded': emptyProps(),
		'Short Circuit Run Failed': props<{ error: string }>(),
		'Grid Editor Mode Set': props<{ mode: GridEditorMode }>(),
	},
});
