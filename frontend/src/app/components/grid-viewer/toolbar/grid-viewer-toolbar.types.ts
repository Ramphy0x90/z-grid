import type { GridColorMode } from '../models/grid.models';
import type { PlacementTool } from '../state/grid-viewer.facade';

export type ActiveView = 'map' | 'schematic';
export type MapStyleId = 'cartoDark' | 'cartoLight' | 'osmStandard' | 'openTopo';

export type MapStyleOption = {
	id: MapStyleId;
	label: string;
	tileUrl: string;
	attribution: string;
	maxZoom: number;
	backgroundColor: string;
};

export type ToolbarPlacementTool = Exclude<PlacementTool, null>;
export type ColorModeId = GridColorMode;
export type ColorModeOption = {
	id: ColorModeId;
	label: string;
	description: string;
};
