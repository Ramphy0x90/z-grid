import type { SelectedElement, ViewportState } from '../state/grid-viewer.facade';
import { WebglGridRenderer } from './webgl-grid.renderer';

export type InteractionCallbacks = {
  onViewportChange: (viewport: ViewportState) => void;
  onHoverChange: (element: SelectedElement) => void;
  onSelect: (element: SelectedElement) => void;
};

export class GridInteractionController {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pendingHoverFrame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: WebglGridRenderer,
    private readonly callbacks: InteractionCallbacks,
  ) {
    this.bindEvents();
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('click', this.onClick);
    if (this.pendingHoverFrame !== 0) {
      cancelAnimationFrame(this.pendingHoverFrame);
      this.pendingHoverFrame = 0;
    }
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('click', this.onClick);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.dragging = true;
    this.lastX = event.offsetX;
    this.lastY = event.offsetY;
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.style.cursor = 'grabbing';
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.dragging) {
      const dx = event.offsetX - this.lastX;
      const dy = event.offsetY - this.lastY;
      this.lastX = event.offsetX;
      this.lastY = event.offsetY;
      const viewport = this.renderer.panBy(dx, dy);
      this.callbacks.onViewportChange(viewport);
      return;
    }
    if (this.pendingHoverFrame !== 0) {
      return;
    }
    this.pendingHoverFrame = requestAnimationFrame(() => {
      this.pendingHoverFrame = 0;
      this.callbacks.onHoverChange(this.renderer.hitTest(event.offsetX, event.offsetY));
    });
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.dragging = false;
    this.canvas.releasePointerCapture(event.pointerId);
    this.canvas.style.cursor = 'crosshair';
  };

  private readonly onPointerLeave = (): void => {
    this.dragging = false;
    this.canvas.style.cursor = 'crosshair';
    this.callbacks.onHoverChange(null);
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
    const viewport = this.renderer.zoomAt(event.offsetX, event.offsetY, zoomFactor);
    this.callbacks.onViewportChange(viewport);
  };

  private readonly onClick = (event: MouseEvent): void => {
    this.callbacks.onSelect(this.renderer.hitTest(event.offsetX, event.offsetY));
  };
}
