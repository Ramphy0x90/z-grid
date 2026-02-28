import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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
  protected readonly hasAvailableGrids = computed(() => this.grids().length > 0);

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
}
