import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { Store } from '@ngrx/store';
import { NavbarComponent } from './components/navbar/navbar.component';
import { GridSelectorComponent } from './components/grid-selector/grid-selector.component';
import { LayoutDividerComponent } from './components/layout-divider/layout-divider.component';
import { GridViewerComponent } from './components/grid-viewer/grid-viewer.component';
import { NavigationActions } from './stores/navigation/navigation.actions';
import { NavigationSelectors } from './stores/navigation/navigation.selectors';
import { ProjectActions } from './stores/project/project.actions';
import { ProjectSelectors } from './stores/project/project.selectors';
import { GridActions } from './stores/grid/grid.actions';
import { GridSelectors } from './stores/grid/grid.selectors';
import { AuthService } from './services/auth.service';
import { ProjectService } from './services/project.service';
import { ROUTES } from './app.routes';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
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

  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly authService = inject(AuthService);
  private readonly projectService = inject(ProjectService);
  private readonly layoutSplitPercentState = signal(50);
  private readonly isDividerDraggingState = signal(false);
  private readonly isLoginRouteState = signal(false);
  private readonly isWorkspaceRouteState = signal(false);

  protected readonly topbarTitle = this.store.selectSignal(NavigationSelectors.topbarTitle);
  protected readonly selectedProjectId = this.store.selectSignal(ProjectSelectors.selectedProjectId);
  protected readonly selectedProjectGrids = this.store.selectSignal(GridSelectors.selectedProjectGrids);
  protected readonly selectedGrid = this.store.selectSignal(GridSelectors.selectedGrid);
  protected readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
  protected readonly selectedGridDataset = computed(() => {
    const grid = this.selectedGrid();
    if (!grid) {
      return null;
    }
    return this.projectService.getGridDatasetById(grid.id);
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
    this.store.dispatch(GridActions.gridsLoaded({ grids: this.projectService.grids() }));
    void this.syncProjectsFromBackend();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.syncRoute();
    });

    this.syncRoute();
  }

  private async syncProjectsFromBackend(): Promise<void> {
    try {
      const projects = await firstValueFrom(this.projectService.loadProjects());
      this.store.dispatch(ProjectActions.projectsLoaded({ projects }));
    } catch {
      this.store.dispatch(ProjectActions.projectsLoaded({ projects: [] }));
    }
  }

  private syncRoute(): void {
    const urlTree = this.router.parseUrl(this.router.url);
    const segments =
      urlTree.root.children['primary']?.segments.map((segment) => segment.path) ?? [];
    const [firstSegment, secondSegment] = segments;
    const isLoginRoute = firstSegment === ROUTES.LOGIN;
    const hasPrimarySegment = typeof firstSegment === 'string' && firstSegment.length > 0;
    const isWorkspaceRoute =
      hasPrimarySegment && !isLoginRoute && firstSegment !== ROUTES.PROJECTS;
    const projectId = isWorkspaceRoute ? firstSegment : null;
    const pageId = secondSegment ?? null;

    this.isLoginRouteState.set(isLoginRoute);
    this.isWorkspaceRouteState.set(isWorkspaceRoute);
    this.store.dispatch(ProjectActions.selectedProjectSynced({ projectId }));
    this.store.dispatch(GridActions.selectedProjectSynced({ projectId }));
    this.store.dispatch(NavigationActions.routeSynced({ pageId }));
  }

  protected onLayoutSplitChange(nextSplitPercent: number): void {
    this.layoutSplitPercentState.set(nextSplitPercent);
  }

  protected onDividerDraggingChange(isDragging: boolean): void {
    this.isDividerDraggingState.set(isDragging);
  }

  protected onGridSelected(gridId: string): void {
    if (!gridId) {
      return;
    }
    this.store.dispatch(GridActions.gridSelected({ gridId }));
  }

  protected onGridDuplicate(gridId: string): void {
    const duplicatedGrid = this.projectService.duplicateGrid(gridId);
    if (!duplicatedGrid) {
      return;
    }
    this.store.dispatch(GridActions.gridDuplicated({ duplicatedGrid }));
  }

  protected onGridDelete(gridId: string): void {
    if (!this.projectService.deleteGrid(gridId)) {
      return;
    }
    const projectId = this.selectedProjectId();
    const nextSelectedGridId = projectId
      ? this.projectService.getGridsByProjectId(projectId)[0]?.id ?? null
      : null;
    this.store.dispatch(GridActions.gridDeleted({ gridId, nextSelectedGridId }));
  }
}
