import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { GridViewerFacade } from './state/grid-viewer.facade';
import { MapWebglRenderer } from './renderers/map-webgl.renderer';
import { SchematicWebglRenderer } from './renderers/schematic-webgl.renderer';
import { GridInteractionController } from './renderers/grid-interaction.controller';

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
  protected readonly totalElements = this.facade.totalElements;
  protected readonly placementMode = this.facade.placementMode;

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
      onBackgroundClick: (point) => this.onCanvasBackgroundClick('map', point.x, point.y),
    });
    this.schematicController = new GridInteractionController(schematicCanvas, this.schematicRenderer, {
      onViewportChange: (viewport) => this.facade.setSchematicViewport(viewport),
      onHoverChange: (element) => this.facade.hoverElement(element),
      onSelect: (element) => this.facade.selectElement(element),
      onBackgroundClick: (point) => this.onCanvasBackgroundClick('schematic', point.x, point.y),
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

  protected zoomIn(): void {
    this.adjustZoom(1.12);
  }

  protected zoomOut(): void {
    this.adjustZoom(0.89);
  }

  protected toggleBusPlacement(): void {
    this.facade.setPlacementMode(this.facade.placementMode() === 'bus' ? null : 'bus');
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

  private onCanvasBackgroundClick(view: ActiveView, x: number, y: number): void {
    if (this.facade.placementMode() !== 'bus') {
      return;
    }
    const newBusId = this.facade.addBusAt(view, x, y);
    this.syncGraphToRenderers();
    this.facade.selectElement({ kind: 'bus', id: newBusId });
    this.facade.setPlacementMode(null);
  }

  private adjustZoom(factor: number): void {
    const body = this.viewerBodyRef?.nativeElement;
    if (!body || !this.mapRenderer || !this.schematicRenderer) {
      return;
    }
    const screenX = body.clientWidth / 2;
    const screenY = body.clientHeight / 2;
    if (this.activeView() === 'map') {
      this.facade.setMapViewport(this.mapRenderer.zoomAt(screenX, screenY, factor));
      return;
    }
    this.facade.setSchematicViewport(this.schematicRenderer.zoomAt(screenX, screenY, factor));
  }

}
