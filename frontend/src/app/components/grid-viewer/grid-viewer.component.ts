import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	effect,
	DestroyRef,
	ElementRef,
	ViewChild,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import {
	map as createLeafletMap,
	tileLayer,
	type Map as LeafletMap,
	type TileLayer,
} from 'leaflet';
import {
	GridViewerFacade,
	type PlacementTool,
	type SelectedElement,
} from './state/grid-viewer.facade';
import { MapWebglRenderer } from './renderers/map-webgl.renderer';
import { SchematicWebglRenderer } from './renderers/schematic-webgl.renderer';
import { GridInteractionController } from './renderers/grid-interaction.controller';
import type { GridDataset } from './models/grid.models';
import { environment } from '../../../environments/environment';

type ActiveView = 'map' | 'schematic';
type MapStyleId = 'cartoDark' | 'cartoLight' | 'osmStandard' | 'openTopo';

type MapStyleOption = {
	id: MapStyleId;
	label: string;
	tileUrl: string;
	attribution: string;
	maxZoom: number;
};

const MAP_STYLE_OPTIONS: readonly MapStyleOption[] = [
	{
		id: 'cartoDark',
		label: 'CARTO Dark',
		tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
		attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
		maxZoom: 20,
	},
	{
		id: 'cartoLight',
		label: 'CARTO Light',
		tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
		attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
		maxZoom: 20,
	},
	{
		id: 'osmStandard',
		label: 'OSM Standard',
		tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
		attribution: '&copy; OpenStreetMap contributors',
		maxZoom: 19,
	},
	{
		id: 'openTopo',
		label: 'OpenTopoMap',
		tileUrl: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
		attribution:
			'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap',
		maxZoom: 17,
	},
];

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
	@ViewChild('mapHost', { static: true })
	private readonly mapHostRef?: ElementRef<HTMLElement>;
	@ViewChild('schematicCanvas', { static: true })
	private readonly schematicCanvasRef?: ElementRef<HTMLCanvasElement>;
	@ViewChild('viewerBody', { static: true })
	private readonly viewerBodyRef?: ElementRef<HTMLElement>;

	protected readonly activeView = signal<ActiveView>('schematic');
	protected readonly mapStyleOptions = MAP_STYLE_OPTIONS;
	protected readonly selectedMapStyleId = signal<MapStyleId>(this.resolveInitialMapStyleId());
	readonly dataset = input<GridDataset | null>(null);
	readonly editEnabled = input(false);
	readonly datasetChange = output<GridDataset>();
	protected readonly totalElements = this.facade.totalElements;
	protected readonly placementMode = this.facade.placementMode;
	protected readonly hoveredElement = this.facade.hoveredElement;
	protected readonly placementHint = computed(() => this.getPlacementHint());
	protected readonly connectionPreview = computed(() => this.getConnectionPreview());
	protected readonly placedConnectionOverlays = computed(() => this.getPlacedConnectionOverlays());

	private mapRenderer: MapWebglRenderer | null = null;
	private schematicRenderer: SchematicWebglRenderer | null = null;
	private mapController: GridInteractionController | null = null;
	private schematicController: GridInteractionController | null = null;
	private leafletMap: LeafletMap | null = null;
	private leafletTileLayer: TileLayer | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private animationFrameId = 0;
	private lastDatasetGridId: string | null = null;
	private readonly pendingConnectionBusId = signal<string | null>(null);
	private readonly viewerSize = signal({ width: 1, height: 1 });
	private readonly datasetSyncEffect = effect(() => {
		const dataset = this.dataset();
		if (!dataset) {
			this.lastDatasetGridId = null;
			return;
		}
		const shouldResetViewport = this.lastDatasetGridId !== dataset.grid.id;
		this.lastDatasetGridId = dataset.grid.id;
		this.facade.setDataset(dataset);
		this.syncGraphToRenderers();
		if (shouldResetViewport) {
			this.resetViewport();
		}
		this.pendingConnectionBusId.set(null);
	});
	private readonly editModeSyncEffect = effect(() => {
		if (this.editEnabled()) {
			return;
		}
		this.facade.setPlacementMode(null);
		this.pendingConnectionBusId.set(null);
	});
	private readonly mapViewportSyncEffect = effect(() => {
		this.syncLeafletViewToViewport(this.facade.mapViewport());
	});

	ngAfterViewInit(): void {
		const mapCanvas = this.mapCanvasRef?.nativeElement;
		const mapHost = this.mapHostRef?.nativeElement;
		const schematicCanvas = this.schematicCanvasRef?.nativeElement;
		const viewerBody = this.viewerBodyRef?.nativeElement;
		if (!mapCanvas || !mapHost || !schematicCanvas || !viewerBody) {
			return;
		}

		this.initializeLeafletMap(mapHost);
		this.mapRenderer = new MapWebglRenderer(mapCanvas);
		this.schematicRenderer = new SchematicWebglRenderer(schematicCanvas);
		this.syncGraphToRenderers();

		this.mapController = new GridInteractionController(mapCanvas, this.mapRenderer, {
			onViewportChange: (viewport) => this.facade.setMapViewport(viewport),
			onHoverChange: (element) => this.facade.hoverElement(element),
			onSelect: (element) => this.onCanvasSelect(element),
			onBackgroundClick: (point) => this.onCanvasBackgroundClick('map', point.x, point.y),
		});
		this.schematicController = new GridInteractionController(
			schematicCanvas,
			this.schematicRenderer,
			{
				onViewportChange: (viewport) => this.facade.setSchematicViewport(viewport),
				onHoverChange: (element) => this.facade.hoverElement(element),
				onSelect: (element) => this.onCanvasSelect(element),
				onBackgroundClick: (point) => this.onCanvasBackgroundClick('schematic', point.x, point.y),
			},
		);

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
			this.leafletMap?.remove();
			this.leafletMap = null;
		});
	}

	protected setActiveView(view: ActiveView): void {
		this.activeView.set(view);
		this.resizeAndFitCanvases();
		if (view === 'map') {
			this.leafletMap?.invalidateSize(false);
			this.syncLeafletViewToViewport(this.facade.mapViewport());
		}
	}

	protected resetViewport(): void {
		if (!this.mapRenderer || !this.schematicRenderer) {
			return;
		}
		const graph = this.facade.normalizedGraph();
		const fitPaddingPx = 72;
		if (this.activeView() === 'map') {
			this.facade.setMapViewport(this.mapRenderer.fitToBounds(graph.mapBounds, fitPaddingPx));
			return;
		}
		this.facade.setSchematicViewport(
			this.schematicRenderer.fitToBounds(graph.schematicBounds, fitPaddingPx),
		);
	}

	protected zoomIn(): void {
		this.adjustZoom(1.12);
	}

	protected zoomOut(): void {
		this.adjustZoom(0.89);
	}

	protected togglePlacementMode(tool: Exclude<PlacementTool, null>): void {
		if (!this.editEnabled()) {
			return;
		}
		const isSameTool = this.facade.placementMode() === tool;
		this.pendingConnectionBusId.set(null);
		this.facade.setPlacementMode(isSameTool ? null : tool);
	}

	protected onMapStyleChange(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) {
			return;
		}
		if (!this.isMapStyleId(target.value)) {
			return;
		}
		this.selectedMapStyleId.set(target.value);
		this.applyMapStyleLayer();
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
		this.viewerSize.set({
			width: Math.max(1, viewerBody.clientWidth),
			height: Math.max(1, viewerBody.clientHeight),
		});
		this.mapRenderer.resize(viewerBody.clientWidth, viewerBody.clientHeight);
		this.schematicRenderer.resize(viewerBody.clientWidth, viewerBody.clientHeight);
		this.leafletMap?.invalidateSize(false);
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
		if (!this.editEnabled()) {
			return;
		}
		if (this.facade.placementMode() !== 'bus') {
			return;
		}
		const placementCoordinates = this.projectPlacementCoordinates(view, x, y);
		const newBusId = this.facade.addBusAt(placementCoordinates);
		this.syncGraphToRenderers();
		this.facade.selectElement({ kind: 'bus', id: newBusId });
		this.facade.setPlacementMode(null);
		this.pendingConnectionBusId.set(null);
		this.emitDatasetChange();
	}

	private onCanvasSelect(element: SelectedElement): void {
		if (!this.editEnabled()) {
			this.facade.selectElement(element);
			return;
		}
		const mode = this.facade.placementMode();
		if (!mode) {
			this.facade.selectElement(element);
			return;
		}
		if (mode === 'bus') {
			this.facade.selectElement(element);
			return;
		}
		if (mode === 'load' || mode === 'generator' || mode === 'shunt') {
			this.placeBusAttachedElement(mode, element);
			return;
		}
		this.placeConnectionElement(mode, element);
	}

	private placeBusAttachedElement(
		mode: 'load' | 'generator' | 'shunt',
		element: SelectedElement,
	): void {
		if (!element || element.kind !== 'bus') {
			return;
		}
		if (mode === 'load') {
			this.facade.addLoadAtBus(element.id);
		} else if (mode === 'generator') {
			this.facade.addGeneratorAtBus(element.id);
		} else {
			this.facade.addShuntAtBus(element.id);
		}
		this.syncGraphToRenderers();
		this.facade.selectElement(element);
		this.facade.setPlacementMode(null);
		this.pendingConnectionBusId.set(null);
		this.emitDatasetChange();
	}

	private placeConnectionElement(mode: 'line' | 'transformer', element: SelectedElement): void {
		if (!element || element.kind !== 'bus') {
			return;
		}
		const sourceBusId = this.pendingConnectionBusId();
		if (!sourceBusId) {
			this.pendingConnectionBusId.set(element.id);
			this.facade.selectElement(element);
			return;
		}
		if (sourceBusId === element.id) {
			this.pendingConnectionBusId.set(null);
			return;
		}
		const edgeId =
			mode === 'line'
				? this.facade.addLineBetweenBuses(sourceBusId, element.id)
				: this.facade.addTransformerBetweenBuses(sourceBusId, element.id);
		this.syncGraphToRenderers();
		this.facade.selectElement({ kind: 'edge', id: edgeId });
		this.facade.setPlacementMode(null);
		this.pendingConnectionBusId.set(null);
		this.emitDatasetChange();
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

	private initializeLeafletMap(container: HTMLElement): void {
		const map = createLeafletMap(container, {
			zoomControl: false,
			attributionControl: true,
			dragging: false,
			scrollWheelZoom: false,
			doubleClickZoom: false,
			boxZoom: false,
			keyboard: false,
			touchZoom: false,
		});
		this.leafletMap = map;
		this.applyMapStyleLayer();
		this.syncLeafletViewToViewport(this.facade.mapViewport());
	}

	private syncLeafletViewToViewport(viewport: { centerX: number; centerY: number; zoom: number }): void {
		if (!this.leafletMap) {
			return;
		}
		const zoom = this.toLeafletZoom(viewport.zoom);
		this.leafletMap.setView([viewport.centerY, viewport.centerX], zoom, { animate: false });
	}

	private toLeafletZoom(viewportZoom: number): number {
		const safeZoom = Math.max(Number.EPSILON, viewportZoom);
		const rawZoom = Math.log2((360 * safeZoom) / 256);
		return Math.min(19, Math.max(0, rawZoom));
	}

	private resolveInitialMapStyleId(): MapStyleId {
		const configuredTileUrl = environment.map.tileUrl;
		const matching = MAP_STYLE_OPTIONS.find((style) => style.tileUrl === configuredTileUrl);
		return matching?.id ?? 'cartoDark';
	}

	private isMapStyleId(value: string): value is MapStyleId {
		return MAP_STYLE_OPTIONS.some((style) => style.id === value);
	}

	private getSelectedMapStyle(): MapStyleOption {
		const selectedId = this.selectedMapStyleId();
		return (
			MAP_STYLE_OPTIONS.find((style) => style.id === selectedId) ??
			MAP_STYLE_OPTIONS.find((style) => style.id === 'cartoDark') ??
			MAP_STYLE_OPTIONS[0]
		);
	}

	private applyMapStyleLayer(): void {
		if (!this.leafletMap) {
			return;
		}
		if (this.leafletTileLayer) {
			this.leafletTileLayer.removeFrom(this.leafletMap);
			this.leafletTileLayer = null;
		}
		const style = this.getSelectedMapStyle();
		this.leafletTileLayer = tileLayer(style.tileUrl, {
			attribution: style.attribution,
			maxZoom: style.maxZoom,
		});
		this.leafletTileLayer.addTo(this.leafletMap);
	}

	private getPlacementHint(): string {
		const mode = this.facade.placementMode();
		if (!mode) {
			return '';
		}
		if (mode === 'bus') {
			return 'Click empty grid area to place one bus.';
		}
		if (mode === 'line' || mode === 'transformer') {
			return this.pendingConnectionBusId()
				? 'Select target bus to complete connection.'
				: 'Select source bus to start connection.';
		}
		return 'Select a bus to attach this element.';
	}

	private getConnectionPreview(): { x1: number; y1: number; x2: number; y2: number } | null {
		const mode = this.facade.placementMode();
		if (mode !== 'line' && mode !== 'transformer') {
			return null;
		}
		const sourceBusId = this.pendingConnectionBusId();
		if (!sourceBusId) {
			return null;
		}
		const target = this.hoveredElement();
		if (!target || target.kind !== 'bus' || target.id === sourceBusId) {
			return null;
		}

		const graph = this.facade.normalizedGraph();
		const sourceIndex = graph.busIndexById.get(sourceBusId);
		const targetIndex = graph.busIndexById.get(target.id);
		if (sourceIndex === undefined || targetIndex === undefined) {
			return null;
		}

		const positions =
			this.activeView() === 'map' ? graph.mapNodePositions : graph.schematicNodePositions;
		const x1 = positions[sourceIndex * 2];
		const y1 = positions[sourceIndex * 2 + 1];
		const x2 = positions[targetIndex * 2];
		const y2 = positions[targetIndex * 2 + 1];
		return this.worldSegmentToScreen(x1, y1, x2, y2);
	}

	private projectPlacementCoordinates(
		view: ActiveView,
		x: number,
		y: number,
	): { mapX: number; mapY: number; schematicX: number; schematicY: number } {
		const graph = this.facade.normalizedGraph();
		if (view === 'map') {
			const projected = this.projectToOtherBounds(x, y, graph.mapBounds, graph.schematicBounds);
			return { mapX: x, mapY: y, schematicX: projected.x, schematicY: projected.y };
		}
		const projected = this.projectToOtherBounds(x, y, graph.schematicBounds, graph.mapBounds);
		return { mapX: projected.x, mapY: projected.y, schematicX: x, schematicY: y };
	}

	private projectToOtherBounds(
		x: number,
		y: number,
		source: { minX: number; minY: number; maxX: number; maxY: number },
		target: { minX: number; minY: number; maxX: number; maxY: number },
	): { x: number; y: number } {
		const tx = this.relativePosition(x, source.minX, source.maxX);
		const ty = this.relativePosition(y, source.minY, source.maxY);
		return {
			x: target.minX + tx * (target.maxX - target.minX),
			y: target.minY + ty * (target.maxY - target.minY),
		};
	}

	private relativePosition(value: number, min: number, max: number): number {
		const span = max - min;
		if (Math.abs(span) < Number.EPSILON) {
			return 0.5;
		}
		return (value - min) / span;
	}

	private getPlacedConnectionOverlays(): Array<{ x1: number; y1: number; x2: number; y2: number }> {
		const graph = this.facade.normalizedGraph();
		const segments =
			this.activeView() === 'map' ? graph.mapLineSegments : graph.schematicLineSegments;
		const overlays: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
		for (let index = 0; index < graph.edgeIds.length; index += 1) {
			const edgeId = graph.edgeIds[index];
			if (!edgeId) {
				continue;
			}
			const x1 = segments[index * 4];
			const y1 = segments[index * 4 + 1];
			const x2 = segments[index * 4 + 2];
			const y2 = segments[index * 4 + 3];
			overlays.push(this.worldSegmentToScreen(x1, y1, x2, y2));
		}
		return overlays;
	}

	private worldSegmentToScreen(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
	): { x1: number; y1: number; x2: number; y2: number } {
		const viewport =
			this.activeView() === 'map' ? this.facade.mapViewport() : this.facade.schematicViewport();
		const ySign = this.activeView() === 'map' ? 1 : -1;
		const size = this.viewerSize();
		const halfW = size.width / 2;
		const halfH = size.height / 2;
		return {
			x1: (x1 - viewport.centerX) * viewport.zoom + halfW,
			y1: halfH - (y1 - viewport.centerY) * viewport.zoom * ySign,
			x2: (x2 - viewport.centerX) * viewport.zoom + halfW,
			y2: halfH - (y2 - viewport.centerY) * viewport.zoom * ySign,
		};
	}

	private emitDatasetChange(): void {
		this.datasetChange.emit(this.facade.dataset());
	}
}
