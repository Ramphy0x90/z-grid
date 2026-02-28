import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Store } from '@ngrx/store';
import { NavbarComponent } from './components/navbar/navbar.component';
import { GridSelectorComponent } from './components/grid-selector/grid-selector.component';
import { LayoutDividerComponent } from './components/layout-divider/layout-divider.component';
import { GridViewerComponent } from './components/grid-viewer/grid-viewer.component';
import { NavigationActions } from './stores/navigation/navigation.actions';
import { NavigationSelectors } from './stores/navigation/navigation.selectors';
import { ProjectActions } from './stores/project/project.actions';
import { ProjectSelectors } from './stores/project/project.selectors';
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
  private readonly projectService = inject(ProjectService);
  private readonly layoutSplitPercentState = signal(60);
  private readonly isDividerDraggingState = signal(false);
  private readonly isProjectsRouteState = signal(true);

  protected readonly topbarTitle = this.store.selectSignal(NavigationSelectors.topbarTitle);
  protected readonly selectedProjectGrids = this.store.selectSignal(ProjectSelectors.selectedProjectGrids);
  protected readonly selectedGrid = this.store.selectSignal(ProjectSelectors.selectedGrid);
  protected readonly selectedGridId = computed(() => this.selectedGrid()?.id ?? '');
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
  protected readonly isProjectsRoute = this.isProjectsRouteState.asReadonly();
  protected readonly layoutColumns = computed(() => {
    const left = this.layoutSplitPercentState();
    return `minmax(0, ${left}%) var(--divider-width, 10px) minmax(0, ${100 - left}%)`;
  });

  constructor() {
    this.store.dispatch(
      ProjectActions.projectsLoaded({ projects: this.projectService.projects() }),
    );
    this.store.dispatch(ProjectActions.gridsLoaded({ grids: this.projectService.grids() }));

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.syncRoute();
    });

    this.syncRoute();
  }

  private syncRoute(): void {
    const urlTree = this.router.parseUrl(this.router.url);
    const segments =
      urlTree.root.children['primary']?.segments.map((segment) => segment.path) ?? [];
    const [firstSegment, secondSegment] = segments;
    const isProjectsRoute = !firstSegment || firstSegment === ROUTES.PROJECTS;
    const projectId = !firstSegment || firstSegment === ROUTES.PROJECTS ? null : firstSegment;
    const pageId = secondSegment ?? null;

    this.isProjectsRouteState.set(isProjectsRoute);
    this.store.dispatch(ProjectActions.selectedProjectSynced({ projectId }));
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
    this.store.dispatch(ProjectActions.gridSelected({ gridId }));
  }
}
