import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	computed,
	effect,
	inject,
	signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, take } from 'rxjs';
import { Store } from '@ngrx/store';
import { NavbarComponent } from './components/navbar/navbar.component';
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
import { GridEditorSessionService } from './services/grid-editor-session.service';
import { ProjectService } from './services/project.service';
import { WorkspaceDataSyncService } from './services/workspace-data-sync.service';
import { WorkspaceRouteService } from './services/workspace-route.service';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, NavbarComponent, LayoutDividerComponent, GridViewerComponent],
	templateUrl: './app.html',
	styleUrl: './app.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
	private static readonly LAYOUT_PRESETS = [25, 50, 75] as const;

	private readonly router = inject(Router);
	private readonly destroyRef = inject(DestroyRef);
	private readonly store = inject(Store);
	private readonly authService = inject(AuthService);
	private readonly gridEditorSessionService = inject(GridEditorSessionService);
	private readonly projectService = inject(ProjectService);
	private readonly workspaceDataSyncService = inject(WorkspaceDataSyncService);
	private readonly workspaceRouteService = inject(WorkspaceRouteService);
	private readonly layoutSplitPercentState = signal(50);
	private readonly isDividerDraggingState = signal(false);
	private readonly isLoginRouteState = signal(false);
	private readonly isWorkspaceRouteState = signal(false);

	protected readonly selectedProjectId = this.store.selectSignal(
		ProjectSelectors.selectedProjectId,
	);
	protected readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
	protected readonly selectedPageId = this.store.selectSignal(NavigationSelectors.selectedPageId);
	protected readonly gridPageMode = this.store.selectSignal(GridSelectors.editorMode);
	protected readonly selectedGridDataset = computed(() => {
		const selectedGridId = this.selectedGridId();
		return this.gridEditorSessionService.getCurrentEditorDataset(selectedGridId);
	});
	protected readonly layoutSplitPercent = this.layoutSplitPercentState.asReadonly();
	protected readonly isDividerDragging = this.isDividerDraggingState.asReadonly();
	protected readonly layoutPresets = App.LAYOUT_PRESETS;
	protected readonly isLoginRoute = this.isLoginRouteState.asReadonly();
	protected readonly isWorkspaceRoute = this.isWorkspaceRouteState.asReadonly();
	protected readonly shouldShowNavbar = computed(
		() => this.authService.isAuthenticated() && !this.isLoginRouteState(),
	);
	protected readonly shouldRenderWorkspace = computed(
		() => this.isWorkspaceRouteState() && this.authService.isAuthenticated(),
	);
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
				this.syncProjectsFromBackend();
				return;
			}
			this.workspaceDataSyncService.resetSessionState();
			this.store.dispatch(ProjectActions.projectsLoaded({ projects: [] }));
			this.store.dispatch(GridActions.gridsLoaded({ grids: [] }));
		});

		this.router.events
			.pipe(
				filter((event) => event instanceof NavigationEnd),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe(() => {
				this.syncRoute();
			});

		let previousProjectId: string | null | undefined;
		effect(() => {
			const projectId = this.selectedProjectId();
			if (projectId === previousProjectId) {
				return;
			}
			previousProjectId = projectId;
			this.syncGridsForProject(projectId);
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
			this.syncDatasetForGrid(selectedGridId);
		});

		this.syncRoute();
	}

	private syncProjectsFromBackend(): void {
		this.workspaceDataSyncService
			.syncProjects$()
			.pipe(take(1), takeUntilDestroyed(this.destroyRef))
			.subscribe((projects) => {
				const routeState = this.workspaceRouteService.readCurrentRoute();
				this.store.dispatch(ProjectActions.projectsLoaded({ projects }));
				if (!routeState.isWorkspaceRoute) {
					return;
				}
				this.workspaceRouteService.ensureValidProjectRoute(
					projects.map((project) => project.id),
					routeState.projectId,
					routeState.pageId,
				);
			});
	}

	private syncRoute(): void {
		const routeState = this.workspaceRouteService.readCurrentRoute();
		this.isLoginRouteState.set(routeState.isLoginRoute);
		this.isWorkspaceRouteState.set(routeState.isWorkspaceRoute);
		this.store.dispatch(ProjectActions.selectedProjectSynced({ projectId: routeState.projectId }));
		this.store.dispatch(GridActions.selectedProjectSynced({ projectId: routeState.projectId }));
		this.store.dispatch(NavigationActions.routeSynced({ pageId: routeState.pageId }));
		this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'view' }));
	}

	private syncGridsForProject(projectId: string | null): void {
		this.workspaceDataSyncService
			.syncGridsForProject$(projectId)
			.pipe(take(1), takeUntilDestroyed(this.destroyRef))
			.subscribe((result) => {
				if (result.stale) {
					return;
				}
				this.store.dispatch(GridActions.gridsLoaded({ grids: result.grids }));
				if (result.shouldSelectFirst) {
					this.store.dispatch(GridActions.gridSelected({ gridId: result.grids[0].id }));
				}
			});
	}

	private syncDatasetForGrid(gridId: string): void {
		this.workspaceDataSyncService
			.syncDatasetForGrid$(gridId)
			.pipe(take(1), takeUntilDestroyed(this.destroyRef))
			.subscribe();
	}

	protected onLayoutSplitChange(nextSplitPercent: number): void {
		this.layoutSplitPercentState.set(nextSplitPercent);
	}

	protected onDividerDraggingChange(isDragging: boolean): void {
		this.isDividerDraggingState.set(isDragging);
	}

	protected onGridDatasetChanged(dataset: GridDataset): void {
		if (this.gridPageMode() === 'create') {
			this.gridEditorSessionService.updateCreateDraftDataset(dataset);
			return;
		}
		const selectedGridId = this.selectedGridId();
		if (!selectedGridId) {
			return;
		}
		this.projectService.updateGridDataset(selectedGridId, dataset);
	}
}
