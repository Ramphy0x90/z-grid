import { WebglGridRenderer } from './webgl-grid.renderer';

export class MapWebglRenderer extends WebglGridRenderer {
  constructor(canvas: HTMLCanvasElement) {
    super(canvas, 'map');
  }
}
