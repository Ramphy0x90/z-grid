import { normalizeGridDataset } from './grid-normalizer';
import type { GridDataset } from '../models/grid.models';
import { describe, expect, it } from 'vitest';

const createDataset = (): GridDataset => ({
	grid: {
		id: 'grid-1',
		projectId: 'project-1',
		name: 'Grid',
		description: '',
		baseMva: 100,
		frequencyHz: 50,
	},
	buses: [
		{
			id: 'bus-1',
			gridId: 'grid-1',
			name: 'Bus 1',
			nominalVoltageKv: 110,
			busType: 'PQ',
			voltageMagnitudePu: 1,
			voltageAngleDeg: 0,
			minVoltagePu: 0.95,
			maxVoltagePu: 1.05,
			inService: true,
			area: '1',
			zone: '1',
		},
		{
			id: 'bus-2',
			gridId: 'grid-1',
			name: 'Bus 2',
			nominalVoltageKv: 110,
			busType: 'PQ',
			voltageMagnitudePu: 1,
			voltageAngleDeg: 0,
			minVoltagePu: 0.95,
			maxVoltagePu: 1.05,
			inService: true,
			area: '1',
			zone: '1',
		},
		{
			id: 'bus-3',
			gridId: 'grid-1',
			name: 'Bus 3',
			nominalVoltageKv: 20,
			busType: 'PQ',
			voltageMagnitudePu: 1,
			voltageAngleDeg: 0,
			minVoltagePu: 0.95,
			maxVoltagePu: 1.05,
			inService: false,
			area: '1',
			zone: '1',
		},
	],
	lines: [
		{
			id: 'line-1',
			gridId: 'grid-1',
			fromBusId: 'bus-1',
			toBusId: 'bus-3',
			name: 'Line 1',
			resistancePu: 0.01,
			reactancePu: 0.04,
			susceptancePu: 0.001,
			ratingMva: 80,
			lengthKm: 3,
			inService: true,
			ratingMvaShortTerm: 90,
			maxLoadingPercent: 100,
			fromSwitchClosed: true,
			toSwitchClosed: true,
		},
	],
	transformers: [
		{
			id: 'tx-1',
			gridId: 'grid-1',
			fromBusId: 'bus-1',
			toBusId: 'bus-2',
			name: 'TX 1',
			resistancePu: 0.01,
			reactancePu: 0.05,
			magnetizingSusceptancePu: 0.001,
			ratingMva: 60,
			inService: true,
			tapRatio: 1,
			tapMin: 0.9,
			tapMax: 1.1,
			tapStepPercent: 1.25,
			tapSide: 'HV',
			windingType: 'TWO_WINDING',
			maxLoadingPercent: 100,
			fromSwitchClosed: true,
			toSwitchClosed: true,
		},
	],
	loads: [],
	generators: [],
	shuntCompensators: [],
	busLayout: [
		{ busId: 'bus-1', lat: 0, lng: 0, schematicX: 0, schematicY: 0 },
		{ busId: 'bus-2', lat: 0, lng: 1, schematicX: 10, schematicY: 0 },
		{ busId: 'bus-3', lat: 1, lng: 2, schematicX: 20, schematicY: 0 },
	],
	edgeLayout: [],
	visualization: {
		transformerGroups: {
			'tx-1': {
				busIds: ['bus-1', 'bus-2'],
				edgeIds: ['tx-1', 'line-1'],
			},
		},
	},
});

const colorAt = (colors: Float32Array, index: number): number[] => [
	colors[index * 4],
	colors[index * 4 + 1],
	colors[index * 4 + 2],
	colors[index * 4 + 3],
];

const expectSameColor = (left: number[], right: number[]): void => {
	for (let index = 0; index < 4; index += 1) {
		expect(left[index]).toBeCloseTo(right[index], 4);
	}
};

describe('normalizeGridDataset color modes', () => {
	it('colors by energized state in energized mode', () => {
		const graph = normalizeGridDataset(createDataset(), 'energized');
		const bus1Color = colorAt(graph.nodeColors, 0);
		const bus3Color = colorAt(graph.nodeColors, 2);
		expect(bus1Color[3]).toBeCloseTo(1, 4);
		expect(bus3Color[3]).toBeCloseTo(1, 4);
		expect(bus1Color[0]).not.toBeCloseTo(bus3Color[0], 3);
	});

	it('colors buses by nominal voltage level in voltage mode', () => {
		const graph = normalizeGridDataset(createDataset(), 'voltageLevel');
		const bus1Color = colorAt(graph.nodeColors, 0);
		const bus2Color = colorAt(graph.nodeColors, 1);
		const bus3Color = colorAt(graph.nodeColors, 2);
		expectSameColor(bus1Color, bus2Color);
		expect(bus1Color[0]).not.toBeCloseTo(bus3Color[0], 3);
	});

	it('uses transformer grouping hints for transformer group mode', () => {
		const graph = normalizeGridDataset(createDataset(), 'transformerGroup');
		const bus1Color = colorAt(graph.nodeColors, 0);
		const bus2Color = colorAt(graph.nodeColors, 1);
		const txColor = colorAt(graph.lineColors, 1);
		const lineColor = colorAt(graph.lineColors, 0);
		expectSameColor(bus1Color, bus2Color);
		expectSameColor(txColor, lineColor);
	});
});
