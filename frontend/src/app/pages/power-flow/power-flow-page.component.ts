import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-power-flow-page',
  templateUrl: './power-flow-page.component.html',
  styleUrl: './power-flow-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerFlowPageComponent {}
