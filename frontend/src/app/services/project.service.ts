import { Injectable, signal } from '@angular/core';

export type Project = {
  id: string;
  name: string;
  description: string;
  region: string;
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

  readonly projects = this.projectsState.asReadonly();

  getProjectById(projectId: string): Project | null {
    return this.projects().find((project) => project.id === projectId) ?? null;
  }

  projectExists(projectId: string): boolean {
    return this.projects().some((project) => project.id === projectId);
  }
}
