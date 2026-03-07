import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HostingCapacityRunService } from './hosting-capacity-run.service';

describe('HostingCapacityRunService', () => {
	let service: HostingCapacityRunService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [HostingCapacityRunService, provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(HostingCapacityRunService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('starts hosting-capacity run with simulationType HOSTING_CAPACITY', () => {
		service.startRun$('grid-1', { country: 'DE', checkPowerQuality: true }).subscribe();

		const request = httpMock.expectOne('http://localhost:8080/api/grid/grid-1/simulations/runs');
		expect(request.request.method).toBe('POST');
		expect(request.request.body.simulationType).toBe('HOSTING_CAPACITY');
		expect(request.request.body.options.country).toBe('DE');
		expect(request.request.body.options.checkPowerQuality).toBe(true);
		request.flush({
			runId: 'run-1',
			simulationType: 'HOSTING_CAPACITY',
			engineKey: 'remote-python-hosting-capacity-v1',
			status: 'QUEUED',
			reusedExisting: false,
			createdAt: '2026-03-07T10:00:00Z',
		});
	});

	it('lists runs with hosting-capacity simulation type query', () => {
		service.listRuns$('grid-1').subscribe((runs) => {
			expect(runs.length).toBe(1);
			expect(runs[0].solver).toBe('remote-python-hosting-capacity-v1');
			expect(runs[0].result?.busResults[0]?.allConstraints?.POWER_QUALITY).toBe(120);
		});

		const request = httpMock.expectOne(
			'http://localhost:8080/api/grid/grid-1/simulations/runs?simulationType=HOSTING_CAPACITY',
		);
		expect(request.request.method).toBe('GET');
		request.flush([
			{
				runId: 'run-1',
				gridId: 'grid-1',
				simulationType: 'HOSTING_CAPACITY',
				engineKey: 'remote-python-hosting-capacity-v1',
				engineVersion: 'v1',
				status: 'SUCCEEDED',
				failureCode: null,
				errorMessage: null,
				createdAt: '2026-03-07T10:00:00Z',
				startedAt: '2026-03-07T10:00:01Z',
				finishedAt: '2026-03-07T10:00:03Z',
				queueWaitMs: 1000,
				runDurationMs: 2000,
				result: {
					simulationType: 'HOSTING_CAPACITY',
					summary: {},
					data: {
						country: 'DE',
						constraintsApplied: {
							voltageBandPu: [0.9, 1.1],
							voltageRiseLimitLvPu: 0.03,
							voltageRiseLimitMvPu: 0.02,
							thermalOverloadFactor: 1.0,
							minSscSnRatio: 25,
						},
						config: {
							dgPowerFactor: 1.0,
							dgType: 'GENERIC',
							searchToleranceKw: 1.0,
							maxDgKw: 1000,
							checkThermal: true,
							checkVoltage: true,
							checkVoltageRise: true,
							checkShortCircuit: true,
							checkPowerQuality: true,
						},
						busResults: [
							{
								busId: 'bus1',
								hcKw: 100,
								bindingConstraint: 'POWER_QUALITY',
								voltageAtHcPu: 1.01,
								voltageRiseAtHcPu: 0.01,
								maxBranchLoadingPct: 70,
								maxBranchId: 'line1',
								transformerLoadingPct: 40,
								sscSnRatio: 30,
								allConstraints: {
									VOLTAGE_UPPER: 300,
									VOLTAGE_RISE: 200,
									THERMAL_LINE: 250,
									THERMAL_TRANSFORMER: 260,
									SHORT_CIRCUIT: 180,
									POWER_QUALITY: 120,
								},
							},
						],
						warnings: [],
					},
				},
			},
		]);
	});
});
