import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, of, tap, withLatestFrom } from 'rxjs';
import { ProjectSelectors } from '../project/project.selectors';
import { ProjectService } from '../../services/project.service';
import type { ProjectGrid } from '../../types/project.types';
import { GridActions } from './grid.actions';
import { GridSelectors } from './grid.selectors';

@Injectable({ providedIn: 'root' })
export class GridEffects {
	private readonly actions$ = inject(Actions);
	private readonly projectService = inject(ProjectService);
	private readonly store = inject(Store);

	private readonly duplicateGrid$ = createEffect(() =>
		this.actions$.pipe(
			ofType(GridActions.gridDuplicateRequested),
			exhaustMap(({ gridId }) =>
				this.projectService.duplicateGrid(gridId).pipe(
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
				this.projectService.deleteGrid(gridId).pipe(
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
				this.projectService.loadGridDatasetById(gridId).pipe(
					tap((dataset) => {
						const grid = this.projectService.getGridById(gridId);
						const filenameBase = this.toSafeFileName(grid?.name ?? '') || `grid-${gridId}`;
						this.downloadTextFile(
							`${filenameBase}.json`,
							JSON.stringify(dataset, null, 2),
							'application/json;charset=utf-8',
						);
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

	private toSafeFileName(value: string): string {
		return value
			.trim()
			.replace(/[^a-zA-Z0-9_-]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	private downloadTextFile(filename: string, content: string, mimeType: string): void {
		const blob = new Blob([content], { type: mimeType });
		const objectUrl = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = objectUrl;
		anchor.download = filename;
		anchor.style.display = 'none';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(objectUrl);
	}

	private toErrorMessage(error: unknown): string {
		if (error instanceof Error && error.message.trim().length > 0) {
			return error.message;
		}
		return 'Grid operation failed.';
	}
}
