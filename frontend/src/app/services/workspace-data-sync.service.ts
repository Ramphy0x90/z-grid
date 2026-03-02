import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
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

	syncProjects$(): Observable<Project[]> {
		if (!this.authService.isAuthenticated()) {
			return of([]);
		}
		return this.projectService.loadProjects$().pipe(catchError(() => of([])));
	}

	syncGridsForProject$(projectId: string | null): Observable<GridSyncResult> {
		const requestId = ++this.gridSyncRequestId;
		if (!this.authService.isAuthenticated()) {
			return of({ grids: [], shouldSelectFirst: false, stale: requestId !== this.gridSyncRequestId });
		}
		const isInitialProjectGridSync = !this.hasCompletedInitialGridSync;
		this.hasCompletedInitialGridSync = true;
		if (!projectId) {
			return of({ grids: [], shouldSelectFirst: false, stale: requestId !== this.gridSyncRequestId });
		}
		return this.projectService.loadGridsByProjectId$(projectId).pipe(
			map((grids) => ({
				grids,
				shouldSelectFirst: isInitialProjectGridSync && grids.length > 0,
				stale: requestId !== this.gridSyncRequestId,
			})),
			catchError(() =>
				of({ grids: [], shouldSelectFirst: false, stale: requestId !== this.gridSyncRequestId }),
			),
		);
	}

	syncDatasetForGrid$(gridId: string): Observable<boolean> {
		const requestId = ++this.datasetSyncRequestId;
		if (!this.authService.isAuthenticated()) {
			return of(false);
		}
		return this.projectService.loadGridDatasetById$(gridId).pipe(
			map(() => requestId === this.datasetSyncRequestId),
			catchError(() => of(requestId === this.datasetSyncRequestId)),
		);
	}
}
