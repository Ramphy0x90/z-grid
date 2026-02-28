import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { ProjectGrid } from '../../services/project.service';

@Component({
  selector: 'app-grid-selector',
  templateUrl: './grid-selector.component.html',
  styleUrl: './grid-selector.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridSelectorComponent {
  readonly grids = input<readonly ProjectGrid[]>([]);
  readonly selectedGridId = input<string>('');
  readonly label = input('Grid');
  readonly selectionChange = output<string>();
  readonly exportRequested = output<string>();
  readonly duplicateRequested = output<string>();
  readonly deleteRequested = output<string>();
  protected readonly hasAvailableGrids = computed(() => this.grids().length > 0);
  protected readonly isMenuOpen = signal(false);

  protected onGridChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    const gridId = target.value;
    if (!gridId) {
      return;
    }
    this.selectionChange.emit(gridId);
  }

  protected toggleMenu(): void {
    if (!this.hasAvailableGrids()) {
      return;
    }
    this.isMenuOpen.update((open) => !open);
  }

  protected onDuplicateClick(): void {
    const selectedGridId = this.selectedGridId();
    if (!selectedGridId) {
      return;
    }
    this.duplicateRequested.emit(selectedGridId);
    this.isMenuOpen.set(false);
  }

  protected onExportClick(): void {
    const selectedGridId = this.selectedGridId();
    if (!selectedGridId) {
      return;
    }
    this.exportRequested.emit(selectedGridId);
    this.isMenuOpen.set(false);
  }

  protected onDeleteClick(): void {
    const selectedGridId = this.selectedGridId();
    if (!selectedGridId) {
      return;
    }
    this.deleteRequested.emit(selectedGridId);
    this.isMenuOpen.set(false);
  }

  protected onMenuFocusOut(event: FocusEvent): void {
    const currentTarget = event.currentTarget;
    if (!(currentTarget instanceof HTMLElement)) {
      return;
    }
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && currentTarget.contains(nextTarget)) {
      return;
    }
    this.isMenuOpen.set(false);
  }
}
