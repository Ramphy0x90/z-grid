import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-grid-editor-page',
  templateUrl: './grid-editor-page.component.html',
  styleUrl: './grid-editor-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridEditorPageComponent {}
