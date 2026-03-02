import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import {
	catchError,
	concatMap,
	exhaustMap,
	from,
	map,
	of,
	switchMap,
	tap,
	withLatestFrom,
} from 'rxjs';
import { toProjectPageCommands } from '../../app.routes';
import { GridEditorSessionService } from '../../services/grid-editor-session.service';
import { ProjectSelectors } from '../project/project.selectors';
import { GridExportService } from '../../services/grid-export.service';
import { PowerFlowRunService } from '../../services/power-flow-run.service';
import { ProjectService } from '../../services/project.service';
import type { ProjectGrid } from '../../types/project.types';
import { GridActions } from './grid.actions';
import { GridSelectors } from './grid.selectors';

@Injectable({ providedIn: 'root' })
export class GridEffects {
	private readonly actions$ = inject(Actions);
	private readonly router = inject(Router);
	private readonly gridEditorSessionService = inject(GridEditorSessionService);
	private readonly powerFlowRunService = inject(PowerFlowRunService);
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

	private readonly submitGrid$ = createEffect(() =>
		this.actions$.pipe(
			ofType(GridActions.gridSubmitRequested),
			exhaustMap(({ projectId, selectedGridId, isEditing, name, description }) => {
				if (isEditing) {
					if (!selectedGridId) {
						return of(
							GridActions.gridSubmitFailed({
								error: 'No grid selected for update.',
							}),
						);
					}
					return this.projectService.updateGrid$(selectedGridId, { name, description }).pipe(
						switchMap((updatedGrid) => {
							const dataset = this.projectService.getGridDatasetById(selectedGridId);
							if (!dataset) {
								return of(updatedGrid);
							}
							return this.projectService
								.saveGridDataset$(selectedGridId, dataset)
								.pipe(map(() => updatedGrid));
						}),
						concatMap(() =>
							of(
								GridActions.gridsLoaded({ grids: this.projectService.grids() }),
								GridActions.gridEditorModeSet({ mode: 'view' }),
							),
						),
						catchError((error: unknown) =>
							of(
								GridActions.gridSubmitFailed({
									error: this.toErrorMessage(error),
								}),
							),
						),
					);
				}

				return this.projectService.createGrid$(projectId, { name, description }).pipe(
					switchMap((createdGrid) => {
						const draftDataset = this.gridEditorSessionService.getCreateDraftDataset();
						if (!draftDataset) {
							return of(createdGrid);
						}
						return this.projectService
							.saveGridDataset$(createdGrid.id, {
								...draftDataset,
								grid: {
									...draftDataset.grid,
									id: createdGrid.id,
									projectId: createdGrid.projectId,
									name: createdGrid.name,
									description: createdGrid.description,
								},
								buses: draftDataset.buses.map((bus) => ({
									...bus,
									gridId: createdGrid.id,
								})),
								lines: draftDataset.lines.map((line) => ({
									...line,
									gridId: createdGrid.id,
								})),
								transformers: draftDataset.transformers.map((transformer) => ({
									...transformer,
									gridId: createdGrid.id,
								})),
							})
							.pipe(map(() => createdGrid));
					}),
					concatMap((createdGrid) => {
						this.gridEditorSessionService.clearCreateDraft();
						return of(
							GridActions.gridDuplicated({ duplicatedGrid: createdGrid }),
							GridActions.gridEditorModeSet({ mode: 'view' }),
						);
					}),
					catchError((error: unknown) =>
						of(
							GridActions.gridSubmitFailed({
								error: this.toErrorMessage(error),
							}),
						),
					),
				);
			}),
		),
	);

	private readonly runPowerFlow$ = createEffect(() =>
		this.actions$.pipe(
			ofType(GridActions.powerFlowRunRequested),
			exhaustMap(({ projectId, gridId }) => {
				const dataset = this.projectService.getGridDatasetById(gridId);
				const saveBeforeRun$ = dataset
					? this.projectService.saveGridDataset$(gridId, dataset).pipe(map(() => null))
					: of(null);
				return saveBeforeRun$.pipe(
					switchMap(() => this.powerFlowRunService.startPowerFlowRun$(gridId)),
					switchMap(() => from(this.router.navigate([...toProjectPageCommands(projectId, 'power-flow')]))),
					map(() => GridActions.powerFlowRunSucceeded()),
					catchError((error: unknown) =>
						of(
							GridActions.powerFlowRunFailed({
								error: this.toErrorMessage(error),
							}),
						),
					),
				);
			}),
		),
	);

	private toErrorMessage(error: unknown): string {
		if (error instanceof Error && error.message.trim().length > 0) {
			return error.message;
		}
		return 'Grid operation failed.';
	}
}
