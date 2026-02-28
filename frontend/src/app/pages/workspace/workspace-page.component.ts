import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
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
  private static readonly LAYOUT_PRESETS = [25, 50, 75] as const;

  @ViewChild('workspacePanels', { static: true })
  private readonly workspacePanelsRef?: ElementRef<HTMLElement>;
  @ViewChild('layoutDivider', { static: true })
  private readonly layoutDividerRef?: ElementRef<HTMLButtonElement>;

  private readonly layoutSplitPercentState = signal(50);
  private readonly isDividerDraggingState = signal(false);
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
  protected readonly layoutSplitPercent = this.layoutSplitPercentState.asReadonly();
  protected readonly isDividerDragging = this.isDividerDraggingState.asReadonly();
  protected readonly layoutValueText = computed(() => {
    const left = Math.round(this.layoutSplitPercentState());
    return `${left}% page, ${100 - left}% grid viewer`;
  });
  protected readonly layoutColumns = computed(() => {
    const left = this.layoutSplitPercentState();
    return `minmax(0, ${left}%) var(--divider-width, 10px) minmax(0, ${100 - left}%)`;
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

  protected startDividerDrag(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    const divider = this.layoutDividerRef?.nativeElement;
    if (!divider) {
      return;
    }

    divider.setPointerCapture(event.pointerId);
    this.isDividerDraggingState.set(true);
    this.updateSplitFromClientX(event.clientX);
  }

  protected dragDivider(event: PointerEvent): void {
    if (!this.isDividerDraggingState()) {
      return;
    }
    this.updateSplitFromClientX(event.clientX);
  }

  protected endDividerDrag(event: PointerEvent): void {
    if (!this.isDividerDraggingState()) {
      return;
    }

    const divider = this.layoutDividerRef?.nativeElement;
    if (divider?.hasPointerCapture(event.pointerId)) {
      divider.releasePointerCapture(event.pointerId);
    }

    this.isDividerDraggingState.set(false);
    this.snapToNearestPreset();
  }

  protected onDividerKeydown(event: KeyboardEvent): void {
    const current = this.layoutSplitPercentState();
    let nextPreset: number | null = null;

    if (event.key === 'ArrowLeft') {
      nextPreset = this.findPreviousPreset(current);
    } else if (event.key === 'ArrowRight') {
      nextPreset = this.findNextPreset(current);
    } else if (event.key === 'Home') {
      nextPreset = WorkspacePageComponent.LAYOUT_PRESETS[0];
    } else if (event.key === 'End') {
      nextPreset = WorkspacePageComponent.LAYOUT_PRESETS[WorkspacePageComponent.LAYOUT_PRESETS.length - 1];
    }

    if (nextPreset === null) {
      return;
    }

    event.preventDefault();
    this.layoutSplitPercentState.set(nextPreset);
  }

  private updateSplitFromClientX(clientX: number): void {
    const panels = this.workspacePanelsRef?.nativeElement;
    if (!panels) {
      return;
    }

    const bounds = panels.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const dividerWidth = this.getDividerWidth(panels);
    const usableWidth = bounds.width - dividerWidth;
    if (usableWidth <= 0) {
      return;
    }

    const leftPercent = ((clientX - bounds.left - dividerWidth / 2) / usableWidth) * 100;
    this.layoutSplitPercentState.set(this.clamp(leftPercent, 20, 80));
  }

  private snapToNearestPreset(): void {
    const current = this.layoutSplitPercentState();
    const nearest = WorkspacePageComponent.LAYOUT_PRESETS.reduce((closest, preset) =>
      Math.abs(preset - current) < Math.abs(closest - current) ? preset : closest,
    );
    this.layoutSplitPercentState.set(nearest);
  }

  private findPreviousPreset(current: number): number | null {
    const previous = WorkspacePageComponent.LAYOUT_PRESETS.filter((preset) => preset < current);
    return previous.length > 0 ? previous[previous.length - 1] : null;
  }

  private findNextPreset(current: number): number | null {
    const next = WorkspacePageComponent.LAYOUT_PRESETS.filter((preset) => preset > current);
    return next.length > 0 ? next[0] : null;
  }

  private getDividerWidth(panels: HTMLElement): number {
    const widthValue = getComputedStyle(panels).getPropertyValue('--divider-width').trim();
    const parsed = Number.parseFloat(widthValue);
    return Number.isFinite(parsed) ? parsed : 10;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
