import { WebglGridRenderer } from './webgl-grid.renderer';

export class SchematicWebglRenderer extends WebglGridRenderer {
  constructor(canvas: HTMLCanvasElement) {
    super(canvas, 'schematic');
  }
}
