import type { SelectedElement, ViewportState } from '../state/grid-viewer.facade';
import { WebglGridRenderer } from './webgl-grid.renderer';

export type InteractionCallbacks = {
	onViewportChange: (viewport: ViewportState) => void;
	onHoverChange: (element: SelectedElement) => void;
	onSelect: (element: SelectedElement) => void;
	onBackgroundClick?: (point: { x: number; y: number }) => void;
	canDragElement?: (element: SelectedElement) => boolean;
	onElementDragStart?: (element: SelectedElement, point: { x: number; y: number }) => void;
	onElementDrag?: (element: SelectedElement, point: { x: number; y: number }) => void;
	onElementDragEnd?: (element: SelectedElement) => void;
};

export class GridInteractionController {
	private dragMode: 'none' | 'pan' | 'element' = 'none';
	private draggedElement: SelectedElement = null;
	private lastX = 0;
	private lastY = 0;
	private hasMoved = false;
	private suppressClick = false;
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
		this.lastX = event.offsetX;
		this.lastY = event.offsetY;
		this.hasMoved = false;
		const hit = this.renderer.hitTest(event.offsetX, event.offsetY);
		const canDragElement = this.callbacks.canDragElement?.(hit) ?? false;
		if (canDragElement && hit) {
			this.dragMode = 'element';
			this.draggedElement = hit;
			this.callbacks.onElementDragStart?.(
				hit,
				this.renderer.toWorldCoordinates(event.offsetX, event.offsetY),
			);
		} else {
			this.dragMode = 'pan';
			this.draggedElement = null;
		}
		this.canvas.setPointerCapture(event.pointerId);
		this.canvas.style.cursor = 'grabbing';
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (this.dragMode === 'pan') {
			const dx = event.offsetX - this.lastX;
			const dy = event.offsetY - this.lastY;
			this.hasMoved =
				this.hasMoved || Math.abs(dx) > Number.EPSILON || Math.abs(dy) > Number.EPSILON;
			this.lastX = event.offsetX;
			this.lastY = event.offsetY;
			const viewport = this.renderer.panBy(dx, dy);
			this.callbacks.onViewportChange(viewport);
			return;
		}
		if (this.dragMode === 'element' && this.draggedElement) {
			const dx = event.offsetX - this.lastX;
			const dy = event.offsetY - this.lastY;
			this.hasMoved =
				this.hasMoved || Math.abs(dx) > Number.EPSILON || Math.abs(dy) > Number.EPSILON;
			this.lastX = event.offsetX;
			this.lastY = event.offsetY;
			this.callbacks.onElementDrag?.(
				this.draggedElement,
				this.renderer.toWorldCoordinates(event.offsetX, event.offsetY),
			);
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
		if (this.dragMode === 'element' && this.draggedElement) {
			this.callbacks.onElementDragEnd?.(this.draggedElement);
		}
		this.suppressClick = this.hasMoved;
		this.dragMode = 'none';
		this.draggedElement = null;
		this.hasMoved = false;
		this.canvas.releasePointerCapture(event.pointerId);
		this.canvas.style.cursor = 'crosshair';
	};

	private readonly onPointerLeave = (): void => {
		if (this.dragMode === 'element' && this.draggedElement) {
			this.callbacks.onElementDragEnd?.(this.draggedElement);
		}
		this.dragMode = 'none';
		this.draggedElement = null;
		this.hasMoved = false;
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
		if (this.suppressClick) {
			this.suppressClick = false;
			return;
		}
		const hit = this.renderer.hitTest(event.offsetX, event.offsetY);
		this.callbacks.onSelect(hit);
		if (!hit) {
			this.callbacks.onBackgroundClick?.(
				this.renderer.toWorldCoordinates(event.offsetX, event.offsetY),
			);
		}
	};
}
