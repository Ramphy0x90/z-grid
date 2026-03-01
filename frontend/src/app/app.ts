import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { filter, firstValueFrom } from 'rxjs';
import { Store } from '@ngrx/store';
import { NavbarComponent } from './components/navbar/navbar.component';
import { GridSelectorComponent } from './components/grid-selector/grid-selector.component';
import { LayoutDividerComponent } from './components/layout-divider/layout-divider.component';
import { GridViewerComponent } from './components/grid-viewer/grid-viewer.component';
import type { GridDataset } from './components/grid-viewer/models/grid.models';
import { NavigationActions } from './stores/navigation/navigation.actions';
import { NavigationSelectors } from './stores/navigation/navigation.selectors';
import { ProjectActions } from './stores/project/project.actions';
import { ProjectSelectors } from './stores/project/project.selectors';
import { GridActions } from './stores/grid/grid.actions';
import { GridSelectors } from './stores/grid/grid.selectors';
import { AuthService } from './services/auth.service';
import { ProjectService } from './services/project.service';
import {
	DEFAULT_PROJECT_PAGE,
	PAGE_GROUPS,
	ROUTES,
	toProjectPageCommands,
	toProjectsCommands,
} from './app.routes';

type WorkspaceAction = {
	id: 'save' | 'create' | 'run' | 'edit' | 'cancel';
	label: 'Save' | 'Create' | 'Run' | 'Edit' | 'Cancel';
	disabled?: boolean;
};

@Component({
	selector: 'app-root',
	imports: [
		RouterOutlet,
		ReactiveFormsModule,
		NavbarComponent,
		GridSelectorComponent,
		LayoutDividerComponent,
		GridViewerComponent,
	],
	templateUrl: './app.html',
	styleUrl: './app.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
	private static readonly LAYOUT_PRESETS = [25, 50, 75] as const;
	private static readonly GRID_EDITOR_PAGE_ID = 'grid-editor' as const;
	private static readonly STATIC_CALCULATION_ACTIONS: readonly WorkspaceAction[] = [
		{ id: 'run', label: 'Run' },
	];

	private readonly router = inject(Router);
	private readonly store = inject(Store);
	private readonly authService = inject(AuthService);
	private readonly projectService = inject(ProjectService);
	private readonly layoutSplitPercentState = signal(50);
	private readonly isDividerDraggingState = signal(false);
	private readonly isLoginRouteState = signal(false);
	private readonly isWorkspaceRouteState = signal(false);
	private readonly runInProgressState = signal(false);
	private hasCompletedInitialGridSync = false;

	protected readonly topbarTitle = this.store.selectSignal(NavigationSelectors.topbarTitle);
	protected readonly selectedProjectId = this.store.selectSignal(
		ProjectSelectors.selectedProjectId,
	);
	protected readonly selectedGrid = this.store.selectSignal(GridSelectors.selectedGrid);
	protected readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
	protected readonly selectedPageId = this.store.selectSignal(NavigationSelectors.selectedPageId);
	protected readonly gridPageMode = this.store.selectSignal(GridSelectors.editorMode);
	protected readonly selectedGridDataset = computed(() => {
		const selectedGridId = this.selectedGridId();
		return this.projectService.getCurrentEditorDataset(selectedGridId);
	});
	protected readonly isGridEditorPage = computed(
		() => this.selectedPageId() === App.GRID_EDITOR_PAGE_ID,
	);
	protected readonly layoutSplitPercent = this.layoutSplitPercentState.asReadonly();
	protected readonly isDividerDragging = this.isDividerDraggingState.asReadonly();
	protected readonly layoutPresets = App.LAYOUT_PRESETS;
	protected readonly isLoginRoute = this.isLoginRouteState.asReadonly();
	protected readonly isWorkspaceRoute = this.isWorkspaceRouteState.asReadonly();
	protected readonly runInProgress = this.runInProgressState.asReadonly();
	protected readonly isViewMode = this.store.selectSignal(GridSelectors.isViewMode);
	protected readonly isEditingGrid = computed(
		() => this.gridPageMode() === 'edit' && this.selectedGrid() !== null,
	);
	protected readonly isGridEditState = this.store.selectSignal(GridSelectors.isGridEditState);
	protected readonly createGridForm = new FormGroup({
		name: new FormControl('', {
			nonNullable: true,
			validators: [Validators.required, Validators.maxLength(120)],
		}),
		description: new FormControl('', {
			nonNullable: true,
			validators: [Validators.maxLength(500)],
		}),
	});
	protected readonly shouldShowNavbar = computed(
		() => this.authService.isAuthenticated() && !this.isLoginRouteState(),
	);
	protected readonly shouldRenderWorkspace = computed(
		() => this.isWorkspaceRouteState() && this.authService.isAuthenticated(),
	);
	protected readonly workspaceActions = computed<readonly WorkspaceAction[]>(() => {
		const pageId = this.selectedPageId();
		if (!pageId) {
			return [];
		}
		const pageGroup = PAGE_GROUPS.find((group) =>
			group.children.some((page) => page.id === pageId),
		);
		if (!pageGroup) {
			return [];
		}
		if (pageGroup.id === 'static-calculation') {
			return App.STATIC_CALCULATION_ACTIONS.map((action) => ({
				...action,
				disabled: !this.selectedGridId() || this.runInProgressState(),
			}));
		}
		if (pageId !== App.GRID_EDITOR_PAGE_ID) {
			return [];
		}
		if (this.gridPageMode() === 'view') {
			return [
				{ id: 'edit', label: 'Edit', disabled: !this.selectedGrid() },
				{ id: 'create', label: 'Create' },
			];
		}
		return [
			{ id: 'save', label: 'Save' },
			{ id: 'cancel', label: 'Cancel' },
		];
	});
	protected readonly layoutColumns = computed(() => {
		const left = this.layoutSplitPercentState();
		return `minmax(0, ${left}%) var(--divider-width, 10px) minmax(0, ${100 - left}%)`;
	});

	constructor() {
		let previousAuthenticationState: boolean | undefined;
		effect(() => {
			const isAuthenticated = this.authService.isAuthenticated();
			if (isAuthenticated === previousAuthenticationState) {
				return;
			}
			previousAuthenticationState = isAuthenticated;
			if (isAuthenticated) {
				void this.syncProjectsFromBackend();
				return;
			}
			this.hasCompletedInitialGridSync = false;
			this.store.dispatch(ProjectActions.projectsLoaded({ projects: [] }));
			this.store.dispatch(GridActions.gridsLoaded({ grids: [] }));
		});

		this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
			this.syncRoute();
		});

		let previousSelectedGridId: string | null | undefined;
		effect(() => {
			const selectedGrid = this.selectedGrid();
			const selectedGridId = selectedGrid?.id ?? null;
			if (selectedGridId === previousSelectedGridId) {
				return;
			}
			previousSelectedGridId = selectedGridId;
			if (selectedGrid) {
				this.createGridForm.reset({
					name: selectedGrid.name,
					description: selectedGrid.description,
				});
				return;
			}
			this.createGridForm.reset({ name: '', description: '' });
		});

		let previousGridPageMode: 'view' | 'edit' | 'create' | undefined;
		effect(() => {
			const mode = this.gridPageMode();
			if (mode === previousGridPageMode) {
				return;
			}
			previousGridPageMode = mode;
			this.projectService.setGridEditorMode(mode);
		});

		let previousProjectId: string | null | undefined;
		effect(() => {
			const projectId = this.selectedProjectId();
			if (projectId === previousProjectId) {
				return;
			}
			previousProjectId = projectId;
			void this.syncGridsForProject(projectId);
		});

		let previousDatasetGridId: string | null | undefined;
		effect(() => {
			const selectedGridId = this.selectedGridId();
			if (selectedGridId === previousDatasetGridId) {
				return;
			}
			previousDatasetGridId = selectedGridId;
			if (!selectedGridId) {
				return;
			}
			void this.syncDatasetForGrid(selectedGridId);
		});

		this.syncRoute();
	}

	private async syncProjectsFromBackend(): Promise<void> {
		if (!this.authService.isAuthenticated()) {
			return;
		}
		try {
			const projects = await firstValueFrom(this.projectService.loadProjects());
			this.store.dispatch(ProjectActions.projectsLoaded({ projects }));
			this.ensureValidProjectRoute(projects.map((project) => project.id));
		} catch {
			this.store.dispatch(ProjectActions.projectsLoaded({ projects: [] }));
			this.ensureValidProjectRoute([]);
		}
	}

	private syncRoute(): void {
		const urlTree = this.router.parseUrl(this.router.url);
		const segments =
			urlTree.root.children['primary']?.segments.map((segment) => segment.path) ?? [];
		const [firstSegment, secondSegment] = segments;
		const isLoginRoute = firstSegment === ROUTES.LOGIN;
		const hasPrimarySegment = typeof firstSegment === 'string' && firstSegment.length > 0;
		const isWorkspaceRoute = hasPrimarySegment && !isLoginRoute && firstSegment !== ROUTES.PROJECTS;
		const projectId = isWorkspaceRoute ? firstSegment : null;
		const pageId = secondSegment ?? null;

		this.isLoginRouteState.set(isLoginRoute);
		this.isWorkspaceRouteState.set(isWorkspaceRoute);
		this.store.dispatch(ProjectActions.selectedProjectSynced({ projectId }));
		this.store.dispatch(GridActions.selectedProjectSynced({ projectId }));
		this.store.dispatch(NavigationActions.routeSynced({ pageId }));
		this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'view' }));
	}

	private async syncGridsForProject(projectId: string | null): Promise<void> {
		if (!this.authService.isAuthenticated()) {
			this.store.dispatch(GridActions.gridsLoaded({ grids: [] }));
			return;
		}
		const isInitialProjectGridSync = !this.hasCompletedInitialGridSync;
		this.hasCompletedInitialGridSync = true;
		if (!projectId) {
			this.store.dispatch(GridActions.gridsLoaded({ grids: [] }));
			return;
		}
		try {
			const grids = await firstValueFrom(this.projectService.loadGridsByProjectId(projectId));
			this.store.dispatch(GridActions.gridsLoaded({ grids }));
			if (isInitialProjectGridSync && grids.length > 0) {
				this.store.dispatch(GridActions.gridSelected({ gridId: grids[0].id }));
			}
		} catch {
			this.store.dispatch(GridActions.gridsLoaded({ grids: [] }));
		}
	}

	private async syncDatasetForGrid(gridId: string): Promise<void> {
		if (!this.authService.isAuthenticated()) {
			return;
		}
		try {
			await firstValueFrom(this.projectService.loadGridDatasetById(gridId));
		} catch {
			// Keep current dataset state on transient load failures.
		}
	}

	private ensureValidProjectRoute(validProjectIds: readonly string[]): void {
		const selectedProjectId = this.selectedProjectId();
		if (selectedProjectId && validProjectIds.includes(selectedProjectId)) {
			return;
		}
		if (validProjectIds.length === 0) {
			this.router.navigate([...toProjectsCommands()]);
			return;
		}
		const fallbackProjectId = validProjectIds[0];
		const pageId = this.selectedPageId() ?? DEFAULT_PROJECT_PAGE;
		this.router.navigate([...toProjectPageCommands(fallbackProjectId, pageId)]);
	}

	protected onLayoutSplitChange(nextSplitPercent: number): void {
		this.layoutSplitPercentState.set(nextSplitPercent);
	}

	protected onDividerDraggingChange(isDragging: boolean): void {
		this.isDividerDraggingState.set(isDragging);
	}

	protected onGridDatasetChanged(dataset: GridDataset): void {
		if (this.gridPageMode() === 'create') {
			this.projectService.updateCreateDraftDataset(dataset);
			return;
		}
		const selectedGridId = this.selectedGridId();
		if (!selectedGridId) {
			return;
		}
		this.projectService.updateGridDataset(selectedGridId, dataset);
	}

	protected onWorkspaceAction(actionId: WorkspaceAction['id']): void {
		if (actionId === 'edit') {
			this.openEditGridForm();
			return;
		}
		if (actionId === 'cancel') {
			this.cancelGridFormChanges();
			return;
		}
		if (actionId === 'save') {
			void this.onCreateGridSubmit();
			return;
		}
		if (actionId === 'create') {
			this.openCreateGridForm();
			return;
		}
		if (actionId === 'run') {
			void this.onRunPowerFlowAsync();
		}
	}

	private async onRunPowerFlowAsync(): Promise<void> {
		const projectId = this.selectedProjectId();
		const gridId = this.selectedGridId();
		if (!projectId || !gridId) {
			return;
		}
		this.runInProgressState.set(true);
		try {
			const dataset = this.projectService.getGridDatasetById(gridId);
			if (dataset) {
				await firstValueFrom(this.projectService.saveGridDataset(gridId, dataset));
			}
			await firstValueFrom(this.projectService.startPowerFlowRun(gridId));
			await this.router.navigate([...toProjectPageCommands(projectId, 'power-flow')]);
		} catch {
			// Run state and detailed errors are surfaced in the power-flow page.
		} finally {
			this.runInProgressState.set(false);
		}
	}

	protected async onCreateGridSubmit(): Promise<void> {
		if (!this.isGridEditState()) {
			return;
		}
		if (this.createGridForm.invalid) {
			this.createGridForm.markAllAsTouched();
			return;
		}
		const projectId = this.selectedProjectId();
		if (!projectId || !this.projectService.projectExists(projectId)) {
			return;
		}
		const value = this.createGridForm.getRawValue();
		if (this.isEditingGrid()) {
			const selectedGridId = this.selectedGridId();
			if (!selectedGridId) {
				return;
			}
			const updatedGrid = this.projectService.updateGrid(selectedGridId, {
				name: value.name,
				description: value.description,
			});
			let updatedResult = null;
			try {
				updatedResult = await firstValueFrom(updatedGrid);
			} catch {
				return;
			}
			const dataset = this.projectService.getGridDatasetById(selectedGridId);
			if (dataset) {
				try {
					await firstValueFrom(this.projectService.saveGridDataset(selectedGridId, dataset));
				} catch {
					return;
				}
			}
			if (updatedResult) {
				this.store.dispatch(GridActions.gridsLoaded({ grids: this.projectService.grids() }));
				this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'view' }));
			}
			return;
		}
		let createdGrid;
		try {
			createdGrid = await firstValueFrom(
				this.projectService.createGrid(projectId, {
					name: value.name,
					description: value.description,
				}),
			);
		} catch {
			return;
		}
		const draftDataset = this.projectService.getCreateDraftDataset();
		if (draftDataset) {
			const datasetToPersist: GridDataset = {
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
			};
			try {
				await firstValueFrom(this.projectService.saveGridDataset(createdGrid.id, datasetToPersist));
			} catch {
				return;
			}
		}
		this.store.dispatch(GridActions.gridDuplicated({ duplicatedGrid: createdGrid }));
		this.projectService.clearCreateDraft();
		this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'view' }));
	}

	private openCreateGridForm(): void {
		this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'create' }));
		this.createGridForm.reset({ name: '', description: '' });
		const projectId = this.selectedProjectId();
		if (projectId) {
			this.projectService.beginCreateDraft(projectId);
		}
	}

	private openEditGridForm(): void {
		const selectedGrid = this.selectedGrid();
		if (!selectedGrid) {
			return;
		}
		this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'edit' }));
		this.createGridForm.reset({
			name: selectedGrid.name,
			description: selectedGrid.description,
		});
	}

	private cancelGridFormChanges(): void {
		this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'view' }));
		this.projectService.clearCreateDraft();
		const selectedGrid = this.selectedGrid();
		if (!selectedGrid) {
			this.createGridForm.reset({ name: '', description: '' });
			return;
		}
		this.createGridForm.reset({
			name: selectedGrid.name,
			description: selectedGrid.description,
		});
	}

}
