import type { NormalizedGridGraph } from '../data/grid-normalizer';
import type { SelectedElement, ViewportState } from '../state/grid-viewer.facade';

export type RenderSpace = 'map' | 'schematic';

const NODE_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute float aRadius;
attribute vec4 aColor;
uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uZoom;
uniform float uYSign;
varying vec4 vColor;

void main() {
  vec2 delta = (aPosition - uCenter) * uZoom;
  vec2 clip = vec2(delta.x / uHalfSize.x, (delta.y / uHalfSize.y) * uYSign);
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = clamp(aRadius * uZoom, 3.0, 18.0);
  vColor = aColor;
}
`;

const NODE_FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;

void main() {
  vec2 centered = gl_PointCoord * 2.0 - 1.0;
  float dist = dot(centered, centered);
  if (dist > 1.0) {
    discard;
  }
  gl_FragColor = vColor;
}
`;

const LINE_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec4 aColor;
uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uZoom;
uniform float uYSign;
varying vec4 vColor;

void main() {
  vec2 delta = (aPosition - uCenter) * uZoom;
  vec2 clip = vec2(delta.x / uHalfSize.x, (delta.y / uHalfSize.y) * uYSign);
  gl_Position = vec4(clip, 0.0, 1.0);
  vColor = aColor;
}
`;

const LINE_FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
}
`;

type BufferHandles = {
  linePositions: WebGLBuffer;
  lineColors: WebGLBuffer;
  nodePositions: WebGLBuffer;
  nodeRadii: WebGLBuffer;
  nodeColors: WebGLBuffer;
};

type ProgramHandles = {
  lineProgram: WebGLProgram;
  lineAttributes: {
    position: number;
    color: number;
  };
  lineUniforms: {
    center: WebGLUniformLocation;
    halfSize: WebGLUniformLocation;
    zoom: WebGLUniformLocation;
    ySign: WebGLUniformLocation;
  };
  nodeProgram: WebGLProgram;
  nodeAttributes: {
    position: number;
    radius: number;
    color: number;
  };
  nodeUniforms: {
    center: WebGLUniformLocation;
    halfSize: WebGLUniformLocation;
    zoom: WebGLUniformLocation;
    ySign: WebGLUniformLocation;
  };
};

const createShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to allocate WebGL shader.');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error.';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

const createProgram = (
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to allocate WebGL program.');
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error.';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
};

const getAttrib = (gl: WebGLRenderingContext, program: WebGLProgram, name: string): number => {
  const location = gl.getAttribLocation(program, name);
  if (location < 0) {
    throw new Error(`Missing attribute ${name}.`);
  }
  return location;
};

const getUniform = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation => {
  const location = gl.getUniformLocation(program, name);
  if (!location) {
    throw new Error(`Missing uniform ${name}.`);
  }
  return location;
};

const createBuffer = (gl: WebGLRenderingContext): WebGLBuffer => {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error('Failed to create WebGL buffer.');
  }
  return buffer;
};

const distanceToSegment = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
};

const clampZoom = (zoom: number): number => Math.min(5000, Math.max(0.05, zoom));

export class WebglGridRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly handles: ProgramHandles;
  private readonly buffers: BufferHandles;
  private viewport: ViewportState = { centerX: 0, centerY: 0, zoom: 100 };
  private graph: NormalizedGridGraph | null = null;
  private selected: SelectedElement = null;
  private hovered: SelectedElement = null;
  private canvasWidth = 1;
  private canvasHeight = 1;
  private readonly ySign: number;
  private readonly renderSpace: RenderSpace;
  private dynamicNodeColors: Float32Array = new Float32Array(0);
  private dynamicLineColors: Float32Array = new Float32Array(0);
  private lastInteractionKey = '';

  constructor(private readonly canvas: HTMLCanvasElement, renderSpace: RenderSpace) {
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
    if (!gl) {
      throw new Error('WebGL is not available in this browser.');
    }
    this.gl = gl;
    this.renderSpace = renderSpace;
    this.ySign = renderSpace === 'map' ? 1 : -1;

    const lineProgram = createProgram(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
    const nodeProgram = createProgram(gl, NODE_VERTEX_SHADER, NODE_FRAGMENT_SHADER);

    this.handles = {
      lineProgram,
      lineAttributes: {
        position: getAttrib(gl, lineProgram, 'aPosition'),
        color: getAttrib(gl, lineProgram, 'aColor'),
      },
      lineUniforms: {
        center: getUniform(gl, lineProgram, 'uCenter'),
        halfSize: getUniform(gl, lineProgram, 'uHalfSize'),
        zoom: getUniform(gl, lineProgram, 'uZoom'),
        ySign: getUniform(gl, lineProgram, 'uYSign'),
      },
      nodeProgram,
      nodeAttributes: {
        position: getAttrib(gl, nodeProgram, 'aPosition'),
        radius: getAttrib(gl, nodeProgram, 'aRadius'),
        color: getAttrib(gl, nodeProgram, 'aColor'),
      },
      nodeUniforms: {
        center: getUniform(gl, nodeProgram, 'uCenter'),
        halfSize: getUniform(gl, nodeProgram, 'uHalfSize'),
        zoom: getUniform(gl, nodeProgram, 'uZoom'),
        ySign: getUniform(gl, nodeProgram, 'uYSign'),
      },
    };

    this.buffers = {
      linePositions: createBuffer(gl),
      lineColors: createBuffer(gl),
      nodePositions: createBuffer(gl),
      nodeRadii: createBuffer(gl),
      nodeColors: createBuffer(gl),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.06, 0.06, 0.07, 1);
  }

  setGraph(graph: NormalizedGridGraph): void {
    this.graph = graph;
    this.dynamicNodeColors = new Float32Array(graph.nodeColors);
    this.dynamicLineColors = new Float32Array(graph.lineColors);
    this.lastInteractionKey = '';
    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.linePositions);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.renderSpace === 'map' ? graph.mapLineSegments : graph.schematicLineSegments,
      gl.STATIC_DRAW,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lineColors);
    gl.bufferData(gl.ARRAY_BUFFER, graph.lineColors, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nodePositions);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.renderSpace === 'map' ? graph.mapNodePositions : graph.schematicNodePositions,
      gl.STATIC_DRAW,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nodeRadii);
    gl.bufferData(gl.ARRAY_BUFFER, graph.nodeRadii, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nodeColors);
    gl.bufferData(gl.ARRAY_BUFFER, graph.nodeColors, gl.DYNAMIC_DRAW);
  }

  resize(width: number, height: number): void {
    this.canvasWidth = Math.max(1, Math.floor(width));
    this.canvasHeight = Math.max(1, Math.floor(height));
    const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.canvas.width = Math.max(1, Math.floor(this.canvasWidth * devicePixelRatio));
    this.canvas.height = Math.max(1, Math.floor(this.canvasHeight * devicePixelRatio));
    this.canvas.style.width = `${this.canvasWidth}px`;
    this.canvas.style.height = `${this.canvasHeight}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  setViewport(viewport: ViewportState): void {
    this.viewport = {
      centerX: viewport.centerX,
      centerY: viewport.centerY,
      zoom: clampZoom(viewport.zoom),
    };
  }

  getViewport(): ViewportState {
    return this.viewport;
  }

  zoomAt(screenX: number, screenY: number, zoomFactor: number): ViewportState {
    const worldBefore = this.screenToWorld(screenX, screenY);
    const nextZoom = clampZoom(this.viewport.zoom * zoomFactor);
    this.viewport = { ...this.viewport, zoom: nextZoom };
    const worldAfter = this.screenToWorld(screenX, screenY);
    this.viewport = {
      ...this.viewport,
      centerX: this.viewport.centerX + (worldBefore.x - worldAfter.x),
      centerY: this.viewport.centerY + (worldBefore.y - worldAfter.y),
    };
    return this.viewport;
  }

  panBy(deltaScreenX: number, deltaScreenY: number): ViewportState {
    this.viewport = {
      ...this.viewport,
      centerX: this.viewport.centerX - deltaScreenX / this.viewport.zoom,
      centerY: this.viewport.centerY - deltaScreenY / (this.viewport.zoom * this.ySign),
    };
    return this.viewport;
  }

  fitToBounds(bounds: { minX: number; minY: number; maxX: number; maxY: number }, paddingPx = 36): ViewportState {
    const width = Math.max(1, this.canvasWidth);
    const height = Math.max(1, this.canvasHeight);
    const spanX = Math.max(1e-6, bounds.maxX - bounds.minX);
    const spanY = Math.max(1e-6, bounds.maxY - bounds.minY);
    const usableWidth = Math.max(1, width - paddingPx * 2);
    const usableHeight = Math.max(1, height - paddingPx * 2);
    const zoom = clampZoom(Math.min(usableWidth / spanX, usableHeight / spanY));
    this.viewport = {
      centerX: bounds.minX + spanX / 2,
      centerY: bounds.minY + spanY / 2,
      zoom,
    };
    return this.viewport;
  }

  setInteraction(selected: SelectedElement, hovered: SelectedElement): void {
    this.selected = selected;
    this.hovered = hovered;
    const selectedKey = selected ? `${selected.kind}:${selected.id}` : '';
    const hoveredKey = hovered ? `${hovered.kind}:${hovered.id}` : '';
    const interactionKey = `${selectedKey}|${hoveredKey}`;
    if (interactionKey === this.lastInteractionKey || !this.graph) {
      return;
    }
    this.lastInteractionKey = interactionKey;
    this.dynamicNodeColors.set(this.graph.nodeColors);
    this.dynamicLineColors.set(this.graph.lineColors);

    const highlightedBusId =
      selected?.kind === 'bus' ? selected.id : hovered?.kind === 'bus' ? hovered.id : null;
    const highlightedEdgeId =
      selected?.kind === 'edge' ? selected.id : hovered?.kind === 'edge' ? hovered.id : null;

    if (highlightedBusId) {
      const busIndex = this.graph.busIndexById.get(highlightedBusId);
      if (busIndex !== undefined) {
        this.dynamicNodeColors[busIndex * 4] = 0;
        this.dynamicNodeColors[busIndex * 4 + 1] = 1;
        this.dynamicNodeColors[busIndex * 4 + 2] = 0.533;
        this.dynamicNodeColors[busIndex * 4 + 3] = 1;
      }
    }
    if (highlightedEdgeId) {
      const edgeIndex = this.graph.edgeIds.indexOf(highlightedEdgeId);
      if (edgeIndex >= 0) {
        this.dynamicLineColors[edgeIndex * 4] = 0;
        this.dynamicLineColors[edgeIndex * 4 + 1] = 1;
        this.dynamicLineColors[edgeIndex * 4 + 2] = 0.533;
        this.dynamicLineColors[edgeIndex * 4 + 3] = 1;
      }
    }
  }

  hitTest(screenX: number, screenY: number): SelectedElement {
    if (!this.graph) {
      return null;
    }
    const point = this.screenToWorld(screenX, screenY);
    const positions = this.renderSpace === 'map' ? this.graph.mapNodePositions : this.graph.schematicNodePositions;

    let nodeHit: SelectedElement = null;
    let bestNodeDistance = Number.POSITIVE_INFINITY;
    const hitRadiusBase = 10 / this.viewport.zoom;
    for (let index = 0; index < this.graph.busIds.length; index += 1) {
      const x = positions[index * 2];
      const y = positions[index * 2 + 1];
      const radius = Math.max(hitRadiusBase, this.graph.nodeRadii[index] / this.viewport.zoom);
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= radius && distance < bestNodeDistance) {
        bestNodeDistance = distance;
        nodeHit = { kind: 'bus', id: this.graph.busIds[index] };
      }
    }
    if (nodeHit) {
      return nodeHit;
    }

    const segments = this.renderSpace === 'map' ? this.graph.mapLineSegments : this.graph.schematicLineSegments;
    const lineThreshold = 6 / this.viewport.zoom;
    let edgeHit: SelectedElement = null;
    let bestLineDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.graph.edgeIds.length; index += 1) {
      const x1 = segments[index * 4];
      const y1 = segments[index * 4 + 1];
      const x2 = segments[index * 4 + 2];
      const y2 = segments[index * 4 + 3];
      const distance = distanceToSegment(point.x, point.y, x1, y1, x2, y2);
      if (distance <= lineThreshold && distance < bestLineDistance) {
        bestLineDistance = distance;
        edgeHit = { kind: 'edge', id: this.graph.edgeIds[index] };
      }
    }
    return edgeHit;
  }

  render(): void {
    if (!this.graph) {
      return;
    }
    const gl = this.gl;

    gl.clear(gl.COLOR_BUFFER_BIT);
    const halfSizeX = Math.max(1, this.canvasWidth / 2);
    const halfSizeY = Math.max(1, this.canvasHeight / 2);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lineColors);
    gl.bufferData(gl.ARRAY_BUFFER, this.dynamicLineColors, gl.DYNAMIC_DRAW);
    gl.useProgram(this.handles.lineProgram);
    gl.uniform2f(this.handles.lineUniforms.center, this.viewport.centerX, this.viewport.centerY);
    gl.uniform2f(this.handles.lineUniforms.halfSize, halfSizeX, halfSizeY);
    gl.uniform1f(this.handles.lineUniforms.zoom, this.viewport.zoom);
    gl.uniform1f(this.handles.lineUniforms.ySign, this.ySign);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.linePositions);
    gl.enableVertexAttribArray(this.handles.lineAttributes.position);
    gl.vertexAttribPointer(this.handles.lineAttributes.position, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lineColors);
    gl.enableVertexAttribArray(this.handles.lineAttributes.color);
    gl.vertexAttribPointer(this.handles.lineAttributes.color, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, this.graph.edgeIds.length * 2);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nodeColors);
    gl.bufferData(gl.ARRAY_BUFFER, this.dynamicNodeColors, gl.DYNAMIC_DRAW);
    gl.useProgram(this.handles.nodeProgram);
    gl.uniform2f(this.handles.nodeUniforms.center, this.viewport.centerX, this.viewport.centerY);
    gl.uniform2f(this.handles.nodeUniforms.halfSize, halfSizeX, halfSizeY);
    gl.uniform1f(this.handles.nodeUniforms.zoom, this.viewport.zoom);
    gl.uniform1f(this.handles.nodeUniforms.ySign, this.ySign);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nodePositions);
    gl.enableVertexAttribArray(this.handles.nodeAttributes.position);
    gl.vertexAttribPointer(this.handles.nodeAttributes.position, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nodeRadii);
    gl.enableVertexAttribArray(this.handles.nodeAttributes.radius);
    gl.vertexAttribPointer(this.handles.nodeAttributes.radius, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nodeColors);
    gl.enableVertexAttribArray(this.handles.nodeAttributes.color);
    gl.vertexAttribPointer(this.handles.nodeAttributes.color, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, this.graph.busIds.length);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.buffers.linePositions);
    gl.deleteBuffer(this.buffers.lineColors);
    gl.deleteBuffer(this.buffers.nodePositions);
    gl.deleteBuffer(this.buffers.nodeRadii);
    gl.deleteBuffer(this.buffers.nodeColors);
    gl.deleteProgram(this.handles.lineProgram);
    gl.deleteProgram(this.handles.nodeProgram);
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const halfW = this.canvasWidth / 2;
    const halfH = this.canvasHeight / 2;
    return {
      x: this.viewport.centerX + (screenX - halfW) / this.viewport.zoom,
      y: this.viewport.centerY + (halfH - screenY) / (this.viewport.zoom * this.ySign),
    };
  }
}
