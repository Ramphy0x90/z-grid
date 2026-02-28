import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { createSyntheticGridDataset } from '../components/grid-viewer/data/mock-grid.data';
import type { GridDataset } from '../components/grid-viewer/models/grid.models';
import { map, Observable, tap } from 'rxjs';

export type Project = {
  id: string;
  teamId: string;
  name: string;
  description: string;
};

export type ProjectGrid = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  busCount: number;
};

export type CreateProjectRequest = {
  name: string;
  description: string;
};

type ProjectApiModel = {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
};

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly projectsApiPath = `${environment.apiBaseUrl}/api/project`;
  private readonly projectsState = signal<Project[]>([]);
  private readonly gridsState = signal<ProjectGrid[]>([
    {
      id: 'vienna-operational',
      projectId: 'vienna-mv',
      name: 'Operational Grid',
      description: 'Primary operational model used for day-ahead studies.',
      busCount: 320,
    },
    {
      id: 'vienna-planning',
      projectId: 'vienna-mv',
      name: 'Planning Grid',
      description: 'Topology candidate including planned reinforcement assets.',
      busCount: 280,
    },
    {
      id: 'madrid-base',
      projectId: 'madrid-rural',
      name: 'Base Rural Grid',
      description: 'Baseline radial model for normal loading conditions.',
      busCount: 240,
    },
    {
      id: 'madrid-peak',
      projectId: 'madrid-rural',
      name: 'Peak Season Grid',
      description: 'Peak-season scenario with high agricultural consumption.',
      busCount: 300,
    },
    {
      id: 'hamburg-industrial',
      projectId: 'hamburg-port',
      name: 'Industrial Core Grid',
      description: 'High-load industrial topology around port facilities.',
      busCount: 360,
    },
    {
      id: 'porto-residential',
      projectId: 'porto-residential',
      name: 'Residential Expansion Grid',
      description: 'Expansion scenario with increased distributed generation.',
      busCount: 260,
    },
  ]);
  private readonly gridDatasetCache = new Map<string, GridDataset>();

  readonly projects = this.projectsState.asReadonly();
  readonly grids = this.gridsState.asReadonly();

  loadProjects(): Observable<Project[]> {
    return this.http.get<ProjectApiModel[]>(this.projectsApiPath).pipe(
      map((projects) => projects.map((project) => this.toProject(project))),
      tap((projects) => this.projectsState.set(projects)),
    );
  }

  createProject(request: CreateProjectRequest): Observable<Project> {
    return this.http.post<ProjectApiModel>(this.projectsApiPath, request).pipe(
      map((project) => this.toProject(project)),
      tap((project) => this.projectsState.update((projects) => [project, ...projects])),
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

  duplicateGrid(sourceGridId: string): ProjectGrid | null {
    const sourceGrid = this.getGridById(sourceGridId);
    if (!sourceGrid) {
      return null;
    }
    const duplicatedGrid: ProjectGrid = {
      ...sourceGrid,
      id: this.getUniqueGridId(`${sourceGrid.id}-copy`),
      name: this.getUniqueGridName(sourceGrid.projectId, `${sourceGrid.name} Copy`),
    };
    this.gridsState.update((grids) => [duplicatedGrid, ...grids]);
    return duplicatedGrid;
  }

  deleteGrid(gridId: string): boolean {
    const exists = this.grids().some((grid) => grid.id === gridId);
    if (!exists) {
      return false;
    }
    this.gridsState.update((grids) => grids.filter((grid) => grid.id !== gridId));
    this.gridDatasetCache.delete(gridId);
    return true;
  }

  getGridDatasetById(gridId: string): GridDataset | null {
    const cached = this.gridDatasetCache.get(gridId);
    if (cached) {
      return cached;
    }

    const grid = this.getGridById(gridId);
    if (!grid) {
      return null;
    }

    const syntheticDataset = createSyntheticGridDataset(grid.busCount, {
      projectId: grid.projectId,
      name: grid.name,
    });
    const dataset: GridDataset = {
      ...syntheticDataset,
      grid: {
        ...syntheticDataset.grid,
        id: grid.id,
        projectId: grid.projectId,
        name: grid.name,
        description: grid.description,
      },
    };

    this.gridDatasetCache.set(gridId, dataset);
    return dataset;
  }

  private toProject(project: ProjectApiModel): Project {
    return {
      id: project.id,
      teamId: project.teamId,
      name: project.name,
      description: project.description ?? '',
    };
  }

  private getUniqueGridId(baseId: string): string {
    const existingIds = new Set(this.grids().map((grid) => grid.id));
    if (!existingIds.has(baseId)) {
      return baseId;
    }
    let suffix = 2;
    let candidate = `${baseId}-${suffix}`;
    while (existingIds.has(candidate)) {
      suffix += 1;
      candidate = `${baseId}-${suffix}`;
    }
    return candidate;
  }

  private getUniqueGridName(projectId: string, baseName: string): string {
    const existingNames = new Set(
      this.grids()
        .filter((grid) => grid.projectId === projectId)
        .map((grid) => grid.name.toLocaleLowerCase()),
    );
    if (!existingNames.has(baseName.toLocaleLowerCase())) {
      return baseName;
    }
    let suffix = 2;
    let candidate = `${baseName} ${suffix}`;
    while (existingNames.has(candidate.toLocaleLowerCase())) {
      suffix += 1;
      candidate = `${baseName} ${suffix}`;
    }
    return candidate;
  }
}
