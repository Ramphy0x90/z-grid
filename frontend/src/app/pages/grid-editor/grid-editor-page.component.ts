import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { ProjectService } from '../../services/project.service';
import { GridSelectors } from '../../stores/grid/grid.selectors';
import type { GridDataset } from '../../components/grid-viewer/models/grid.models';

type PaneId =
  | 'buses'
  | 'lines'
  | 'transformers'
  | 'loads'
  | 'generators'
  | 'shuntCompensators';

type PaneTab = {
  id: PaneId;
  label: string;
};

type TableColumn = {
  key: string;
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
  templateUrl: './grid-editor-page.component.html',
  styleUrl: './grid-editor-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridEditorPageComponent {
  private readonly store = inject(Store);
  private readonly projectService = inject(ProjectService);
  private readonly activePaneIdState = signal<PaneId>('buses');

  protected readonly selectedGrid = this.store.selectSignal(GridSelectors.selectedGrid);
  protected readonly selectedDataset = computed(() => {
    const grid = this.selectedGrid();
    if (!grid) {
      return null;
    }
    return this.projectService.getGridDatasetById(grid.id);
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
  protected readonly activePaneColumns = computed(() => this.getColumnsForPane(this.activePaneId()));
  protected readonly activePaneRows = computed(() => {
    const dataset = this.selectedDataset();
    if (!dataset) {
      return [] as TableRow[];
    }
    return this.getRowsForPane(dataset, this.activePaneId());
  });

  protected setActivePane(paneId: PaneId): void {
    this.activePaneIdState.set(paneId);
  }

  protected getPaneCount(paneId: PaneId): number {
    return this.paneCounts()[paneId];
  }

  private getColumnsForPane(paneId: PaneId): readonly TableColumn[] {
    if (paneId === 'buses') {
      return [
        { key: 'name', label: 'Name' },
        { key: 'nominalVoltageKv', label: 'Nominal kV' },
        { key: 'busType', label: 'Type' },
        { key: 'voltageMagnitudePu', label: 'Voltage p.u.' },
        { key: 'inService', label: 'In Service' },
      ];
    }
    if (paneId === 'lines') {
      return [
        { key: 'name', label: 'Name' },
        { key: 'fromBusId', label: 'From Bus' },
        { key: 'toBusId', label: 'To Bus' },
        { key: 'ratingMva', label: 'Rating MVA' },
        { key: 'inService', label: 'In Service' },
      ];
    }
    if (paneId === 'transformers') {
      return [
        { key: 'name', label: 'Name' },
        { key: 'fromBusId', label: 'From Bus' },
        { key: 'toBusId', label: 'To Bus' },
        { key: 'ratingMva', label: 'Rating MVA' },
        { key: 'tapRatio', label: 'Tap Ratio' },
        { key: 'inService', label: 'In Service' },
      ];
    }
    if (paneId === 'loads') {
      return [
        { key: 'name', label: 'Name' },
        { key: 'busId', label: 'Bus' },
        { key: 'activePowerMw', label: 'P MW' },
        { key: 'reactivePowerMvar', label: 'Q MVAR' },
        { key: 'inService', label: 'In Service' },
      ];
    }
    if (paneId === 'generators') {
      return [
        { key: 'name', label: 'Name' },
        { key: 'busId', label: 'Bus' },
        { key: 'activePowerMw', label: 'P MW' },
        { key: 'reactivePowerMvar', label: 'Q MVAR' },
        { key: 'voltagePu', label: 'Voltage p.u.' },
        { key: 'inService', label: 'In Service' },
      ];
    }
    return [
      { key: 'name', label: 'Name' },
      { key: 'busId', label: 'Bus' },
      { key: 'shuntType', label: 'Type' },
      { key: 'qMvar', label: 'Q MVAR' },
      { key: 'currentStep', label: 'Step' },
      { key: 'inService', label: 'In Service' },
    ];
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
