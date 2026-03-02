import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GridSelectorComponent } from '../../components/grid-selector/grid-selector.component';

@Component({
  selector: 'app-grid-upgrade-page',
  imports: [GridSelectorComponent],
  templateUrl: './grid-upgrade-page.component.html',
  styleUrl: './grid-upgrade-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridUpgradePageComponent {}
