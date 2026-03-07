import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { COLOR_MODE_OPTIONS } from './grid-viewer-toolbar.constants';
import type {
	ActiveView,
	ColorModeId,
	ColorModeOption,
	ToolbarPlacementTool,
} from './grid-viewer-toolbar.types';

@Component({
	selector: 'app-grid-viewer-toolbar',
	templateUrl: './grid-viewer-toolbar.component.html',
	styleUrl: './grid-viewer-toolbar.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridViewerToolbarComponent {
	readonly activeView = input<ActiveView>('map');
	readonly colorModeOptions = input<readonly ColorModeOption[]>(COLOR_MODE_OPTIONS);
	readonly selectedColorModeId = input<ColorModeId>('energized');
	readonly totalElements = input(0);
	readonly editEnabled = input(false);
	readonly placementMode = input<ToolbarPlacementTool | null>(null);

	readonly activeViewChange = output<ActiveView>();
	readonly colorModeChange = output<ColorModeId>();
	readonly fitViewRequested = output<void>();
	readonly zoomInRequested = output<void>();
	readonly zoomOutRequested = output<void>();
	readonly placementModeToggleRequested = output<ToolbarPlacementTool>();

	protected setActiveView(view: ActiveView): void {
		this.activeViewChange.emit(view);
	}

	protected requestPlacementMode(tool: ToolbarPlacementTool): void {
		this.placementModeToggleRequested.emit(tool);
	}

	protected onColorModeChange(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) {
			return;
		}
		const value = target.value;
		if (!this.isColorModeId(value)) {
			return;
		}
		this.colorModeChange.emit(value);
	}

	private isColorModeId(value: string): value is ColorModeId {
		return this.colorModeOptions().some((mode) => mode.id === value);
	}
}
