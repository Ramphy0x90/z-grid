import type { BusModel, GridColorMode, GridDataset, LineModel, TransformerModel } from '../models/grid.models';
import { latToMercatorY } from '../utils/web-mercator';

export type Bounds = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

export type NormalizedGridGraph = {
	busIds: string[];
	busById: ReadonlyMap<string, BusModel>;
	busIndexById: ReadonlyMap<string, number>;
	attachedElementIds: string[];
	attachedElementKinds: ('load' | 'generator' | 'shunt')[];
	edgeIds: string[];
	edgeKinds: ('line' | 'transformer')[];
	edgeBusPairIndices: Int32Array;
	mapNodePositions: Float32Array;
	schematicNodePositions: Float32Array;
	nodeColors: Float32Array;
	nodeRadii: Float32Array;
	mapAttachedPositions: Float32Array;
	schematicAttachedPositions: Float32Array;
	attachedColors: Float32Array;
	attachedRadii: Float32Array;
	mapLineSegments: Float32Array;
	schematicLineSegments: Float32Array;
	lineColors: Float32Array;
	mapBounds: Bounds;
	schematicBounds: Bounds;
};

const COLOR_NODE_ACTIVE = [0, 0.831, 1, 1];
const COLOR_NODE_OFFLINE = [0.42, 0.42, 0.45, 1];
const COLOR_EDGE_ACTIVE = [0, 0.89, 1, 0.95];
const COLOR_EDGE_ALERT = [1, 0.353, 0.353, 0.85];
const COLOR_EDGE_OFFLINE = [0.33, 0.33, 0.35, 0.45];
const COLOR_TRANSFORMER = [0, 1, 0.533, 0.95];
const COLOR_USER_LINE = [1, 0.94, 0.2, 1];
const COLOR_USER_TRANSFORMER = [1, 0.71, 0.2, 1];
const COLOR_LOAD = [0.973, 0.443, 0.443, 0];
const COLOR_GENERATOR = [0.204, 0.827, 0.6, 0];
const COLOR_SHUNT = [0.58, 0.74, 1, 1];
const COLOR_EDGE_MIXED_VOLTAGE = [0.66, 0.66, 0.72, 0.9];
const COLOR_PALETTE: readonly [number, number, number, number][] = [
	[0.89, 0.36, 0.36, 0.95],
	[0.97, 0.68, 0.23, 0.95],
	[0.95, 0.9, 0.29, 0.95],
	[0.46, 0.83, 0.36, 0.95],
	[0.22, 0.84, 0.74, 0.95],
	[0.29, 0.58, 0.94, 0.95],
	[0.62, 0.45, 0.93, 0.95],
	[0.89, 0.42, 0.73, 0.95],
];
const COLOR_ATTACHED_OFFLINE: readonly number[] = [0.45, 0.45, 0.48, 0.8];

const createEmptyBounds = (): Bounds => ({
	minX: Number.POSITIVE_INFINITY,
	minY: Number.POSITIVE_INFINITY,
	maxX: Number.NEGATIVE_INFINITY,
	maxY: Number.NEGATIVE_INFINITY,
});

const addPointToBounds = (bounds: Bounds, x: number, y: number): void => {
	bounds.minX = Math.min(bounds.minX, x);
	bounds.minY = Math.min(bounds.minY, y);
	bounds.maxX = Math.max(bounds.maxX, x);
	bounds.maxY = Math.max(bounds.maxY, y);
};

const finalizeBounds = (bounds: Bounds): Bounds => {
	if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
		return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
	}
	const minSpan = 1e-6;
	if (Math.abs(bounds.maxX - bounds.minX) < minSpan) {
		bounds.minX -= 0.5;
		bounds.maxX += 0.5;
	}
	if (Math.abs(bounds.maxY - bounds.minY) < minSpan) {
		bounds.minY -= 0.5;
		bounds.maxY += 0.5;
	}
	return bounds;
};

const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

const colorForLineByEnergized = (line: LineModel): readonly number[] => {
	if (!line.inService || !line.fromSwitchClosed || !line.toSwitchClosed) {
		return COLOR_EDGE_OFFLINE;
	}
	if (line.id.startsWith('line-')) {
		return COLOR_USER_LINE;
	}
	if (line.ratingMva > 0) {
		const loading = (line.lengthKm * 8) / line.ratingMva;
		if (loading > 0.45) {
			return COLOR_EDGE_ALERT;
		}
	}
	return COLOR_EDGE_ACTIVE;
};

const colorForTransformerByEnergized = (transformer: TransformerModel): readonly number[] => {
	if (!transformer.inService || !transformer.fromSwitchClosed || !transformer.toSwitchClosed) {
		return COLOR_EDGE_OFFLINE;
	}
	if (transformer.id.startsWith('xfmr-')) {
		return COLOR_USER_TRANSFORMER;
	}
	return COLOR_TRANSFORMER;
};

const colorForAttachedByKind = (kind: 'load' | 'generator' | 'shunt'): readonly number[] => {
	if (kind === 'generator') {
		return COLOR_GENERATOR;
	}
	if (kind === 'load') {
		return COLOR_LOAD;
	}
	return COLOR_SHUNT;
};

const isTransformerEnergized = (transformer: TransformerModel): boolean =>
	transformer.inService && transformer.fromSwitchClosed && transformer.toSwitchClosed;

const isLineEnergized = (line: LineModel): boolean =>
	line.inService && line.fromSwitchClosed && line.toSwitchClosed;

const hashString = (value: string): number => {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
	}
	return hash;
};

const colorFromPalette = (key: string): readonly number[] =>
	COLOR_PALETTE[hashString(key) % COLOR_PALETTE.length] ?? COLOR_EDGE_ACTIVE;

const collectTransformerGroups = (
	dataset: GridDataset,
): Array<{ transformerId: string; busIds: Set<string>; edgeIds: Set<string> }> => {
	const groups: Array<{ transformerId: string; busIds: Set<string>; edgeIds: Set<string> }> = [];
	const hintedGroups = dataset.visualization?.transformerGroups ?? null;
	if (hintedGroups && typeof hintedGroups === 'object') {
		for (const [transformerId, group] of Object.entries(hintedGroups)) {
			const busIds = new Set<string>(Array.isArray(group?.busIds) ? group.busIds : []);
			const edgeIds = new Set<string>(Array.isArray(group?.edgeIds) ? group.edgeIds : []);
			edgeIds.add(transformerId);
			groups.push({ transformerId, busIds, edgeIds });
		}
		return groups;
	}

	const edgeIdsByBusId = new Map<string, Set<string>>();
	const addEdgeForBus = (busId: string, edgeId: string): void => {
		const bucket = edgeIdsByBusId.get(busId) ?? new Set<string>();
		bucket.add(edgeId);
		edgeIdsByBusId.set(busId, bucket);
	};
	for (const line of dataset.lines) {
		addEdgeForBus(line.fromBusId, line.id);
		addEdgeForBus(line.toBusId, line.id);
	}
	for (const transformer of dataset.transformers) {
		addEdgeForBus(transformer.fromBusId, transformer.id);
		addEdgeForBus(transformer.toBusId, transformer.id);
	}

	for (const transformer of dataset.transformers) {
		const busIds = new Set<string>([transformer.fromBusId, transformer.toBusId]);
		const edgeIds = new Set<string>([transformer.id]);
		const firstBusEdges = edgeIdsByBusId.get(transformer.fromBusId);
		if (firstBusEdges) {
			for (const edgeId of firstBusEdges) {
				edgeIds.add(edgeId);
			}
		}
		const secondBusEdges = edgeIdsByBusId.get(transformer.toBusId);
		if (secondBusEdges) {
			for (const edgeId of secondBusEdges) {
				edgeIds.add(edgeId);
			}
		}
		groups.push({ transformerId: transformer.id, busIds, edgeIds });
	}
	return groups;
};

const copyColor = (target: Float32Array, targetOffset: number, color: readonly number[]): void => {
	target[targetOffset] = color[0] ?? 1;
	target[targetOffset + 1] = color[1] ?? 1;
	target[targetOffset + 2] = color[2] ?? 1;
	target[targetOffset + 3] = color[3] ?? 1;
};

export const normalizeGridDataset = (
	dataset: GridDataset,
	colorMode: GridColorMode = 'energized',
): NormalizedGridGraph => {
	const busIds = dataset.buses.map((bus) => bus.id);
	const busById = new Map(dataset.buses.map((bus) => [bus.id, bus]));
	const busIndexById = new Map(busIds.map((id, index) => [id, index]));
	const layoutByBusId = new Map(dataset.busLayout.map((layout) => [layout.busId, layout]));

	const nodeCount = busIds.length;
	const mapNodePositions = new Float32Array(nodeCount * 2);
	const schematicNodePositions = new Float32Array(nodeCount * 2);
	const nodeColors = new Float32Array(nodeCount * 4);
	const nodeRadii = new Float32Array(nodeCount);

	const mapBounds = createEmptyBounds();
	const schematicBounds = createEmptyBounds();

	for (let index = 0; index < nodeCount; index += 1) {
		const bus = dataset.buses[index];
		const layout = layoutByBusId.get(bus.id);
		const mapX = layout?.lng ?? 0;
		const mapY = latToMercatorY(layout?.lat ?? 0);
		const schematicX = layout?.schematicX ?? index * 16;
		const schematicY = layout?.schematicY ?? 0;

		mapNodePositions[index * 2] = mapX;
		mapNodePositions[index * 2 + 1] = mapY;
		schematicNodePositions[index * 2] = schematicX;
		schematicNodePositions[index * 2 + 1] = schematicY;
		addPointToBounds(mapBounds, mapX, mapY);
		addPointToBounds(schematicBounds, schematicX, schematicY);

		nodeRadii[index] = bus.busType === 'SLACK' ? 7 : bus.busType === 'PV' ? 6 : 5;
		copyColor(nodeColors, index * 4, COLOR_NODE_ACTIVE);
	}

	const mapSpanX = Math.abs(mapBounds.maxX - mapBounds.minX);
	const mapSpanY = Math.abs(mapBounds.maxY - mapBounds.minY);
	const schematicSpanX = Math.abs(schematicBounds.maxX - schematicBounds.minX);
	const schematicSpanY = Math.abs(schematicBounds.maxY - schematicBounds.minY);
	const mapAttachmentOffset = clamp(Math.max(mapSpanX, mapSpanY, 0.25) * 0.012, 0.0018, 0.008);
	const schematicAttachmentOffset = clamp(
		Math.max(schematicSpanX, schematicSpanY, 40) * 0.012,
		0.8,
		2.8,
	);

	const attachedByBusId = new Map<
		string,
		Array<{ id: string; kind: 'load' | 'generator' | 'shunt' }>
	>();
	for (const load of dataset.loads) {
		const bucket = attachedByBusId.get(load.busId) ?? [];
		bucket.push({ id: load.id, kind: 'load' });
		attachedByBusId.set(load.busId, bucket);
	}
	for (const generator of dataset.generators) {
		const bucket = attachedByBusId.get(generator.busId) ?? [];
		bucket.push({ id: generator.id, kind: 'generator' });
		attachedByBusId.set(generator.busId, bucket);
	}
	for (const shunt of dataset.shuntCompensators) {
		const bucket = attachedByBusId.get(shunt.busId) ?? [];
		bucket.push({ id: shunt.id, kind: 'shunt' });
		attachedByBusId.set(shunt.busId, bucket);
	}

	const attachedElements: Array<{
		id: string;
		kind: 'load' | 'generator' | 'shunt';
		busId: string;
		mapX: number;
		mapY: number;
		schematicX: number;
		schematicY: number;
	}> = [];
	for (let busIndex = 0; busIndex < busIds.length; busIndex += 1) {
		const busId = busIds[busIndex];
		const attached = attachedByBusId.get(busId);
		if (!attached || attached.length === 0) {
			continue;
		}
		const mapBusX = mapNodePositions[busIndex * 2];
		const mapBusY = mapNodePositions[busIndex * 2 + 1];
		const schematicBusX = schematicNodePositions[busIndex * 2];
		const schematicBusY = schematicNodePositions[busIndex * 2 + 1];
		for (let attachedIndex = 0; attachedIndex < attached.length; attachedIndex += 1) {
			const item = attached[attachedIndex];
			const angle = ((attachedIndex % Math.max(1, attached.length)) / Math.max(1, attached.length)) * Math.PI * 2;
			const mapX = mapBusX + Math.cos(angle) * mapAttachmentOffset;
			const mapY = mapBusY + Math.sin(angle) * mapAttachmentOffset;
			const schematicX = schematicBusX + Math.cos(angle) * schematicAttachmentOffset;
			const schematicY = schematicBusY + Math.sin(angle) * schematicAttachmentOffset;
			attachedElements.push({
				id: item.id,
				kind: item.kind,
				busId,
				mapX,
				mapY,
				schematicX,
				schematicY,
			});
			addPointToBounds(mapBounds, mapX, mapY);
			addPointToBounds(schematicBounds, schematicX, schematicY);
		}
	}

	const attachedCount = attachedElements.length;
	const attachedElementIds = new Array<string>(attachedCount);
	const attachedElementKinds = new Array<'load' | 'generator' | 'shunt'>(attachedCount);
	const mapAttachedPositions = new Float32Array(attachedCount * 2);
	const schematicAttachedPositions = new Float32Array(attachedCount * 2);
	const attachedColors = new Float32Array(attachedCount * 4);
	const attachedRadii = new Float32Array(attachedCount);
	for (let index = 0; index < attachedCount; index += 1) {
		const item = attachedElements[index];
		attachedElementIds[index] = item.id;
		attachedElementKinds[index] = item.kind;
		mapAttachedPositions[index * 2] = item.mapX;
		mapAttachedPositions[index * 2 + 1] = item.mapY;
		schematicAttachedPositions[index * 2] = item.schematicX;
		schematicAttachedPositions[index * 2 + 1] = item.schematicY;
		attachedRadii[index] = item.kind === 'generator' ? 4.6 : item.kind === 'load' ? 4.2 : 4;
		copyColor(
			attachedColors,
			index * 4,
			colorForAttachedByKind(item.kind),
		);
	}

	const edges = [
		...dataset.lines.map((line) => ({
			id: line.id,
			from: line.fromBusId,
			to: line.toBusId,
			kind: 'line' as const,
		})),
		...dataset.transformers.map((tx) => ({
			id: tx.id,
			from: tx.fromBusId,
			to: tx.toBusId,
			kind: 'transformer' as const,
		})),
	];

	const edgeCount = edges.length;
	const edgeIds: string[] = new Array(edgeCount);
	const edgeKinds: ('line' | 'transformer')[] = new Array(edgeCount);
	const edgeBusPairIndices = new Int32Array(edgeCount * 2);
	const mapLineSegments = new Float32Array(edgeCount * 4);
	const schematicLineSegments = new Float32Array(edgeCount * 4);
	const lineColors = new Float32Array(edgeCount * 4);

	const lineById = new Map(dataset.lines.map((line) => [line.id, line]));
	const transformerById = new Map(dataset.transformers.map((tx) => [tx.id, tx]));

	for (let index = 0; index < edgeCount; index += 1) {
		const edge = edges[index];
		const fromIndex = busIndexById.get(edge.from);
		const toIndex = busIndexById.get(edge.to);
		if (fromIndex === undefined || toIndex === undefined) {
			continue;
		}
		edgeIds[index] = edge.id;
		edgeKinds[index] = edge.kind;
		edgeBusPairIndices[index * 2] = fromIndex;
		edgeBusPairIndices[index * 2 + 1] = toIndex;

		mapLineSegments[index * 4] = mapNodePositions[fromIndex * 2];
		mapLineSegments[index * 4 + 1] = mapNodePositions[fromIndex * 2 + 1];
		mapLineSegments[index * 4 + 2] = mapNodePositions[toIndex * 2];
		mapLineSegments[index * 4 + 3] = mapNodePositions[toIndex * 2 + 1];
		schematicLineSegments[index * 4] = schematicNodePositions[fromIndex * 2];
		schematicLineSegments[index * 4 + 1] = schematicNodePositions[fromIndex * 2 + 1];
		schematicLineSegments[index * 4 + 2] = schematicNodePositions[toIndex * 2];
		schematicLineSegments[index * 4 + 3] = schematicNodePositions[toIndex * 2 + 1];

		if (edge.kind === 'line') {
			const line = lineById.get(edge.id);
			copyColor(lineColors, index * 4, line ? colorForLineByEnergized(line) : COLOR_EDGE_ACTIVE);
		} else {
			const transformer = transformerById.get(edge.id);
			copyColor(
				lineColors,
				index * 4,
				transformer ? colorForTransformerByEnergized(transformer) : COLOR_TRANSFORMER,
			);
		}
	}

	if (colorMode === 'energized') {
		for (let index = 0; index < dataset.buses.length; index += 1) {
			copyColor(
				nodeColors,
				index * 4,
				dataset.buses[index]?.inService ? COLOR_NODE_ACTIVE : COLOR_NODE_OFFLINE,
			);
		}
		const loadById = new Map(dataset.loads.map((load) => [load.id, load]));
		const generatorById = new Map(dataset.generators.map((generator) => [generator.id, generator]));
		const shuntById = new Map(dataset.shuntCompensators.map((shunt) => [shunt.id, shunt]));
		for (let index = 0; index < attachedCount; index += 1) {
			const item = attachedElements[index];
			const inService =
				item.kind === 'load'
					? (loadById.get(item.id)?.inService ?? false)
					: item.kind === 'generator'
						? (generatorById.get(item.id)?.inService ?? false)
						: (shuntById.get(item.id)?.inService ?? false);
			copyColor(
				attachedColors,
				index * 4,
				inService ? colorForAttachedByKind(item.kind) : COLOR_ATTACHED_OFFLINE,
			);
		}
	} else if (colorMode === 'voltageLevel') {
		const busColorById = new Map<string, readonly number[]>();
		for (const bus of dataset.buses) {
			const voltageBucket = `${Math.round(bus.nominalVoltageKv * 100) / 100}kV`;
			busColorById.set(bus.id, colorFromPalette(voltageBucket));
		}
		for (let index = 0; index < busIds.length; index += 1) {
			const busId = busIds[index];
			copyColor(nodeColors, index * 4, busColorById.get(busId) ?? COLOR_NODE_ACTIVE);
		}
		for (let index = 0; index < edgeCount; index += 1) {
			const edge = edges[index];
			const fromColor = busColorById.get(edge.from);
			const toColor = busColorById.get(edge.to);
			if (fromColor && toColor && fromColor === toColor) {
				copyColor(lineColors, index * 4, fromColor);
			} else {
				copyColor(lineColors, index * 4, COLOR_EDGE_MIXED_VOLTAGE);
			}
		}
		for (let index = 0; index < attachedCount; index += 1) {
			const item = attachedElements[index];
			copyColor(
				attachedColors,
				index * 4,
				busColorById.get(item.busId) ?? colorForAttachedByKind(item.kind),
			);
		}
	} else {
		for (let index = 0; index < dataset.buses.length; index += 1) {
			copyColor(nodeColors, index * 4, COLOR_NODE_OFFLINE);
		}
		for (let index = 0; index < edgeCount; index += 1) {
			copyColor(lineColors, index * 4, COLOR_EDGE_OFFLINE);
		}
		for (let index = 0; index < attachedCount; index += 1) {
			copyColor(attachedColors, index * 4, COLOR_ATTACHED_OFFLINE);
		}

		const busIndexLookup = new Map(busIds.map((id, index) => [id, index]));
		const edgeIndexLookup = new Map(edgeIds.map((id, index) => [id, index]));
		const groups = collectTransformerGroups(dataset)
			.filter((group) => transformerById.has(group.transformerId));
		for (const group of groups) {
			const color = colorFromPalette(group.transformerId);
			for (const busId of group.busIds) {
				const busIndex = busIndexLookup.get(busId);
				if (busIndex !== undefined) {
					copyColor(nodeColors, busIndex * 4, color);
				}
			}
			for (const edgeId of group.edgeIds) {
				const edgeIndex = edgeIndexLookup.get(edgeId);
				if (edgeIndex !== undefined) {
					copyColor(lineColors, edgeIndex * 4, color);
				}
			}
		}
		for (let index = 0; index < attachedCount; index += 1) {
			const item = attachedElements[index];
			const busIndex = busIndexLookup.get(item.busId);
			if (busIndex !== undefined) {
				const nodeColorOffset = busIndex * 4;
				const attachedColorOffset = index * 4;
				attachedColors[attachedColorOffset] = nodeColors[nodeColorOffset];
				attachedColors[attachedColorOffset + 1] = nodeColors[nodeColorOffset + 1];
				attachedColors[attachedColorOffset + 2] = nodeColors[nodeColorOffset + 2];
				attachedColors[attachedColorOffset + 3] = nodeColors[nodeColorOffset + 3];
			}
		}

		for (let index = 0; index < dataset.lines.length; index += 1) {
			const line = dataset.lines[index];
			if (!isLineEnergized(line)) {
				const edgeIndex = edgeIndexLookup.get(line.id);
				if (edgeIndex !== undefined) {
					copyColor(lineColors, edgeIndex * 4, COLOR_EDGE_OFFLINE);
				}
			}
		}
		for (let index = 0; index < dataset.transformers.length; index += 1) {
			const transformer = dataset.transformers[index];
			if (!isTransformerEnergized(transformer)) {
				const edgeIndex = edgeIndexLookup.get(transformer.id);
				if (edgeIndex !== undefined) {
					copyColor(lineColors, edgeIndex * 4, COLOR_EDGE_OFFLINE);
				}
			}
		}
	}

	return {
		busIds,
		busById,
		busIndexById,
		attachedElementIds,
		attachedElementKinds,
		edgeIds,
		edgeKinds,
		edgeBusPairIndices,
		mapNodePositions,
		schematicNodePositions,
		nodeColors,
		nodeRadii,
		mapAttachedPositions,
		schematicAttachedPositions,
		attachedColors,
		attachedRadii,
		mapLineSegments,
		schematicLineSegments,
		lineColors,
		mapBounds: finalizeBounds(mapBounds),
		schematicBounds: finalizeBounds(schematicBounds),
	};
};
