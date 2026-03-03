import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjectService } from './project.service';
import type { GridDataset } from '../components/grid-viewer/models/grid.models';

describe('ProjectService', () => {
	let service: ProjectService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [ProjectService, provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(ProjectService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('should install example project and prepend it to projects state', () => {
		const response = {
			id: 'project-1',
			teamId: 'team-1',
			name: 'Zurich Example Project',
			description: 'Static grid example',
		};
		service.installExampleProject$({ exampleKey: 'zurich' }).subscribe();

		const request = httpMock.expectOne('http://localhost:8080/api/project/install-example');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({ exampleKey: 'zurich' });
		request.flush(response);

		expect(service.projects()[0]).toEqual({
			id: 'project-1',
			teamId: 'team-1',
			name: 'Zurich Example Project',
			description: 'Static grid example',
		});
	});

	it('prepares imported dataset for a target grid', () => {
		const dataset: GridDataset = {
			grid: {
				id: 'source-grid',
				projectId: 'source-project',
				name: 'Source Name',
				description: 'Source Description',
				baseMva: 100,
				frequencyHz: 50,
			},
			buses: [
				{
					id: 'bus-1',
					gridId: 'source-grid',
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
			],
			lines: [
				{
					id: 'line-1',
					gridId: 'source-grid',
					fromBusId: 'bus-1',
					toBusId: 'bus-1',
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
					gridId: 'source-grid',
					fromBusId: 'bus-1',
					toBusId: 'bus-1',
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
			busLayout: [],
			edgeLayout: [],
		};

		const prepared = service.prepareDatasetForGrid(dataset, {
			id: 'grid-new',
			projectId: 'project-1',
			name: 'New Grid',
			description: 'Imported',
			busCount: 0,
		});

		expect(prepared.grid.id).toBe('grid-new');
		expect(prepared.grid.projectId).toBe('project-1');
		expect(prepared.grid.name).toBe('New Grid');
		expect(prepared.buses[0].gridId).toBe('grid-new');
		expect(prepared.lines[0].gridId).toBe('grid-new');
		expect(prepared.transformers[0].gridId).toBe('grid-new');
	});
});
