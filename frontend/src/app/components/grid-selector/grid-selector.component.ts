import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { GridActions } from '../../stores/grid/grid.actions';
import { GridSelectors } from '../../stores/grid/grid.selectors';
import { ProjectSelectors } from '../../stores/project/project.selectors';
import { FormsModule } from '@angular/forms';
import type { GridDataset } from '../grid-viewer/models/grid.models';

@Component({
	selector: 'app-grid-selector',
	templateUrl: './grid-selector.component.html',
	styleUrl: './grid-selector.component.css',
	imports: [FormsModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridSelectorComponent {
	private readonly store = inject(Store);
	private readonly toastr = inject(ToastrService);
	readonly grids = this.store.selectSignal(GridSelectors.selectedProjectGrids);
	readonly selectedProjectId = this.store.selectSignal(ProjectSelectors.selectedProjectId);
	readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
	readonly gridSelectValue = computed(() => this.selectedGridId());
	readonly duplicateOperation = this.store.selectSignal(GridSelectors.duplicateOperation);
	readonly deleteOperation = this.store.selectSignal(GridSelectors.deleteOperation);
	readonly exportOperation = this.store.selectSignal(GridSelectors.exportOperation);
	readonly importOperation = this.store.selectSignal(GridSelectors.importOperation);
	protected readonly hasAvailableGrids = computed(() => this.grids().length > 0);
	protected readonly isAnyActionRunning = computed(
		() =>
			this.duplicateOperation().isRunning ||
			this.deleteOperation().isRunning ||
			this.exportOperation().isRunning ||
			this.importOperation().isRunning,
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
		this.isMenuOpen.update((open) => !open);
	}

	protected onImportClick(fileInput: HTMLInputElement): void {
		if (this.isAnyActionRunning()) {
			return;
		}
		fileInput.value = '';
		fileInput.click();
		this.isMenuOpen.set(false);
	}

	protected async onImportFileChange(event: Event): Promise<void> {
		const projectId = this.selectedProjectId();
		if (!projectId) {
			this.toastr.error('Select a project before importing a grid.', 'Import failed');
			return;
		}
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) {
			return;
		}
		const selectedFile = target.files?.item(0);
		if (!selectedFile) {
			return;
		}
		if (!selectedFile.name.toLowerCase().endsWith('.json')) {
			this.toastr.error('Only JSON files are supported for grid import.', 'Import failed');
			return;
		}
		try {
			const parsed = JSON.parse(await selectedFile.text()) as unknown;
			const dataset = this.parseImportDataset(parsed);
			if (!dataset) {
				this.toastr.error('Invalid grid JSON format.', 'Import failed');
				return;
			}
			this.store.dispatch(
				GridActions.gridImportRequested({
					projectId,
					fileName: selectedFile.name,
					dataset,
				}),
			);
		} catch {
			this.toastr.error('Unable to read JSON file.', 'Import failed');
		}
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

	private parseImportDataset(value: unknown): GridDataset | null {
		if (!this.isRecord(value)) {
			return null;
		}
		const maybeGrid = value['grid'];
		if (!this.isRecord(maybeGrid)) {
			return null;
		}
		const name = maybeGrid['name'];
		if (typeof name !== 'string' || name.trim().length === 0) {
			return null;
		}
		return value as GridDataset;
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null;
	}
}
