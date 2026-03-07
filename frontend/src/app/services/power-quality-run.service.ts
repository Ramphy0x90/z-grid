import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
	PowerQualityRunOptions,
	PowerQualityRunStatus,
	StartPowerQualityRunResponse,
} from '../types/power-quality.types';
import type { SimulationRunStatus, StartSimulationRunResponse } from '../types/simulation.types';

@Injectable({
	providedIn: 'root',
})
export class PowerQualityRunService {
	private readonly http = inject(HttpClient);
	private readonly gridsApiPath = `${environment.apiBaseUrl}/api/grid`;
	private readonly latestRunByGridState = signal<Record<string, PowerQualityRunStatus>>({});
	private readonly runRefreshState = signal(0);

	readonly runRefreshToken = this.runRefreshState.asReadonly();

	getLatestRun(gridId: string | null): PowerQualityRunStatus | null {
		if (!gridId) {
			return null;
		}
		return this.latestRunByGridState()[gridId] ?? null;
	}

	startRun$(gridId: string, options?: PowerQualityRunOptions): Observable<StartPowerQualityRunResponse> {
		return this.http
			.post<StartSimulationRunResponse>(`${this.gridsApiPath}/${gridId}/simulations/runs`, {
				simulationType: 'POWER_QUALITY',
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
							solver: existing?.solver ?? 'POWER_QUALITY',
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

	getRun$(gridId: string, runId: string): Observable<PowerQualityRunStatus> {
		return this.http.get<SimulationRunStatus>(`${this.gridsApiPath}/${gridId}/simulations/runs/${runId}`).pipe(
			map((status) => this.toRunStatus(status)),
			tap((status) => this.setLatestRun(status)),
		);
	}

	listRuns$(gridId: string): Observable<PowerQualityRunStatus[]> {
		return this.http
			.get<SimulationRunStatus[]>(
				`${this.gridsApiPath}/${gridId}/simulations/runs?simulationType=POWER_QUALITY`,
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

	private setLatestRun(status: PowerQualityRunStatus): void {
		this.latestRunByGridState.update((state) => ({
			...state,
			[status.gridId]: status,
		}));
	}

	private toRunStatus(status: SimulationRunStatus): PowerQualityRunStatus {
		const resultData = status.result?.data as PowerQualityRunStatus['result'] | null | undefined;
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
