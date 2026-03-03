import type { MapStyleOption } from './grid-viewer-toolbar.types';

export const MAP_STYLE_OPTIONS: readonly MapStyleOption[] = [
	{
		id: 'cartoDark',
		label: 'CARTO Dark',
		tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
		attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
		maxZoom: 20,
		backgroundColor: '#181a1b',
	},
	{
		id: 'cartoLight',
		label: 'CARTO Light',
		tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
		attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
		maxZoom: 20,
		backgroundColor: '#f5f5f3',
	},
	{
		id: 'osmStandard',
		label: 'OSM Standard',
		tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
		attribution: '&copy; OpenStreetMap contributors',
		maxZoom: 19,
		backgroundColor: '#f2efe9',
	},
	{
		id: 'openTopo',
		label: 'OpenTopoMap',
		tileUrl: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
		attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap',
		maxZoom: 17,
		backgroundColor: '#f3f1ec',
	},
];
