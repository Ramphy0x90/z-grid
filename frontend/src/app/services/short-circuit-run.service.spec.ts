import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ShortCircuitRunService } from './short-circuit-run.service';

describe('ShortCircuitRunService', () => {
	let service: ShortCircuitRunService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [ShortCircuitRunService, provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(ShortCircuitRunService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('starts short-circuit run with simulationType SHORT_CIRCUIT', () => {
		service.startRun$('grid-1', { faultTypes: ['3PH', 'SLG'] }).subscribe();

		const request = httpMock.expectOne('http://localhost:8080/api/grid/grid-1/simulations/runs');
		expect(request.request.method).toBe('POST');
		expect(request.request.body.simulationType).toBe('SHORT_CIRCUIT');
		expect(request.request.body.options.faultTypes).toEqual(['3PH', 'SLG']);
		request.flush({
			runId: 'run-1',
			simulationType: 'SHORT_CIRCUIT',
			engineKey: 'remote-python-short-circuit-v1',
			status: 'QUEUED',
			reusedExisting: false,
			createdAt: '2026-03-04T10:00:00Z',
		});
	});

	it('lists runs with short-circuit simulation type query', () => {
		service.listRuns$('grid-1').subscribe((runs) => {
			expect(runs.length).toBe(1);
			expect(runs[0].solver).toBe('remote-python-short-circuit-v1');
		});

		const request = httpMock.expectOne(
			'http://localhost:8080/api/grid/grid-1/simulations/runs?simulationType=SHORT_CIRCUIT',
		);
		expect(request.request.method).toBe('GET');
		request.flush([
			{
				runId: 'run-1',
				gridId: 'grid-1',
				simulationType: 'SHORT_CIRCUIT',
				engineKey: 'remote-python-short-circuit-v1',
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
					simulationType: 'SHORT_CIRCUIT',
					summary: {},
					data: { faultTypes: ['3PH'], busResults: [], warnings: [] },
				},
			},
		]);
	});
});
