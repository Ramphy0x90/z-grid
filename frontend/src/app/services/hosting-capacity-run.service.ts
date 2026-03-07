import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
	HostingCapacityRunOptions,
	HostingCapacityRunStatus,
	StartHostingCapacityRunResponse,
} from '../types/hosting-capacity.types';
import type { SimulationRunStatus, StartSimulationRunResponse } from '../types/simulation.types';

@Injectable({
	providedIn: 'root',
})
export class HostingCapacityRunService {
	private readonly http = inject(HttpClient);
	private readonly gridsApiPath = `${environment.apiBaseUrl}/api/grid`;
	private readonly latestRunByGridState = signal<Record<string, HostingCapacityRunStatus>>({});
	private readonly runRefreshState = signal(0);

	readonly runRefreshToken = this.runRefreshState.asReadonly();

	getLatestRun(gridId: string | null): HostingCapacityRunStatus | null {
		if (!gridId) {
			return null;
		}
		return this.latestRunByGridState()[gridId] ?? null;
	}

	startRun$(gridId: string, options?: HostingCapacityRunOptions): Observable<StartHostingCapacityRunResponse> {
		return this.http
			.post<StartSimulationRunResponse>(`${this.gridsApiPath}/${gridId}/simulations/runs`, {
				simulationType: 'HOSTING_CAPACITY',
				options,
			})
			.pipe(
				map((response) => ({
					runId: response.runId,
					status: response.status,
					reusedExisting: response.reusedExisting,
					createdAt: response.createdAt,
				})),
				tap((response) => {
					const existing = this.latestRunByGridState()[gridId];
					this.latestRunByGridState.update((state) => ({
						...state,
						[gridId]: {
							runId: response.runId,
							gridId,
							status: response.status,
							solver: existing?.solver ?? 'HOSTING_CAPACITY',
							errorMessage: null,
							createdAt: response.createdAt,
							startedAt: existing?.startedAt ?? null,
							finishedAt: null,
							result: existing?.runId === response.runId ? existing.result : null,
						},
					}));
					this.runRefreshState.update((value) => value + 1);
				}),
			);
	}

	getRun$(gridId: string, runId: string): Observable<HostingCapacityRunStatus> {
		return this.http.get<SimulationRunStatus>(`${this.gridsApiPath}/${gridId}/simulations/runs/${runId}`).pipe(
			map((status) => this.toRunStatus(status)),
			tap((status) => this.setLatestRun(status)),
		);
	}

	listRuns$(gridId: string): Observable<HostingCapacityRunStatus[]> {
		return this.http
			.get<SimulationRunStatus[]>(
				`${this.gridsApiPath}/${gridId}/simulations/runs?simulationType=HOSTING_CAPACITY`,
			)
			.pipe(
				map((runs) => runs.map((run) => this.toRunStatus(run))),
				tap((runs) => {
					const latest = runs[0] ?? null;
					if (latest) {
						this.setLatestRun(latest);
					}
				}),
			);
	}

	private setLatestRun(status: HostingCapacityRunStatus): void {
		this.latestRunByGridState.update((state) => ({
			...state,
			[status.gridId]: status,
		}));
	}

	private toRunStatus(status: SimulationRunStatus): HostingCapacityRunStatus {
		const resultData = status.result?.data as HostingCapacityRunStatus['result'] | null | undefined;
		return {
			runId: status.runId,
			gridId: status.gridId,
			status: status.status,
			solver: status.engineKey,
			errorMessage: status.errorMessage,
			createdAt: status.createdAt,
			startedAt: status.startedAt,
			finishedAt: status.finishedAt,
			result: resultData ?? null,
		};
	}
}
