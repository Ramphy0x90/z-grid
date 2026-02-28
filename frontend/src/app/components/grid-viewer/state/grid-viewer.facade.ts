import { Injectable, computed, signal } from '@angular/core';
import type { GridDataset } from '../models/grid.models';
import { mockGridDataset } from '../data/mock-grid.data';
import { normalizeGridDataset } from '../data/grid-normalizer';

export type ViewportState = {
  centerX: number;
  centerY: number;
  zoom: number;
};

export type SelectedElement = {
  kind: 'bus' | 'edge';
  id: string;
} | null;

export type PlacementTool = 'bus' | null;

@Injectable()
export class GridViewerFacade {
  private readonly datasetState = signal<GridDataset>(mockGridDataset);
  private readonly mapViewportState = signal<ViewportState>({ centerX: 0, centerY: 0, zoom: 1 });
  private readonly schematicViewportState = signal<ViewportState>({ centerX: 0, centerY: 0, zoom: 1 });
  private readonly selectedElementState = signal<SelectedElement>(null);
  private readonly hoveredElementState = signal<SelectedElement>(null);
  private readonly placementModeState = signal<PlacementTool>(null);

  readonly dataset = this.datasetState.asReadonly();
  readonly normalizedGraph = computed(() => normalizeGridDataset(this.datasetState()));
  readonly mapViewport = this.mapViewportState.asReadonly();
  readonly schematicViewport = this.schematicViewportState.asReadonly();
  readonly selectedElement = this.selectedElementState.asReadonly();
  readonly hoveredElement = this.hoveredElementState.asReadonly();
  readonly placementMode = this.placementModeState.asReadonly();
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
    this.datasetState.set(dataset);
    this.selectedElementState.set(null);
    this.hoveredElementState.set(null);
    this.placementModeState.set(null);
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

  addBusAt(view: 'map' | 'schematic', x: number, y: number): string {
    const dataset = this.datasetState();
    const numericIndex = this.createBusNumericIndex(dataset);
    const id = this.createBusId(dataset, numericIndex);
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
          lat: view === 'map' ? y : dataset.busLayout[0]?.lat ?? 0,
          lng: view === 'map' ? x : dataset.busLayout[0]?.lng ?? 0,
          schematicX: view === 'schematic' ? x : dataset.busLayout[0]?.schematicX ?? 0,
          schematicY: view === 'schematic' ? y : dataset.busLayout[0]?.schematicY ?? 0,
        },
      ],
    };
    this.datasetState.set(newDataset);
    return id;
  }

  private createBusNumericIndex(dataset: GridDataset): number {
    const used = new Set<number>();
    for (const bus of dataset.buses) {
      const suffix = Number.parseInt(bus.id.replace('bus-', ''), 10);
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

  private createBusId(dataset: GridDataset, numericIndex: number): string {
    const usedIds = new Set(dataset.buses.map((bus) => bus.id));
    let id = `bus-${numericIndex}`;
    let offset = numericIndex;
    while (usedIds.has(id)) {
      offset += 1;
      id = `bus-${offset}`;
    }
    return id;
  }
}
