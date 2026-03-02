import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ProjectService } from './project.service';
import type { Project, ProjectGrid } from '../types/project.types';

type GridSyncResult = {
	grids: ProjectGrid[];
	shouldSelectFirst: boolean;
	stale: boolean;
};

@Injectable({
	providedIn: 'root',
})
export class WorkspaceDataSyncService {
	private readonly authService = inject(AuthService);
	private readonly projectService = inject(ProjectService);
	private hasCompletedInitialGridSync = false;
	private gridSyncRequestId = 0;
	private datasetSyncRequestId = 0;

	resetSessionState(): void {
		this.hasCompletedInitialGridSync = false;
		this.gridSyncRequestId += 1;
		this.datasetSyncRequestId += 1;
	}

	async syncProjects(): Promise<Project[]> {
		if (!this.authService.isAuthenticated()) {
			return [];
		}
		try {
			return await firstValueFrom(this.projectService.loadProjects$());
		} catch {
			return [];
		}
	}

	async syncGridsForProject(projectId: string | null): Promise<GridSyncResult> {
		const requestId = ++this.gridSyncRequestId;
		if (!this.authService.isAuthenticated()) {
			return { grids: [], shouldSelectFirst: false, stale: requestId !== this.gridSyncRequestId };
		}
		const isInitialProjectGridSync = !this.hasCompletedInitialGridSync;
		this.hasCompletedInitialGridSync = true;
		if (!projectId) {
			return { grids: [], shouldSelectFirst: false, stale: requestId !== this.gridSyncRequestId };
		}
		try {
			const grids = await firstValueFrom(this.projectService.loadGridsByProjectId$(projectId));
			return {
				grids,
				shouldSelectFirst: isInitialProjectGridSync && grids.length > 0,
				stale: requestId !== this.gridSyncRequestId,
			};
		} catch {
			return { grids: [], shouldSelectFirst: false, stale: requestId !== this.gridSyncRequestId };
		}
	}

	async syncDatasetForGrid(gridId: string): Promise<boolean> {
		const requestId = ++this.datasetSyncRequestId;
		if (!this.authService.isAuthenticated()) {
			return false;
		}
		try {
			await firstValueFrom(this.projectService.loadGridDatasetById$(gridId));
			return requestId === this.datasetSyncRequestId;
		} catch {
			return requestId === this.datasetSyncRequestId;
		}
	}
}
