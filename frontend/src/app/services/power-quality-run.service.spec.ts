import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PowerQualityRunService } from './power-quality-run.service';

describe('PowerQualityRunService', () => {
	let service: PowerQualityRunService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [PowerQualityRunService, provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(PowerQualityRunService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('starts power-quality run with simulationType POWER_QUALITY', () => {
		service.startRun$('grid-1', { country: 'DE', dgKw: 250, dgType: 'PV', dgPowerFactor: 0.95 }).subscribe();

		const request = httpMock.expectOne('http://localhost:8080/api/grid/grid-1/simulations/runs');
		expect(request.request.method).toBe('POST');
		expect(request.request.body.simulationType).toBe('POWER_QUALITY');
		expect(request.request.body.options.country).toBe('DE');
		expect(request.request.body.options.dgKw).toBe(250);
		request.flush({
			runId: 'run-1',
			simulationType: 'POWER_QUALITY',
			engineKey: 'remote-python-power-quality-v1',
			status: 'QUEUED',
			reusedExisting: false,
			createdAt: '2026-03-04T10:00:00Z',
		});
	});

	it('lists runs with power-quality simulation type query', () => {
		service.listRuns$('grid-1').subscribe((runs) => {
			expect(runs.length).toBe(1);
			expect(runs[0].solver).toBe('remote-python-power-quality-v1');
			expect(runs[0].result?.busResults[0]?.passes).toBe(true);
		});

		const request = httpMock.expectOne(
			'http://localhost:8080/api/grid/grid-1/simulations/runs?simulationType=POWER_QUALITY',
		);
		expect(request.request.method).toBe('GET');
		request.flush([
			{
				runId: 'run-1',
				gridId: 'grid-1',
				simulationType: 'POWER_QUALITY',
				engineKey: 'remote-python-power-quality-v1',
				engineVersion: 'v1',
				status: 'SUCCEEDED',
				failureCode: null,
				errorMessage: null,
				createdAt: '2026-03-04T10:00:00Z',
				startedAt: '2026-03-04T10:00:01Z',
				finishedAt: '2026-03-04T10:00:03Z',
				queueWaitMs: 1000,
				runDurationMs: 2000,
				result: {
					simulationType: 'POWER_QUALITY',
					summary: {},
					data: {
						country: 'DE',
						constraintsApplied: {
							thdLimitPct: 8,
							flickerPltLimit: 1,
							voltageUnbalanceLimitPct: 2,
						},
						config: { dgKw: 250, dgType: 'PV', dgPowerFactor: 0.95 },
						busResults: [
							{
								busId: 'bus-1',
								thdPct: 2.1,
								flickerPlt: 0.3,
								voltageUnbalancePct: 0.4,
								sscSnRatio: 40,
								passes: true,
								failedMetrics: [],
								limitingMetric: 'NONE',
							},
						],
						warnings: [],
					},
				},
			},
		]);
	});
});
