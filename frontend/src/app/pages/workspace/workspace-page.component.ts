import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '@ngrx/store';
import {
  DEFAULT_PROJECT_PAGE,
  PAGES,
  ROUTE_PARAMS,
  toProjectPageCommands,
} from '../../app.routes';
import { ProjectSelectors } from '../../stores/project/project.selectors';
import { GridViewerComponent } from '../../components/grid-viewer/grid-viewer.component';

@Component({
  selector: 'app-workspace-page',
  imports: [GridViewerComponent],
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspacePageComponent {
  private readonly layoutPresetState = signal<'1-3' | '2-2' | '3-1'>('2-2');
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly projects = this.store.selectSignal(ProjectSelectors.projects);

  private readonly projectId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get(ROUTE_PARAMS.PROJECT_ID) ?? '')),
    { initialValue: '' },
  );
  private readonly pageId = toSignal(
    this.route.data.pipe(map((data) => (data['pageId'] as string | undefined) ?? '')),
    { initialValue: '' },
  );

  protected readonly project = computed(
    () => this.projects().find((project) => project.id === this.projectId()) ?? null,
  );
  protected readonly page = computed(() => PAGES.find((page) => page.id === this.pageId()) ?? null);
  protected readonly layoutPreset = this.layoutPresetState.asReadonly();
  protected readonly layoutColumns = computed(() => {
    const preset = this.layoutPresetState();
    if (preset === '1-3') {
      return 'minmax(0, 1fr) minmax(0, 3fr)';
    }
    if (preset === '3-1') {
      return 'minmax(0, 3fr) minmax(0, 1fr)';
    }
    return 'minmax(0, 2fr) minmax(0, 2fr)';
  });

  constructor() {
    const currentProjectId = this.route.snapshot.paramMap.get(ROUTE_PARAMS.PROJECT_ID) ?? '';
    const currentPageId = (this.route.snapshot.data['pageId'] as string | undefined) ?? '';
    const projectExists = this.projects().some((project) => project.id === currentProjectId);
    const pageExists = PAGES.some((page) => page.id === currentPageId);

    if (!projectExists) {
      this.router.navigate(['/projects']);
      return;
    }

    if (!pageExists) {
      this.router.navigate([...toProjectPageCommands(currentProjectId, DEFAULT_PROJECT_PAGE)]);
    }
  }

  protected setLayoutPreset(preset: '1-3' | '2-2' | '3-1'): void {
    this.layoutPresetState.set(preset);
  }
}
