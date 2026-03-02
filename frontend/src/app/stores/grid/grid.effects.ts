import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, of, tap, withLatestFrom } from 'rxjs';
import { ProjectSelectors } from '../project/project.selectors';
import { GridExportService } from '../../services/grid-export.service';
import { ProjectService } from '../../services/project.service';
import type { ProjectGrid } from '../../types/project.types';
import { GridActions } from './grid.actions';
import { GridSelectors } from './grid.selectors';

@Injectable({ providedIn: 'root' })
export class GridEffects {
	private readonly actions$ = inject(Actions);
	private readonly projectService = inject(ProjectService);
	private readonly gridExportService = inject(GridExportService);
	private readonly store = inject(Store);

	private readonly duplicateGrid$ = createEffect(() =>
		this.actions$.pipe(
			ofType(GridActions.gridDuplicateRequested),
			exhaustMap(({ gridId }) =>
				this.projectService.duplicateGrid$(gridId).pipe(
					map((duplicatedGrid) => GridActions.gridDuplicateSucceeded({ duplicatedGrid })),
					catchError((error: unknown) =>
						of(
							GridActions.gridDuplicateFailed({
								error: this.toErrorMessage(error),
							}),
						),
					),
				),
			),
		),
	);

	private readonly deleteGrid$ = createEffect(() =>
		this.actions$.pipe(
			ofType(GridActions.gridDeleteRequested),
			withLatestFrom(
				this.store.select(GridSelectors.grids),
				this.store.select(ProjectSelectors.selectedProjectId),
			),
			exhaustMap(([{ gridId }, grids, selectedProjectId]) =>
				this.projectService.deleteGrid$(gridId).pipe(
					map(() => {
						const remainingGrids = grids.filter((grid: ProjectGrid) => grid.id !== gridId);
						const nextSelectedGridId = selectedProjectId
							? (remainingGrids.find((grid: ProjectGrid) => grid.projectId === selectedProjectId)
									?.id ?? null)
							: null;
						return GridActions.gridDeleteSucceeded({ gridId, nextSelectedGridId });
					}),
					catchError((error: unknown) =>
						of(
							GridActions.gridDeleteFailed({
								error: this.toErrorMessage(error),
							}),
						),
					),
				),
			),
		),
	);

	private readonly exportGrid$ = createEffect(() =>
		this.actions$.pipe(
			ofType(GridActions.gridExportRequested),
			exhaustMap(({ gridId }) =>
				this.projectService.loadGridDatasetById$(gridId).pipe(
					tap((dataset) => {
						const grid = this.projectService.getGridById(gridId);
						this.gridExportService.exportDatasetAsJson(gridId, grid?.name, dataset);
					}),
					map(() => GridActions.gridExportSucceeded({ gridId })),
					catchError((error: unknown) =>
						of(
							GridActions.gridExportFailed({
								error: this.toErrorMessage(error),
							}),
						),
					),
				),
			),
		),
	);

	private toErrorMessage(error: unknown): string {
		if (error instanceof Error && error.message.trim().length > 0) {
			return error.message;
		}
		return 'Grid operation failed.';
	}
}
