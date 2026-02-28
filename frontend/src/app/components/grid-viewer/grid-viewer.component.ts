import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  GridViewerFacade,
  type SelectedElement,
  type ViewportState,
} from './state/grid-viewer.facade';
import { MapWebglRenderer } from './renderers/map-webgl.renderer';
import { SchematicWebglRenderer } from './renderers/schematic-webgl.renderer';
import { GridInteractionController } from './renderers/grid-interaction.controller';
import { createPerfGridDataset } from './dev/perf-harness';

type ActiveView = 'map' | 'schematic';

@Component({
  selector: 'app-grid-viewer',
  templateUrl: './grid-viewer.component.html',
  styleUrl: './grid-viewer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GridViewerFacade],
})
export class GridViewerComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly facade = inject(GridViewerFacade);

  @ViewChild('mapCanvas', { static: true })
  private readonly mapCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('schematicCanvas', { static: true })
  private readonly schematicCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewerBody', { static: true })
  private readonly viewerBodyRef?: ElementRef<HTMLElement>;

  protected readonly activeView = signal<ActiveView>('schematic');
  protected readonly stats = this.facade.stats;
  protected readonly selectedElement = this.facade.selectedElement;
  protected readonly hoveredElement = this.facade.hoveredElement;
  protected readonly selectedLabel = computed(() => this.toLabel(this.selectedElement()));
  protected readonly hoveredLabel = computed(() => this.toLabel(this.hoveredElement()));

  private mapRenderer: MapWebglRenderer | null = null;
  private schematicRenderer: SchematicWebglRenderer | null = null;
  private mapController: GridInteractionController | null = null;
  private schematicController: GridInteractionController | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId = 0;

  ngAfterViewInit(): void {
    const mapCanvas = this.mapCanvasRef?.nativeElement;
    const schematicCanvas = this.schematicCanvasRef?.nativeElement;
    const viewerBody = this.viewerBodyRef?.nativeElement;
    if (!mapCanvas || !schematicCanvas || !viewerBody) {
      return;
    }

    this.mapRenderer = new MapWebglRenderer(mapCanvas);
    this.schematicRenderer = new SchematicWebglRenderer(schematicCanvas);
    this.syncGraphToRenderers();

    this.mapController = new GridInteractionController(mapCanvas, this.mapRenderer, {
      onViewportChange: (viewport) => this.facade.setMapViewport(viewport),
      onHoverChange: (element) => this.facade.hoverElement(element),
      onSelect: (element) => this.facade.selectElement(element),
    });
    this.schematicController = new GridInteractionController(schematicCanvas, this.schematicRenderer, {
      onViewportChange: (viewport) => this.facade.setSchematicViewport(viewport),
      onHoverChange: (element) => this.facade.hoverElement(element),
      onSelect: (element) => this.facade.selectElement(element),
    });

    this.resizeObserver = new ResizeObserver(() => this.resizeAndFitCanvases());
    this.resizeObserver.observe(viewerBody);
    this.resizeAndFitCanvases();
    this.startRenderLoop();

    this.destroyRef.onDestroy(() => {
      if (this.animationFrameId !== 0) {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.mapController?.dispose();
      this.schematicController?.dispose();
      this.resizeObserver?.disconnect();
      this.mapRenderer?.dispose();
      this.schematicRenderer?.dispose();
    });
  }

  protected setActiveView(view: ActiveView): void {
    this.activeView.set(view);
    this.resizeAndFitCanvases();
  }

  protected resetViewport(): void {
    if (!this.mapRenderer || !this.schematicRenderer) {
      return;
    }
    const graph = this.facade.normalizedGraph();
    if (this.activeView() === 'map') {
      this.facade.setMapViewport(this.mapRenderer.fitToBounds(graph.mapBounds));
      return;
    }
    this.facade.setSchematicViewport(this.schematicRenderer.fitToBounds(graph.schematicBounds));
  }

  protected clearSelection(): void {
    this.facade.clearSelection();
  }

  protected loadDataset(busCount: number): void {
    this.facade.setDataset(createPerfGridDataset(busCount));
    this.syncGraphToRenderers();
    this.resizeAndFitCanvases();
  }

  private syncGraphToRenderers(): void {
    if (!this.mapRenderer || !this.schematicRenderer) {
      return;
    }
    const graph = this.facade.normalizedGraph();
    this.mapRenderer.setGraph(graph);
    this.schematicRenderer.setGraph(graph);
  }

  private resizeAndFitCanvases(): void {
    if (!this.mapRenderer || !this.schematicRenderer) {
      return;
    }
    const viewerBody = this.viewerBodyRef?.nativeElement;
    if (!viewerBody) {
      return;
    }
    this.mapRenderer.resize(viewerBody.clientWidth, viewerBody.clientHeight);
    this.schematicRenderer.resize(viewerBody.clientWidth, viewerBody.clientHeight);
    this.resetViewport();
  }

  private startRenderLoop(): void {
    const frame = () => {
      if (this.mapRenderer && this.schematicRenderer) {
        this.mapRenderer.setViewport(this.facade.mapViewport());
        this.schematicRenderer.setViewport(this.facade.schematicViewport());
        const selected = this.facade.selectedElement();
        const hovered = this.facade.hoveredElement();
        this.mapRenderer.setInteraction(selected, hovered);
        this.schematicRenderer.setInteraction(selected, hovered);
        if (this.activeView() === 'map') {
          this.mapRenderer.render();
        } else {
          this.schematicRenderer.render();
        }
      }
      this.animationFrameId = requestAnimationFrame(frame);
    };
    this.animationFrameId = requestAnimationFrame(frame);
  }

  private toLabel(element: SelectedElement): string {
    if (!element) {
      return 'None';
    }
    if (element.kind === 'bus') {
      const bus = this.facade.normalizedGraph().busById.get(element.id);
      return bus ? `${bus.name} (${bus.id})` : element.id;
    }
    return element.id;
  }
}
