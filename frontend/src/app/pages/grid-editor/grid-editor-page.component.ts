import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { GridSelectorComponent } from '../../components/grid-selector/grid-selector.component';
import { GridEditorSessionService } from '../../services/grid-editor-session.service';
import { ProjectSelectors } from '../../stores/project/project.selectors';
import { GridActions } from '../../stores/grid/grid.actions';
import { GridSelectors } from '../../stores/grid/grid.selectors';
import type { GridDataset } from '../../components/grid-viewer/models/grid.models';
import { getColumnsForPane } from './columns/grid-editor-columns.constants';
import type { PaneId } from './columns/grid-editor-columns.types';

type PaneTab = {
  id: PaneId;
  label: string;
};

type TableCell = string | number;
type TableRow = Record<string, TableCell>;

const PANE_TABS: readonly PaneTab[] = [
  { id: 'buses', label: 'Buses' },
  { id: 'lines', label: 'Lines' },
  { id: 'transformers', label: 'Transformers' },
  { id: 'loads', label: 'Loads' },
  { id: 'generators', label: 'Generators' },
  { id: 'shuntCompensators', label: 'Shunt Compensators' },
];

@Component({
  selector: 'app-grid-editor-page',
  imports: [ReactiveFormsModule, GridSelectorComponent],
  templateUrl: './grid-editor-page.component.html',
  styleUrl: './grid-editor-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridEditorPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);
  private readonly formBuilder = inject(FormBuilder);
  private readonly gridEditorSessionService = inject(GridEditorSessionService);
  private readonly activePaneIdState = signal<PaneId>('buses');

  protected readonly selectedProjectId = this.store.selectSignal(ProjectSelectors.selectedProjectId);
  protected readonly selectedGrid = this.store.selectSignal(GridSelectors.selectedGrid);
  protected readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
  protected readonly gridPageMode = this.store.selectSignal(GridSelectors.editorMode);
  protected readonly isViewMode = this.store.selectSignal(GridSelectors.isViewMode);
  protected readonly isEditingGrid = computed(
    () => this.gridPageMode() === 'edit' && this.selectedGrid() !== null,
  );
  protected readonly isGridEditState = this.store.selectSignal(GridSelectors.isGridEditState);
  protected readonly createGridForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
  });
  protected readonly selectedDataset = computed(() => {
    return this.gridEditorSessionService.getCurrentEditorDataset(this.selectedGridId());
  });

  protected readonly paneTabs = PANE_TABS;
  protected readonly activePaneId = this.activePaneIdState.asReadonly();
  protected readonly activePane = computed(() =>
    this.paneTabs.find((pane) => pane.id === this.activePaneId()) ?? this.paneTabs[0],
  );
  protected readonly paneCounts = computed<Record<PaneId, number>>(() => {
    const dataset = this.selectedDataset();
    if (!dataset) {
      return {
        buses: 0,
        lines: 0,
        transformers: 0,
        loads: 0,
        generators: 0,
        shuntCompensators: 0,
      };
    }
    return {
      buses: dataset.buses.length,
      lines: dataset.lines.length,
      transformers: dataset.transformers.length,
      loads: dataset.loads.length,
      generators: dataset.generators.length,
      shuntCompensators: dataset.shuntCompensators.length,
    };
  });
  protected readonly activePaneColumns = computed(() => getColumnsForPane(this.activePaneId()));
  protected readonly activePaneRows = computed(() => {
    const dataset = this.selectedDataset();
    if (!dataset) {
      return [] as TableRow[];
    }
    return this.getRowsForPane(dataset, this.activePaneId());
  });

  constructor() {
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
      this.gridEditorSessionService.setGridEditorMode(mode);
    });

    this.destroyRef.onDestroy(() => {
      if (this.gridPageMode() !== 'view') {
        this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'view' }));
      }
      this.gridEditorSessionService.clearCreateDraft();
    });
  }

  protected onCreateGridSubmit(): void {
    if (!this.isGridEditState()) {
      return;
    }
    if (this.createGridForm.invalid) {
      this.createGridForm.markAllAsTouched();
      return;
    }
    const projectId = this.selectedProjectId();
    if (!projectId) {
      return;
    }
    const value = this.createGridForm.getRawValue();
    this.store.dispatch(
      GridActions.gridSubmitRequested({
        projectId,
        selectedGridId: this.selectedGridId(),
        isEditing: this.isEditingGrid(),
        name: value.name,
        description: value.description,
      }),
    );
  }

  protected openCreateGridForm(): void {
    this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'create' }));
    this.createGridForm.reset({ name: '', description: '' });
    const projectId = this.selectedProjectId();
    if (projectId) {
      this.gridEditorSessionService.beginCreateDraft(projectId);
    }
  }

  protected openEditGridForm(): void {
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

  protected cancelGridFormChanges(): void {
    this.store.dispatch(GridActions.gridEditorModeSet({ mode: 'view' }));
    this.gridEditorSessionService.clearCreateDraft();
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

  protected setActivePane(paneId: PaneId): void {
    this.activePaneIdState.set(paneId);
  }

  protected getPaneCount(paneId: PaneId): number {
    return this.paneCounts()[paneId];
  }

  private getRowsForPane(dataset: GridDataset, paneId: PaneId): TableRow[] {
    if (paneId === 'buses') {
      return dataset.buses.map((bus) => ({
        id: bus.id,
        name: bus.name,
        nominalVoltageKv: this.formatNumber(bus.nominalVoltageKv, 2),
        busType: bus.busType,
        voltageMagnitudePu: this.formatNumber(bus.voltageMagnitudePu, 4),
        inService: this.formatBoolean(bus.inService),
      }));
    }
    if (paneId === 'lines') {
      return dataset.lines.map((line) => ({
        id: line.id,
        name: line.name,
        fromBusId: line.fromBusId,
        toBusId: line.toBusId,
        ratingMva: this.formatNumber(line.ratingMva, 2),
        inService: this.formatBoolean(line.inService),
      }));
    }
    if (paneId === 'transformers') {
      return dataset.transformers.map((transformer) => ({
        id: transformer.id,
        name: transformer.name,
        fromBusId: transformer.fromBusId,
        toBusId: transformer.toBusId,
        ratingMva: this.formatNumber(transformer.ratingMva, 2),
        tapRatio: this.formatNumber(transformer.tapRatio, 4),
        inService: this.formatBoolean(transformer.inService),
      }));
    }
    if (paneId === 'loads') {
      return dataset.loads.map((load) => ({
        id: load.id,
        name: load.name,
        busId: load.busId,
        activePowerMw: this.formatNumber(load.activePowerMw, 3),
        reactivePowerMvar: this.formatNumber(load.reactivePowerMvar, 3),
        inService: this.formatBoolean(load.inService),
      }));
    }
    if (paneId === 'generators') {
      return dataset.generators.map((generator) => ({
        id: generator.id,
        name: generator.name,
        busId: generator.busId,
        activePowerMw: this.formatNumber(generator.activePowerMw, 3),
        reactivePowerMvar: this.formatNumber(generator.reactivePowerMvar, 3),
        voltagePu: this.formatNumber(generator.voltagePu, 4),
        inService: this.formatBoolean(generator.inService),
      }));
    }
    return dataset.shuntCompensators.map((shunt) => ({
      id: shunt.id,
      name: shunt.name,
      busId: shunt.busId,
      shuntType: shunt.shuntType,
      qMvar: this.formatNumber(shunt.qMvar, 3),
      currentStep: shunt.currentStep,
      inService: this.formatBoolean(shunt.inService),
    }));
  }

  private formatBoolean(value: boolean): string {
    return value ? 'Yes' : 'No';
  }

  private formatNumber(value: number, fractionDigits: number): string {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    });
  }
}
