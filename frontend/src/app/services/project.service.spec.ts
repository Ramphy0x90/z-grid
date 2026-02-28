import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ProjectService } from './project.service';
import { environment } from '../../environments/environment';
import type { GridDataset } from '../components/grid-viewer/models/grid.models';

describe('ProjectService', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('starts power-flow run for selected grid', () => {
    service.startPowerFlowRun('grid-1').subscribe((response) => {
      expect(response.runId).toBe('run-1');
      expect(response.status).toBe('QUEUED');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/grid/grid-1/power-flow/runs`);
    expect(req.request.method).toBe('POST');
    req.flush({
      runId: 'run-1',
      status: 'QUEUED',
      reusedExisting: false,
      createdAt: new Date().toISOString(),
    });
  });

  it('loads and normalizes grid dataset', () => {
    service.loadGridDatasetById('grid-1').subscribe((dataset) => {
      expect(dataset.grid.id).toBe('grid-1');
      expect(Array.isArray(dataset.buses)).toBeTrue();
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/grid/grid-1/dataset`);
    expect(req.request.method).toBe('GET');
    req.flush({
      grid: {
        id: 'grid-1',
        projectId: 'project-1',
        name: 'Grid',
        description: '',
        baseMva: 100,
        frequencyHz: 50,
      },
      buses: [],
      lines: [],
      transformers: [],
      loads: [],
      generators: [],
      shuntCompensators: [],
      busLayout: [],
      edgeLayout: [],
    } satisfies GridDataset);
  });
});
