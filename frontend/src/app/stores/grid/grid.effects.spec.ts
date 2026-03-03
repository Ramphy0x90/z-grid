import { TestBed } from '@angular/core/testing';
import { Action } from '@ngrx/store';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, ReplaySubject, firstValueFrom, of, throwError } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridEffects } from './grid.effects';
import { GridActions } from './grid.actions';
import { GridEditorSessionService } from '../../services/grid-editor-session.service';
import { GridExportService } from '../../services/grid-export.service';
import { PowerFlowRunService } from '../../services/power-flow-run.service';
import { ProjectService } from '../../services/project.service';
import type { GridDataset } from '../../components/grid-viewer/models/grid.models';

const createDataset = (name = 'Imported Grid'): GridDataset => ({
	grid: {
		id: 'source-grid',
		projectId: 'source-project',
		name,
		description: 'source description',
		baseMva: 100,
		frequencyHz: 50,
	},
	buses: [],
	lines: [],
	transformers: [],
	loads: [],
	generators: [],
	shuntCompensators: [],
	busLayout: [],
	edgeLayout: [],
});

describe('GridEffects import', () => {
	let actions$: ReplaySubject<Action>;
	let effects: GridEffects;
	let projectService: {
		duplicateGrid$: ReturnType<typeof vi.fn>;
		deleteGrid$: ReturnType<typeof vi.fn>;
		loadGridDatasetById$: ReturnType<typeof vi.fn>;
		updateGrid$: ReturnType<typeof vi.fn>;
		saveGridDataset$: ReturnType<typeof vi.fn>;
		createGrid$: ReturnType<typeof vi.fn>;
		prepareDatasetForGrid: ReturnType<typeof vi.fn>;
		getGridById: ReturnType<typeof vi.fn>;
		getGridDatasetById: ReturnType<typeof vi.fn>;
		grids: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		actions$ = new ReplaySubject<Action>(1);
		projectService = {
			duplicateGrid$: vi.fn(),
			deleteGrid$: vi.fn(),
			loadGridDatasetById$: vi.fn(),
			updateGrid$: vi.fn(),
			saveGridDataset$: vi.fn(),
			createGrid$: vi.fn(),
			prepareDatasetForGrid: vi.fn(),
			getGridById: vi.fn(),
			getGridDatasetById: vi.fn(),
			grids: vi.fn(),
		};
		projectService.grids.mockReturnValue([]);
		projectService.getGridById.mockReturnValue(null);
		projectService.getGridDatasetById.mockReturnValue(null);

		const router = {
			navigate: vi.fn(),
		};
		const gridExportService = {
			exportDatasetAsJson: vi.fn(),
		};
		const runService = {
			startPowerFlowRun$: vi.fn(),
		};
		const sessionService = {
			getCreateDraftDataset: vi.fn(),
			clearCreateDraft: vi.fn(),
		};
		const toastr = {
			success: vi.fn(),
		};

		TestBed.configureTestingModule({
			providers: [
				GridEffects,
				provideMockActions(() => actions$),
				provideMockStore({
					initialState: {
						grid: {
							grids: [],
							selectedProjectId: null,
							selectedGridId: null,
							selectedGridIdByProjectId: {},
							editorMode: 'view',
							duplicate: { isRunning: false, error: null },
							delete: { isRunning: false, error: null },
							export: { isRunning: false, error: null },
							import: { isRunning: false, error: null },
							run: { isRunning: false, error: null },
						},
						project: {
							projects: [],
							selectedProjectId: null,
						},
					},
				}),
				{ provide: ProjectService, useValue: projectService as unknown as ProjectService },
				{ provide: Router, useValue: router as unknown as Router },
				{
					provide: GridExportService,
					useValue: gridExportService as unknown as GridExportService,
				},
				{ provide: PowerFlowRunService, useValue: runService as unknown as PowerFlowRunService },
				{
					provide: GridEditorSessionService,
					useValue: sessionService as unknown as GridEditorSessionService,
				},
				{ provide: ToastrService, useValue: toastr as unknown as ToastrService },
			],
		});

		effects = TestBed.inject(GridEffects);
	});

	it('dispatches import succeeded and switches editor to view mode', async () => {
		const dataset = createDataset('Nord Grid');
		const importedGrid = {
			id: 'grid-new',
			projectId: 'project-1',
			name: 'Nord Grid',
			description: 'source description',
			busCount: 0,
		};
		projectService.createGrid$.mockReturnValue(of(importedGrid));
		const preparedDataset = {
			...dataset,
			grid: {
				...dataset.grid,
				id: importedGrid.id,
				projectId: importedGrid.projectId,
				name: importedGrid.name,
				description: importedGrid.description,
			},
		};
		projectService.prepareDatasetForGrid.mockReturnValue(preparedDataset);
		projectService.saveGridDataset$.mockReturnValue(of(preparedDataset));
		actions$.next(
			GridActions.gridImportRequested({
				projectId: 'project-1',
				fileName: 'nord-grid.json',
				dataset,
			}),
		);

		const emitted = await firstValueFrom(
			(effects as unknown as { importGrid$: Observable<Action> }).importGrid$.pipe(
				take(2),
				toArray(),
			),
		);

		expect(projectService.createGrid$).toHaveBeenCalledWith('project-1', {
			name: 'Nord Grid',
			description: 'source description',
		});
		expect(projectService.prepareDatasetForGrid).toHaveBeenCalledWith(dataset, importedGrid);
		expect(projectService.saveGridDataset$).toHaveBeenCalled();
		expect(emitted).toEqual([
			GridActions.gridImportSucceeded({ importedGrid }),
			GridActions.gridEditorModeSet({ mode: 'view' }),
		]);
	});

	it('dispatches import failed when create grid fails', async () => {
		projectService.createGrid$.mockReturnValue(throwError(() => new Error('create failed')));
		const dataset = createDataset();
		actions$.next(
			GridActions.gridImportRequested({
				projectId: 'project-1',
				fileName: 'import.json',
				dataset,
			}),
		);

		const emitted = await firstValueFrom(
			(effects as unknown as { importGrid$: Observable<Action> }).importGrid$.pipe(take(1)),
		);

		expect(emitted).toEqual(GridActions.gridImportFailed({ error: 'create failed' }));
	});
});
