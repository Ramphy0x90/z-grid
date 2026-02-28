import type {
  BusModel,
  GridDataset,
  LineModel,
  TransformerModel,
} from '../models/grid.models';

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
  edgeIds: string[];
  edgeKinds: ('line' | 'transformer')[];
  edgeBusPairIndices: Int32Array;
  mapNodePositions: Float32Array;
  schematicNodePositions: Float32Array;
  nodeColors: Float32Array;
  nodeRadii: Float32Array;
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

const colorForLine = (line: LineModel): number[] => {
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

const colorForTransformer = (transformer: TransformerModel): number[] => {
  if (!transformer.inService || !transformer.fromSwitchClosed || !transformer.toSwitchClosed) {
    return COLOR_EDGE_OFFLINE;
  }
  if (transformer.id.startsWith('xfmr-')) {
    return COLOR_USER_TRANSFORMER;
  }
  return COLOR_TRANSFORMER;
};

const copyColor = (target: Float32Array, targetOffset: number, color: readonly number[]): void => {
  target[targetOffset] = color[0] ?? 1;
  target[targetOffset + 1] = color[1] ?? 1;
  target[targetOffset + 2] = color[2] ?? 1;
  target[targetOffset + 3] = color[3] ?? 1;
};

export const normalizeGridDataset = (dataset: GridDataset): NormalizedGridGraph => {
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
    const mapY = layout?.lat ?? 0;
    const schematicX = layout?.schematicX ?? index * 16;
    const schematicY = layout?.schematicY ?? 0;

    mapNodePositions[index * 2] = mapX;
    mapNodePositions[index * 2 + 1] = mapY;
    schematicNodePositions[index * 2] = schematicX;
    schematicNodePositions[index * 2 + 1] = schematicY;
    addPointToBounds(mapBounds, mapX, mapY);
    addPointToBounds(schematicBounds, schematicX, schematicY);

    nodeRadii[index] = bus.busType === 'SLACK' ? 7 : bus.busType === 'PV' ? 6 : 5;
    copyColor(nodeColors, index * 4, bus.inService ? COLOR_NODE_ACTIVE : COLOR_NODE_OFFLINE);
  }

  const edges = [
    ...dataset.lines.map((line) => ({ id: line.id, from: line.fromBusId, to: line.toBusId, kind: 'line' as const })),
    ...dataset.transformers.map((tx) => ({ id: tx.id, from: tx.fromBusId, to: tx.toBusId, kind: 'transformer' as const })),
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
      copyColor(lineColors, index * 4, line ? colorForLine(line) : COLOR_EDGE_ACTIVE);
    } else {
      const transformer = transformerById.get(edge.id);
      copyColor(lineColors, index * 4, transformer ? colorForTransformer(transformer) : COLOR_TRANSFORMER);
    }
  }

  return {
    busIds,
    busById,
    busIndexById,
    edgeIds,
    edgeKinds,
    edgeBusPairIndices,
    mapNodePositions,
    schematicNodePositions,
    nodeColors,
    nodeRadii,
    mapLineSegments,
    schematicLineSegments,
    lineColors,
    mapBounds: finalizeBounds(mapBounds),
    schematicBounds: finalizeBounds(schematicBounds),
  };
};
