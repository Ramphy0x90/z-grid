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

@Injectable()
export class GridViewerFacade {
  private readonly datasetState = signal<GridDataset>(mockGridDataset);
  private readonly mapViewportState = signal<ViewportState>({ centerX: 0, centerY: 0, zoom: 1 });
  private readonly schematicViewportState = signal<ViewportState>({ centerX: 0, centerY: 0, zoom: 1 });
  private readonly selectedElementState = signal<SelectedElement>(null);
  private readonly hoveredElementState = signal<SelectedElement>(null);

  readonly dataset = this.datasetState.asReadonly();
  readonly normalizedGraph = computed(() => normalizeGridDataset(this.datasetState()));
  readonly mapViewport = this.mapViewportState.asReadonly();
  readonly schematicViewport = this.schematicViewportState.asReadonly();
  readonly selectedElement = this.selectedElementState.asReadonly();
  readonly hoveredElement = this.hoveredElementState.asReadonly();
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

  setDataset(dataset: GridDataset): void {
    this.datasetState.set(dataset);
    this.selectedElementState.set(null);
    this.hoveredElementState.set(null);
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
}
