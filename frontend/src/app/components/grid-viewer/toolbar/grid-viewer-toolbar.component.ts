import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MAP_STYLE_OPTIONS } from './grid-viewer-toolbar.constants';
import type {
	ActiveView,
	MapStyleId,
	MapStyleOption,
	ToolbarPlacementTool,
} from './grid-viewer-toolbar.types';

@Component({
	selector: 'app-grid-viewer-toolbar',
	templateUrl: './grid-viewer-toolbar.component.html',
	styleUrl: './grid-viewer-toolbar.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridViewerToolbarComponent {
	readonly activeView = input<ActiveView>('schematic');
	readonly mapStyleOptions = input<readonly MapStyleOption[]>(MAP_STYLE_OPTIONS);
	readonly selectedMapStyleId = input<MapStyleId>('cartoDark');
	readonly totalElements = input(0);
	readonly editEnabled = input(false);
	readonly placementMode = input<ToolbarPlacementTool | null>(null);

	readonly activeViewChange = output<ActiveView>();
	readonly mapStyleChange = output<MapStyleId>();
	readonly fitViewRequested = output<void>();
	readonly zoomInRequested = output<void>();
	readonly zoomOutRequested = output<void>();
	readonly placementModeToggleRequested = output<ToolbarPlacementTool>();

	protected setActiveView(view: ActiveView): void {
		this.activeViewChange.emit(view);
	}

	protected onMapStyleChange(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) {
			return;
		}
		const value = target.value;
		if (!this.isMapStyleId(value)) {
			return;
		}
		this.mapStyleChange.emit(value);
	}

	protected requestPlacementMode(tool: ToolbarPlacementTool): void {
		this.placementModeToggleRequested.emit(tool);
	}

	private isMapStyleId(value: string): value is MapStyleId {
		return this.mapStyleOptions().some((style) => style.id === value);
	}
}
