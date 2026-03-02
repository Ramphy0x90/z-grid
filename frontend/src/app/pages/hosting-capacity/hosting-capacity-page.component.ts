import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GridSelectorComponent } from '../../components/grid-selector/grid-selector.component';

@Component({
  selector: 'app-hosting-capacity-page',
  imports: [GridSelectorComponent],
  templateUrl: './hosting-capacity-page.component.html',
  styleUrl: './hosting-capacity-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HostingCapacityPageComponent {}
