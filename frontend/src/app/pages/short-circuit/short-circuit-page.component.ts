import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-short-circuit-page',
  templateUrl: './short-circuit-page.component.html',
  styleUrl: './short-circuit-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortCircuitPageComponent {}
