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
import { Store } from '@ngrx/store';
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
import type {
	BusModel,
	GeneratorModel,
	GridDataset,
	LineModel,
	LoadModel,
	ShuntCompensatorModel,
	TransformerModel,
} from './models/grid.models';
import { environment } from '../../../environments/environment';
import {
	GridElementInspectorComponent,
	type GridElementInspectorApplyEvent,
	type GridElementInspectorSelection,
} from '../grid-element-inspector/grid-element-inspector.component';
import { GridViewerToolbarComponent } from './toolbar/grid-viewer-toolbar.component';
import { COLOR_MODE_OPTIONS, MAP_STYLE_OPTIONS } from './toolbar/grid-viewer-toolbar.constants';
import type {
	ActiveView,
	ColorModeId,
	MapStyleId,
	MapStyleOption,
} from './toolbar/grid-viewer-toolbar.types';
import { GridSelectors } from '../../stores/grid/grid.selectors';
import { latToMercatorY, mercatorYToLat } from './utils/web-mercator';
import { GridHoverResultOverlayService } from '../../services/grid-hover-result-overlay.service';
import type { GridHoverResultCard } from '../../types/grid-hover-result.types';

const NEW_GRID_MAP_VIEWPORT = {
	centerX: 60,
	centerY: latToMercatorY(48),
	zoom: 8,
} as const;
const MAP_VIEW_MAX_ZOOM = 24;

type AttachedElementIconOverlay = {
	id: string;
	kind: 'load' | 'generator';
	x: number;
	y: number;
	highlighted: boolean;
};

type TransformerIconOverlay = {
	id: string;
	x: number;
	y: number;
	angle: number;
	highlighted: boolean;
};

type HoverResultOverlay = {
	x: number;
	y: number;
	card: GridHoverResultCard;
};

@Component({
	selector: 'app-grid-viewer',
	imports: [GridElementInspectorComponent, GridViewerToolbarComponent],
	templateUrl: './grid-viewer.component.html',
	styleUrl: './grid-viewer.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [GridViewerFacade],
})
export class GridViewerComponent implements AfterViewInit {
	private readonly destroyRef = inject(DestroyRef);
	private readonly facade = inject(GridViewerFacade);
	private readonly store = inject(Store);
	private readonly hoverResultOverlayService = inject(GridHoverResultOverlayService);

	@ViewChild('mapCanvas', { static: true })
	private readonly mapCanvasRef?: ElementRef<HTMLCanvasElement>;
	@ViewChild('mapHost', { static: true })
	private readonly mapHostRef?: ElementRef<HTMLElement>;
	@ViewChild('schematicCanvas', { static: true })
	private readonly schematicCanvasRef?: ElementRef<HTMLCanvasElement>;
	@ViewChild('viewerBody', { static: true })
	private readonly viewerBodyRef?: ElementRef<HTMLElement>;

	protected readonly activeView = signal<ActiveView>('map');
	protected readonly mapStyleOptions = MAP_STYLE_OPTIONS;
	protected readonly colorModeOptions = COLOR_MODE_OPTIONS;
	protected readonly selectedMapStyleId = signal<MapStyleId>(this.resolveInitialMapStyleId());
	protected readonly selectedColorModeId = this.facade.colorMode;
	readonly dataset = input<GridDataset | null>(null);
	protected readonly editEnabled = this.store.selectSignal(GridSelectors.isGridEditState);
	readonly datasetChange = output<GridDataset>();
	protected readonly totalElements = this.facade.totalElements;
	protected readonly placementMode = this.facade.placementMode;
	protected readonly hoveredElement = this.facade.hoveredElement;
	protected readonly selectedElement = this.facade.selectedElement;
	protected readonly placementHint = computed(() => this.getPlacementHint());
	protected readonly connectionPreview = computed(() => this.getConnectionPreview());
	protected readonly placedConnectionOverlays = computed(() => this.getPlacedConnectionOverlays());
	protected readonly transformerIconOverlays = computed(() => this.getTransformerIconOverlays());
	protected readonly attachedElementIconOverlays = computed(() => this.getAttachedElementIconOverlays());
	protected readonly hoverResultOverlay = computed(() => this.getHoverResultOverlay());
	protected readonly inspectorSelection = computed<GridElementInspectorSelection | null>(() => {
		const placementMode = this.facade.placementMode();
		if (placementMode === 'line' || placementMode === 'transformer') {
			// While creating a connection, clicks are workflow inputs, not element inspection intent.
			return null;
		}
		const selected = this.facade.selectedElement();
		if (!selected) {
			return null;
		}
		const dataset = this.facade.dataset();
		if (selected.kind === 'bus') {
			const element = dataset.buses.find((bus) => bus.id === selected.id);
			return element ? { kind: 'bus', element } : null;
		}
		if (selected.kind === 'line') {
			const element = dataset.lines.find((line) => line.id === selected.id);
			return element ? { kind: 'line', element } : null;
		}
		if (selected.kind === 'transformer') {
			const element = dataset.transformers.find((transformer) => transformer.id === selected.id);
			return element ? { kind: 'transformer', element } : null;
		}
		if (selected.kind === 'load') {
			const element = dataset.loads.find((load) => load.id === selected.id);
			return element ? { kind: 'load', element } : null;
		}
		if (selected.kind === 'generator') {
			const element = dataset.generators.find((generator) => generator.id === selected.id);
			return element ? { kind: 'generator', element } : null;
		}
		const element = dataset.shuntCompensators.find((shunt) => shunt.id === selected.id);
		return element ? { kind: 'shunt', element } : null;
	});
	protected readonly inspectorBusIds = computed(() => this.facade.dataset().buses.map((bus) => bus.id));

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
			this.facade.clearDataset();
			this.syncGraphToRenderers();
			this.pendingConnectionBusId.set(null);
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
	private readonly colorModeSyncEffect = effect(() => {
		this.facade.colorMode();
		this.syncGraphToRenderers();
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
			onViewportChange: (viewport) => {
				// Keep Leaflet and WebGL in lockstep during drag/zoom to avoid visible lag.
				this.syncLeafletViewToViewport(viewport);
				this.facade.setMapViewport(viewport);
			},
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
			if (graph.busIds.length === 0) {
				this.facade.setMapViewport({ ...NEW_GRID_MAP_VIEWPORT });
				return;
			}
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

	protected onMapStyleIdChange(mapStyleId: MapStyleId): void {
		this.selectedMapStyleId.set(mapStyleId);
		this.applyMapStyleLayer();
	}

	protected onColorModeIdChange(colorModeId: ColorModeId): void {
		this.facade.setColorMode(colorModeId);
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
		this.facade.selectElement({ kind: mode, id: edgeId });
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
			zoomSnap: 0,
			zoomAnimation: false,
			fadeAnimation: false,
			markerZoomAnimation: false,
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

	private syncLeafletViewToViewport(viewport: {
		centerX: number;
		centerY: number;
		zoom: number;
	}): void {
		if (!this.leafletMap) {
			return;
		}
		const zoom = this.toLeafletZoom(viewport.zoom);
		this.leafletMap.setView([mercatorYToLat(viewport.centerY), viewport.centerX], zoom, {
			animate: false,
		});
	}

	private toLeafletZoom(viewportZoom: number): number {
		const safeZoom = Math.max(Number.EPSILON, viewportZoom);
		const rawZoom = Math.log2((360 * safeZoom) / 256);
		return Math.min(MAP_VIEW_MAX_ZOOM, Math.max(0, rawZoom));
	}

	private resolveInitialMapStyleId(): MapStyleId {
		const configuredTileUrl = environment.map.tileUrl;
		const matching = MAP_STYLE_OPTIONS.find((style) => style.tileUrl === configuredTileUrl);
		return matching?.id ?? 'cartoDark';
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
		this.leafletMap.getContainer().style.backgroundColor = style.backgroundColor;
		this.leafletTileLayer = tileLayer(style.tileUrl, {
			attribution: style.attribution,
			maxNativeZoom: style.maxZoom,
			maxZoom: MAP_VIEW_MAX_ZOOM,
			keepBuffer: 6,
			updateWhenZooming: false,
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
			return {
				mapX: x,
				mapY: mercatorYToLat(y),
				schematicX: projected.x,
				schematicY: projected.y,
			};
		}
		const projected = this.projectToOtherBounds(x, y, graph.schematicBounds, graph.mapBounds);
		return { mapX: projected.x, mapY: mercatorYToLat(projected.y), schematicX: x, schematicY: y };
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

	private getAttachedElementIconOverlays(): AttachedElementIconOverlay[] {
		const graph = this.facade.normalizedGraph();
		const positions =
			this.activeView() === 'map' ? graph.mapAttachedPositions : graph.schematicAttachedPositions;
		const selected = this.selectedElement();
		const hovered = this.hoveredElement();
		const overlays: AttachedElementIconOverlay[] = [];
		for (let index = 0; index < graph.attachedElementIds.length; index += 1) {
			const kind = graph.attachedElementKinds[index];
			if (kind !== 'load' && kind !== 'generator') {
				continue;
			}
			const id = graph.attachedElementIds[index];
			const isSelected = selected?.id === id && selected.kind === kind;
			const isHovered = hovered?.id === id && hovered.kind === kind;
			const point = this.worldPointToScreen(positions[index * 2], positions[index * 2 + 1]);
			overlays.push({ id, kind, x: point.x, y: point.y, highlighted: isSelected || isHovered });
		}
		return overlays;
	}

	private getTransformerIconOverlays(): TransformerIconOverlay[] {
		const graph = this.facade.normalizedGraph();
		const segments =
			this.activeView() === 'map' ? graph.mapLineSegments : graph.schematicLineSegments;
		const selected = this.selectedElement();
		const hovered = this.hoveredElement();
		const overlays: TransformerIconOverlay[] = [];
		for (let index = 0; index < graph.edgeIds.length; index += 1) {
			if (graph.edgeKinds[index] !== 'transformer') {
				continue;
			}
			const id = graph.edgeIds[index];
			if (!id) {
				continue;
			}
			const x1 = segments[index * 4];
			const y1 = segments[index * 4 + 1];
			const x2 = segments[index * 4 + 2];
			const y2 = segments[index * 4 + 3];
			const screenStart = this.worldPointToScreen(x1, y1);
			const screenEnd = this.worldPointToScreen(x2, y2);
			const midpoint = this.worldPointToScreen((x1 + x2) / 2, (y1 + y2) / 2);
			const angle = (Math.atan2(screenEnd.y - screenStart.y, screenEnd.x - screenStart.x) * 180) / Math.PI;
			const isSelected = selected?.kind === 'transformer' && selected.id === id;
			const isHovered = hovered?.kind === 'transformer' && hovered.id === id;
			overlays.push({ id, x: midpoint.x, y: midpoint.y, angle, highlighted: isSelected || isHovered });
		}
		return overlays;
	}

	private getHoverResultOverlay(): HoverResultOverlay | null {
		const hoveredElement = this.hoveredElement();
		if (!hoveredElement) {
			return null;
		}
		const provider = this.hoverResultOverlayService.activeProvider();
		if (!provider) {
			return null;
		}
		const anchor = this.getHoveredElementAnchor(hoveredElement);
		if (!anchor) {
			return null;
		}
		const card = provider({
			hoveredElement,
			dataset: this.facade.dataset(),
		});
		if (!card) {
			return null;
		}
		return { ...anchor, card };
	}

	private getHoveredElementAnchor(element: SelectedElement): { x: number; y: number } | null {
		if (!element) {
			return null;
		}
		const graph = this.facade.normalizedGraph();
		if (element.kind === 'bus') {
			const busIndex = graph.busIndexById.get(element.id);
			if (busIndex === undefined) {
				return null;
			}
			const positions =
				this.activeView() === 'map' ? graph.mapNodePositions : graph.schematicNodePositions;
			return this.worldPointToScreen(positions[busIndex * 2], positions[busIndex * 2 + 1]);
		}
		if (element.kind === 'line' || element.kind === 'transformer') {
			const edgeIndex = graph.edgeIds.findIndex((edgeId) => edgeId === element.id);
			if (edgeIndex < 0) {
				return null;
			}
			const segments =
				this.activeView() === 'map' ? graph.mapLineSegments : graph.schematicLineSegments;
			const x1 = segments[edgeIndex * 4];
			const y1 = segments[edgeIndex * 4 + 1];
			const x2 = segments[edgeIndex * 4 + 2];
			const y2 = segments[edgeIndex * 4 + 3];
			return this.worldPointToScreen((x1 + x2) / 2, (y1 + y2) / 2);
		}
		const attachedIndex = graph.attachedElementIds.findIndex(
			(attachedId, index) =>
				attachedId === element.id && graph.attachedElementKinds[index] === element.kind,
		);
		if (attachedIndex < 0) {
			return null;
		}
		const positions =
			this.activeView() === 'map' ? graph.mapAttachedPositions : graph.schematicAttachedPositions;
		return this.worldPointToScreen(positions[attachedIndex * 2], positions[attachedIndex * 2 + 1]);
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

	private worldPointToScreen(x: number, y: number): { x: number; y: number } {
		const viewport =
			this.activeView() === 'map' ? this.facade.mapViewport() : this.facade.schematicViewport();
		const ySign = this.activeView() === 'map' ? 1 : -1;
		const size = this.viewerSize();
		const halfW = size.width / 2;
		const halfH = size.height / 2;
		return {
			x: (x - viewport.centerX) * viewport.zoom + halfW,
			y: halfH - (y - viewport.centerY) * viewport.zoom * ySign,
		};
	}

	private emitDatasetChange(): void {
		this.datasetChange.emit(this.facade.dataset());
	}

	protected onInspectorApply(event: GridElementInspectorApplyEvent): void {
		const dataset = this.facade.dataset();
		const nextDataset = this.applyInspectorPatch(dataset, event);
		this.facade.updateDataset(nextDataset);
		this.syncGraphToRenderers();
		this.emitDatasetChange();
	}

	private applyInspectorPatch(
		dataset: GridDataset,
		event: GridElementInspectorApplyEvent,
	): GridDataset {
		if (event.kind === 'bus') {
			return {
				...dataset,
				buses: dataset.buses.map((bus) =>
					bus.id === event.id ? ({ ...bus, ...event.changes } as BusModel) : bus,
				),
			};
		}
		if (event.kind === 'line') {
			return {
				...dataset,
				lines: dataset.lines.map((line) =>
					line.id === event.id ? ({ ...line, ...event.changes } as LineModel) : line,
				),
			};
		}
		if (event.kind === 'transformer') {
			return {
				...dataset,
				transformers: dataset.transformers.map((transformer) =>
					transformer.id === event.id
						? ({ ...transformer, ...event.changes } as TransformerModel)
						: transformer,
				),
			};
		}
		if (event.kind === 'load') {
			return {
				...dataset,
				loads: dataset.loads.map((load) =>
					load.id === event.id ? ({ ...load, ...event.changes } as LoadModel) : load,
				),
			};
		}
		if (event.kind === 'generator') {
			return {
				...dataset,
				generators: dataset.generators.map((generator) =>
					generator.id === event.id
						? ({ ...generator, ...event.changes } as GeneratorModel)
						: generator,
				),
			};
		}
		return {
			...dataset,
			shuntCompensators: dataset.shuntCompensators.map((shunt) =>
				shunt.id === event.id
					? ({ ...shunt, ...event.changes } as ShuntCompensatorModel)
					: shunt,
			),
		};
	}
}
