import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import type { GridDataset } from '../components/grid-viewer/models/grid.models';
import { map, Observable, tap } from 'rxjs';
import type {
	CreateGridRequest,
	CreateProjectRequest,
	InstallExampleProjectRequest,
	Project,
	ProjectGrid,
	UpdateProjectRequest,
} from '../types/project.types';

type ProjectApiModel = {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
};

type GridApiModel = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  busCount?: number | null;
};

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly projectsApiPath = `${environment.apiBaseUrl}/api/project`;
  private readonly gridsApiPath = `${environment.apiBaseUrl}/api/grid`;
  private readonly projectsState = signal<Project[]>([]);
  private readonly gridsState = signal<ProjectGrid[]>([]);
  private readonly gridDatasetsState = signal<Record<string, GridDataset>>({});

  readonly projects = this.projectsState.asReadonly();
  readonly grids = this.gridsState.asReadonly();

  loadProjects$(): Observable<Project[]> {
    return this.http.get<ProjectApiModel[]>(this.projectsApiPath).pipe(
      map((projects) => projects.map((project) => this.toProject(project))),
      tap((projects) => this.projectsState.set(projects)),
    );
  }

  createProject$(request: CreateProjectRequest): Observable<Project> {
    return this.http.post<ProjectApiModel>(this.projectsApiPath, request).pipe(
      map((project) => this.toProject(project)),
      tap((project) => this.projectsState.update((projects) => [project, ...projects])),
    );
  }

  installExampleProject$(request: InstallExampleProjectRequest): Observable<Project> {
    return this.http.post<ProjectApiModel>(`${this.projectsApiPath}/install-example`, request).pipe(
      map((project) => this.toProject(project)),
      tap((project) => this.projectsState.update((projects) => [project, ...projects])),
    );
  }

  updateProject$(projectId: string, request: UpdateProjectRequest): Observable<Project> {
    return this.http.put<ProjectApiModel>(`${this.projectsApiPath}/${projectId}`, request).pipe(
      map((project) => this.toProject(project)),
      tap((updatedProject) => {
        this.projectsState.update((projects) =>
          projects.map((project) => (project.id === projectId ? updatedProject : project)),
        );
      }),
    );
  }

  deleteProject$(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.projectsApiPath}/${projectId}`).pipe(
      tap(() => {
        this.projectsState.update((projects) =>
          projects.filter((project) => project.id !== projectId),
        );
      }),
    );
  }

  getProjectById(projectId: string): Project | null {
    return this.projects().find((project) => project.id === projectId) ?? null;
  }

  projectExists(projectId: string): boolean {
    return this.projects().some((project) => project.id === projectId);
  }

  getGridById(gridId: string): ProjectGrid | null {
    return this.grids().find((grid) => grid.id === gridId) ?? null;
  }

  getGridsByProjectId(projectId: string): ProjectGrid[] {
    return this.grids().filter((grid) => grid.projectId === projectId);
  }

  loadGridsByProjectId$(projectId: string): Observable<ProjectGrid[]> {
    return this.http.get<GridApiModel[]>(`${this.gridsApiPath}/project/${projectId}`).pipe(
      map((grids) => grids.map((grid) => this.toGrid(grid))),
      tap((grids) => this.gridsState.set(grids)),
    );
  }

  duplicateGrid$(sourceGridId: string): Observable<ProjectGrid> {
    return this.http.post<GridApiModel>(`${this.gridsApiPath}/${sourceGridId}/duplicate`, {}).pipe(
      map((grid) => this.toGrid(grid)),
      tap((duplicatedGrid) => this.gridsState.update((grids) => [duplicatedGrid, ...grids])),
    );
  }

  createGrid$(projectId: string, request: CreateGridRequest): Observable<ProjectGrid> {
    return this.http
      .post<GridApiModel>(this.gridsApiPath, {
        projectId,
        name: request.name,
        description: request.description,
      })
      .pipe(
        map((grid) => this.toGrid(grid)),
        tap((createdGrid) => this.gridsState.update((grids) => [createdGrid, ...grids])),
      );
  }

  updateGrid$(gridId: string, request: CreateGridRequest): Observable<ProjectGrid> {
    return this.http
      .put<GridApiModel>(`${this.gridsApiPath}/${gridId}`, {
        name: request.name,
        description: request.description,
      })
      .pipe(
        map((grid) => this.toGrid(grid)),
        tap((updatedGrid) => {
          this.gridsState.update((grids) =>
            grids.map((grid) => (grid.id === gridId ? updatedGrid : grid)),
          );
          this.gridDatasetsState.update((datasets) => {
            const dataset = datasets[gridId];
            if (!dataset) {
              return datasets;
            }
            return {
              ...datasets,
              [gridId]: {
                ...dataset,
                grid: {
                  ...dataset.grid,
                  name: updatedGrid.name,
                  description: updatedGrid.description,
                },
              },
            };
          });
        }),
      );
  }

  deleteGrid$(gridId: string): Observable<void> {
    return this.http.delete<void>(`${this.gridsApiPath}/${gridId}`).pipe(
      tap(() => {
        this.gridsState.update((grids) => grids.filter((grid) => grid.id !== gridId));
        this.gridDatasetsState.update((datasets) => {
          const { [gridId]: _removed, ...rest } = datasets;
          return rest;
        });
      }),
    );
  }

  getGridDatasetById(gridId: string): GridDataset | null {
    return this.gridDatasetsState()[gridId] ?? null;
  }

  loadGridDatasetById$(gridId: string): Observable<GridDataset> {
    return this.http.get<GridDataset>(`${this.gridsApiPath}/${gridId}/dataset`).pipe(
      map((dataset) => this.normalizeDatasetPayload(dataset, gridId)),
      tap((dataset) => {
        this.gridDatasetsState.update((datasets) => ({
          ...datasets,
          [gridId]: dataset,
        }));
      }),
    );
  }

  saveGridDataset$(gridId: string, dataset: GridDataset): Observable<GridDataset> {
    const normalizedRequest = this.normalizeDatasetPayload(dataset, gridId);
    return this.http.put<GridDataset>(`${this.gridsApiPath}/${gridId}/dataset`, normalizedRequest).pipe(
      map((savedDataset) => this.normalizeDatasetPayload(savedDataset, gridId)),
      tap((savedDataset) => {
        this.gridDatasetsState.update((datasets) => ({
          ...datasets,
          [gridId]: savedDataset,
        }));
      }),
    );
  }

  updateGridDataset(gridId: string, dataset: GridDataset): void {
    const normalizedDataset = this.normalizeDatasetPayload(dataset, gridId);
    this.gridDatasetsState.update((datasets) => ({
      ...datasets,
      [gridId]: normalizedDataset,
    }));
  }

  prepareDatasetForGrid(dataset: GridDataset, targetGrid: ProjectGrid): GridDataset {
    const normalizedDataset = this.normalizeDatasetPayload(dataset, targetGrid.id);
    return {
      ...normalizedDataset,
      grid: {
        ...normalizedDataset.grid,
        id: targetGrid.id,
        projectId: targetGrid.projectId,
        name: targetGrid.name,
        description: targetGrid.description,
      },
      buses: normalizedDataset.buses.map((bus) => ({
        ...bus,
        gridId: targetGrid.id,
      })),
      lines: normalizedDataset.lines.map((line) => ({
        ...line,
        gridId: targetGrid.id,
      })),
      transformers: normalizedDataset.transformers.map((transformer) => ({
        ...transformer,
        gridId: targetGrid.id,
      })),
    };
  }

  private toProject(project: ProjectApiModel): Project {
    return {
      id: project.id,
      teamId: project.teamId,
      name: project.name,
      description: project.description ?? '',
    };
  }

  private toGrid(grid: GridApiModel): ProjectGrid {
    return {
      id: grid.id,
      projectId: grid.projectId,
      name: grid.name,
      description: grid.description ?? '',
      busCount: grid.busCount ?? 0,
    };
  }

  private normalizeDatasetPayload(dataset: GridDataset, gridId: string): GridDataset {
    const grid = this.getGridById(gridId);
    const safeGrid = dataset?.grid ?? {
      id: gridId,
      projectId: grid?.projectId ?? '',
      name: grid?.name ?? 'Grid',
      description: grid?.description ?? '',
      baseMva: 100,
      frequencyHz: 50,
    };
    return {
      ...dataset,
      grid: {
        ...safeGrid,
        id: gridId,
        projectId: safeGrid.projectId ?? grid?.projectId ?? '',
        name: safeGrid.name ?? grid?.name ?? 'Grid',
        description: safeGrid.description ?? grid?.description ?? '',
        baseMva: typeof safeGrid.baseMva === 'number' ? safeGrid.baseMva : 100,
        frequencyHz: typeof safeGrid.frequencyHz === 'number' ? safeGrid.frequencyHz : 50,
      },
      buses: Array.isArray(dataset?.buses) ? dataset.buses : [],
      lines: Array.isArray(dataset?.lines) ? dataset.lines : [],
      transformers: Array.isArray(dataset?.transformers) ? dataset.transformers : [],
      loads: Array.isArray(dataset?.loads) ? dataset.loads : [],
      generators: Array.isArray(dataset?.generators) ? dataset.generators : [],
      shuntCompensators: Array.isArray(dataset?.shuntCompensators)
        ? dataset.shuntCompensators
        : [],
      busLayout: Array.isArray(dataset?.busLayout) ? dataset.busLayout : [],
      edgeLayout: Array.isArray(dataset?.edgeLayout) ? dataset.edgeLayout : [],
    };
  }
}
