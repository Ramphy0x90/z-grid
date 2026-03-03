import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { GridActions } from '../../stores/grid/grid.actions';
import { GridSelectors } from '../../stores/grid/grid.selectors';
import { FormsModule } from '@angular/forms';

@Component({
	selector: 'app-grid-selector',
	templateUrl: './grid-selector.component.html',
	styleUrl: './grid-selector.component.css',
	imports: [FormsModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridSelectorComponent {
	private readonly store = inject(Store);
	readonly grids = this.store.selectSignal(GridSelectors.selectedProjectGrids);
	readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
	readonly gridSelectValue = computed(() => this.selectedGridId());
	readonly duplicateOperation = this.store.selectSignal(GridSelectors.duplicateOperation);
	readonly deleteOperation = this.store.selectSignal(GridSelectors.deleteOperation);
	readonly exportOperation = this.store.selectSignal(GridSelectors.exportOperation);
	protected readonly hasAvailableGrids = computed(() => this.grids().length > 0);
	protected readonly isAnyActionRunning = computed(
		() =>
			this.duplicateOperation().isRunning ||
			this.deleteOperation().isRunning ||
			this.exportOperation().isRunning,
	);
	protected readonly isMenuOpen = signal(false);

	protected onGridModelChange(value: string | null): void {
		const gridId = value ?? '';
		if (!gridId) {
			return;
		}
		this.store.dispatch(GridActions.gridSelected({ gridId }));
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
		this.store.dispatch(GridActions.gridDuplicateRequested({ gridId: selectedGridId }));
		this.isMenuOpen.set(false);
	}

	protected onExportClick(): void {
		const selectedGridId = this.selectedGridId();
		if (!selectedGridId) {
			return;
		}
		this.store.dispatch(GridActions.gridExportRequested({ gridId: selectedGridId }));
		this.isMenuOpen.set(false);
	}

	protected onDeleteClick(): void {
		const selectedGridId = this.selectedGridId();
		if (!selectedGridId) {
			return;
		}
		this.store.dispatch(GridActions.gridDeleteRequested({ gridId: selectedGridId }));
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
