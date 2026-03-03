import { Injectable, computed, signal } from '@angular/core';
import type { GridColorMode, GridDataset } from '../models/grid.models';
import { normalizeGridDataset } from '../data/grid-normalizer';

export type ViewportState = {
  centerX: number;
  centerY: number;
  zoom: number;
};

export type SelectedElement = {
  kind: 'bus' | 'line' | 'transformer' | 'load' | 'generator' | 'shunt';
  id: string;
} | null;

export type PlacementTool = 'bus' | 'line' | 'transformer' | 'load' | 'generator' | 'shunt' | null;

const EMPTY_DATASET: GridDataset = {
  grid: {
    id: 'empty-grid',
    projectId: 'empty-project',
    name: 'Empty Grid',
    description: '',
    baseMva: 100,
    frequencyHz: 50,
  },
  buses: [],
  lines: [],
  transformers: [],
  loads: [],
  generators: [],
  shuntCompensators: [],
  busLayout: [],
  edgeLayout: [],
};

@Injectable()
export class GridViewerFacade {
  private readonly datasetState = signal<GridDataset>(EMPTY_DATASET);
  private readonly mapViewportState = signal<ViewportState>({ centerX: 0, centerY: 0, zoom: 1 });
  private readonly schematicViewportState = signal<ViewportState>({ centerX: 0, centerY: 0, zoom: 1 });
  private readonly selectedElementState = signal<SelectedElement>(null);
  private readonly hoveredElementState = signal<SelectedElement>(null);
  private readonly placementModeState = signal<PlacementTool>(null);
  private readonly colorModeState = signal<GridColorMode>('energized');

  readonly dataset = this.datasetState.asReadonly();
  readonly normalizedGraph = computed(() =>
    normalizeGridDataset(this.datasetState(), this.colorModeState()),
  );
  readonly mapViewport = this.mapViewportState.asReadonly();
  readonly schematicViewport = this.schematicViewportState.asReadonly();
  readonly selectedElement = this.selectedElementState.asReadonly();
  readonly hoveredElement = this.hoveredElementState.asReadonly();
  readonly placementMode = this.placementModeState.asReadonly();
  readonly colorMode = this.colorModeState.asReadonly();
  readonly stats = computed(() => {
    const dataset = this.datasetState();
    return {
      buses: dataset.buses.length,
      lines: dataset.lines.length,
      transformers: dataset.transformers.length,
      loads: dataset.loads.length,
      generators: dataset.generators.length,
      shunts: dataset.shuntCompensators.length,
    };
  });
  readonly totalElements = computed(() => {
    const dataset = this.datasetState();
    return (
      dataset.buses.length +
      dataset.lines.length +
      dataset.transformers.length +
      dataset.loads.length +
      dataset.generators.length +
      dataset.shuntCompensators.length
    );
  });

  setDataset(dataset: GridDataset): void {
		this.datasetState.set(this.normalizeDataset(dataset));
    this.selectedElementState.set(null);
    this.hoveredElementState.set(null);
    this.placementModeState.set(null);
  }

  clearDataset(): void {
    this.datasetState.set(EMPTY_DATASET);
    this.selectedElementState.set(null);
    this.hoveredElementState.set(null);
    this.placementModeState.set(null);
  }

	updateDataset(dataset: GridDataset): void {
		this.datasetState.set(this.normalizeDataset(dataset));
	}

  setMapViewport(viewport: ViewportState): void {
    this.mapViewportState.set(viewport);
  }

  setSchematicViewport(viewport: ViewportState): void {
    this.schematicViewportState.set(viewport);
  }

  selectElement(element: SelectedElement): void {
    this.selectedElementState.set(element);
  }

  hoverElement(element: SelectedElement): void {
    this.hoveredElementState.set(element);
  }

  clearSelection(): void {
    this.selectedElementState.set(null);
  }

  setPlacementMode(mode: PlacementTool): void {
    this.placementModeState.set(mode);
  }

  setColorMode(mode: GridColorMode): void {
    this.colorModeState.set(mode);
  }

  addBusAt(layout: { mapX: number; mapY: number; schematicX: number; schematicY: number }): string {
    const dataset = this.datasetState();
    const numericIndex = this.createNumericIndex(dataset.buses.map((item) => item.id), 'bus-');
    const id = this.createUniqueId(dataset.buses.map((item) => item.id), 'bus-', numericIndex);
    const name = `Bus ${numericIndex}`;
    const newDataset: GridDataset = {
      ...dataset,
      buses: [
        ...dataset.buses,
        {
          id,
          gridId: dataset.grid.id,
          name,
          nominalVoltageKv: 110,
          busType: 'PQ',
          voltageMagnitudePu: 1,
          voltageAngleDeg: 0,
          minVoltagePu: 0.95,
          maxVoltagePu: 1.05,
          inService: true,
          area: 'Default',
          zone: 'Default',
        },
      ],
      busLayout: [
        ...dataset.busLayout,
        {
          busId: id,
          lat: layout.mapY,
          lng: layout.mapX,
          schematicX: layout.schematicX,
          schematicY: layout.schematicY,
        },
      ],
    };
    this.datasetState.set(newDataset);
    return id;
  }

  addLoadAtBus(busId: string): string {
    const dataset = this.datasetState();
    const numericIndex = this.createNumericIndex(dataset.loads.map((item) => item.id), 'load-');
    const id = this.createUniqueId(dataset.loads.map((item) => item.id), 'load-', numericIndex);
    const newDataset: GridDataset = {
      ...dataset,
      loads: [
        ...dataset.loads,
        {
          id,
          busId,
          name: `Load ${numericIndex}`,
          activePowerMw: 25,
          reactivePowerMvar: 8,
          inService: true,
          loadType: 'PQ',
          scalingFactor: 1,
        },
      ],
    };
    this.datasetState.set(newDataset);
    return id;
  }

  addGeneratorAtBus(busId: string): string {
    const dataset = this.datasetState();
    const numericIndex = this.createNumericIndex(dataset.generators.map((item) => item.id), 'gen-');
    const id = this.createUniqueId(dataset.generators.map((item) => item.id), 'gen-', numericIndex);
    const newDataset: GridDataset = {
      ...dataset,
      generators: [
        ...dataset.generators,
        {
          id,
          busId,
          name: `Generator ${numericIndex}`,
          activePowerMw: 20,
          reactivePowerMvar: 5,
          voltagePu: 1,
          minMw: 0,
          maxMw: 120,
          inService: true,
          minMvar: -40,
          maxMvar: 60,
          xdppPu: 0.2,
          costA: 0.01,
          costB: 1,
          costC: 0,
          rampRateMwPerMin: 10,
        },
      ],
    };
    this.datasetState.set(newDataset);
    return id;
  }

  addShuntAtBus(busId: string): string {
    const dataset = this.datasetState();
    const numericIndex = this.createNumericIndex(
      dataset.shuntCompensators.map((item) => item.id),
      'shunt-',
    );
    const id = this.createUniqueId(
      dataset.shuntCompensators.map((item) => item.id),
      'shunt-',
      numericIndex,
    );
    const newDataset: GridDataset = {
      ...dataset,
      shuntCompensators: [
        ...dataset.shuntCompensators,
        {
          id,
          busId,
          name: `Shunt ${numericIndex}`,
          shuntType: 'CAPACITOR',
          qMvar: 5,
          maxStep: 4,
          currentStep: 1,
          inService: true,
        },
      ],
    };
    this.datasetState.set(newDataset);
    return id;
  }

  addLineBetweenBuses(fromBusId: string, toBusId: string): string {
    const dataset = this.datasetState();
    const numericIndex = this.createNumericIndex(dataset.lines.map((item) => item.id), 'line-');
    const id = this.createUniqueId(dataset.lines.map((item) => item.id), 'line-', numericIndex);
    const newDataset: GridDataset = {
      ...dataset,
      lines: [
        ...dataset.lines,
        {
          id,
          gridId: dataset.grid.id,
          fromBusId,
          toBusId,
          name: `Line ${numericIndex}`,
          resistancePu: 0.01,
          reactancePu: 0.05,
          susceptancePu: 0.001,
          ratingMva: 100,
          lengthKm: 1,
          inService: true,
          ratingMvaShortTerm: 110,
          maxLoadingPercent: 100,
          fromSwitchClosed: true,
          toSwitchClosed: true,
        },
      ],
    };
    this.datasetState.set(newDataset);
    return id;
  }

  addTransformerBetweenBuses(fromBusId: string, toBusId: string): string {
    const dataset = this.datasetState();
    const numericIndex = this.createNumericIndex(
      dataset.transformers.map((item) => item.id),
      'xfmr-',
    );
    const id = this.createUniqueId(dataset.transformers.map((item) => item.id), 'xfmr-', numericIndex);
    const newDataset: GridDataset = {
      ...dataset,
      transformers: [
        ...dataset.transformers,
        {
          id,
          gridId: dataset.grid.id,
          fromBusId,
          toBusId,
          name: `Transformer ${numericIndex}`,
          resistancePu: 0.01,
          reactancePu: 0.06,
          magnetizingSusceptancePu: 0.001,
          ratingMva: 80,
          inService: true,
          tapRatio: 1,
          tapMin: 0.9,
          tapMax: 1.1,
          tapStepPercent: 1.25,
          tapSide: 'HV',
          windingType: 'TWO_WINDING',
          maxLoadingPercent: 100,
          fromSwitchClosed: true,
          toSwitchClosed: true,
        },
      ],
    };
    this.datasetState.set(newDataset);
    return id;
  }

  private createNumericIndex(ids: readonly string[], prefix: string): number {
    const used = new Set<number>();
    for (const id of ids) {
      const suffix = Number.parseInt(id.replace(prefix, ''), 10);
      if (Number.isFinite(suffix)) {
        used.add(suffix);
      }
    }
    let next = 1;
    while (used.has(next)) {
      next += 1;
    }
    return next;
  }

  private createUniqueId(ids: readonly string[], prefix: string, numericIndex: number): string {
    const usedIds = new Set(ids);
    let id = `${prefix}${numericIndex}`;
    let offset = numericIndex;
    while (usedIds.has(id)) {
      offset += 1;
      id = `${prefix}${offset}`;
    }
    return id;
  }

	private normalizeDataset(dataset: GridDataset): GridDataset {
		return {
			...dataset,
			buses: Array.isArray(dataset.buses) ? dataset.buses : [],
			lines: Array.isArray(dataset.lines) ? dataset.lines : [],
			transformers: Array.isArray(dataset.transformers) ? dataset.transformers : [],
			loads: Array.isArray(dataset.loads) ? dataset.loads : [],
			generators: Array.isArray(dataset.generators) ? dataset.generators : [],
			shuntCompensators: Array.isArray(dataset.shuntCompensators)
				? dataset.shuntCompensators
				: [],
			busLayout: Array.isArray(dataset.busLayout) ? dataset.busLayout : [],
			edgeLayout: Array.isArray(dataset.edgeLayout) ? dataset.edgeLayout : [],
		};
	}
}
