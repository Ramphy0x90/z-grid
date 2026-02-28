import { Injectable, signal } from '@angular/core';
import { createSyntheticGridDataset } from '../components/grid-viewer/data/mock-grid.data';
import type { GridDataset } from '../components/grid-viewer/models/grid.models';

export type Project = {
  id: string;
  name: string;
  description: string;
  region: string;
};

export type ProjectGrid = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  busCount: number;
};

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  // Mocked backend response until API integration is wired.
  private readonly projectsState = signal<Project[]>([
    {
      id: 'vienna-mv',
      name: 'Vienna District 3 - MV Network',
      description: 'Urban medium-voltage feeder with distributed generation and EV loads.',
      region: 'Austria',
    },
    {
      id: 'madrid-rural',
      name: 'Madrid South - Rural Grid',
      description: 'Long radial lines with high seasonal demand and sparse switching points.',
      region: 'Spain',
    },
    {
      id: 'hamburg-port',
      name: 'Hamburg Port - Industrial Grid',
      description: 'Industrial network with heavy motors and strict voltage profile constraints.',
      region: 'Germany',
    },
    {
      id: 'porto-residential',
      name: 'Porto East - Residential Expansion',
      description: 'Fast-growing residential area with planned rooftop PV integration.',
      region: 'Portugal',
    },
  ]);
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
}
