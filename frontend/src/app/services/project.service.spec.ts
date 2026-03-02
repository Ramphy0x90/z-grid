import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjectService } from './project.service';

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
});
