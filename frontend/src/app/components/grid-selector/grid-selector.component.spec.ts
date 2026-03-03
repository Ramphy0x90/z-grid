import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridSelectorComponent } from './grid-selector.component';
import { GridActions } from '../../stores/grid/grid.actions';
import { ProjectSelectors } from '../../stores/project/project.selectors';
import { GridSelectors } from '../../stores/grid/grid.selectors';

describe('GridSelectorComponent import', () => {
	let fixture: ComponentFixture<GridSelectorComponent>;
	let component: GridSelectorComponent;
	let store: MockStore;
	let toastr: { error: ReturnType<typeof vi.fn> };

	beforeEach(async () => {
		toastr = {
			error: vi.fn(),
		};
		await TestBed.configureTestingModule({
			imports: [GridSelectorComponent],
			providers: [
				provideMockStore({
					initialState: {
						project: {
							projects: [],
							selectedProjectId: 'project-1',
						},
						grid: {
							grids: [],
							selectedProjectId: 'project-1',
							selectedGridId: null,
							selectedGridIdByProjectId: {},
							editorMode: 'view',
							duplicate: { isRunning: false, error: null },
							delete: { isRunning: false, error: null },
							export: { isRunning: false, error: null },
							import: { isRunning: false, error: null },
							run: { isRunning: false, error: null },
						},
					},
					selectors: [
						{ selector: ProjectSelectors.selectedProjectId, value: 'project-1' },
						{ selector: GridSelectors.selectedProjectGrids, value: [] },
						{ selector: GridSelectors.selectedGridId, value: null },
						{ selector: GridSelectors.duplicateOperation, value: { isRunning: false, error: null } },
						{ selector: GridSelectors.deleteOperation, value: { isRunning: false, error: null } },
						{ selector: GridSelectors.exportOperation, value: { isRunning: false, error: null } },
						{ selector: GridSelectors.importOperation, value: { isRunning: false, error: null } },
					],
				}),
				{ provide: ToastrService, useValue: toastr },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(GridSelectorComponent);
		component = fixture.componentInstance;
		store = TestBed.inject(MockStore);
		fixture.detectChanges();
	});

	it('opens file picker when import is clicked', () => {
		const fileInput = document.createElement('input');
		const clickSpy = vi.spyOn(fileInput, 'click');
		(component as unknown as { onImportClick: (input: HTMLInputElement) => void }).onImportClick(
			fileInput,
		);
		expect(clickSpy).toHaveBeenCalled();
	});

	it('dispatches import requested after valid json file selection', async () => {
		const dispatchSpy = vi.spyOn(store, 'dispatch');
		const file = {
			name: 'imported-grid.json',
			text: vi.fn().mockResolvedValue(
				JSON.stringify({
					grid: {
						id: 'source-grid',
						projectId: 'source-project',
						name: 'Imported Grid',
						description: '',
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
				}),
			),
		} as unknown as File;

		const input = document.createElement('input');
		Object.defineProperty(input, 'files', {
			value: {
				item: (index: number) => (index === 0 ? file : null),
			},
		});

		await (
			component as unknown as { onImportFileChange: (event: Event) => Promise<void> }
		).onImportFileChange({ target: input } as unknown as Event);

		expect(dispatchSpy).toHaveBeenCalled();
		const lastCallArg = dispatchSpy.mock.calls.at(-1)?.[0] as unknown;
		const dispatched = lastCallArg as {
			type: string;
			projectId: string;
			fileName: string;
			dataset: { grid: { name: string } };
		};
		expect(dispatched.type).toBe(GridActions.gridImportRequested.type);
		expect(dispatched.projectId).toBe('project-1');
		expect(dispatched.fileName).toBe('imported-grid.json');
		expect(dispatched.dataset.grid.name).toBe('Imported Grid');
		expect(toastr.error).not.toHaveBeenCalled();
	});
});
