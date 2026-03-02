import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
	PowerFlowRunOptions,
	PowerFlowRunStatus,
	StartPowerFlowRunResponse,
} from '../types/power-flow.types';
import type { SimulationRunStatus, StartSimulationRunResponse } from '../types/simulation.types';

@Injectable({
	providedIn: 'root',
})
export class PowerFlowRunService {
	private readonly http = inject(HttpClient);
	private readonly gridsApiPath = `${environment.apiBaseUrl}/api/grid`;
	private readonly latestPowerFlowRunByGridState = signal<Record<string, PowerFlowRunStatus>>({});
	private readonly powerFlowRunRefreshState = signal(0);

	readonly powerFlowRunRefreshToken = this.powerFlowRunRefreshState.asReadonly();

	getLatestPowerFlowRun(gridId: string | null): PowerFlowRunStatus | null {
		if (!gridId) {
			return null;
		}
		return this.latestPowerFlowRunByGridState()[gridId] ?? null;
	}

	startPowerFlowRun$(gridId: string, options?: PowerFlowRunOptions): Observable<StartPowerFlowRunResponse> {
		return this.http
			.post<StartSimulationRunResponse>(`${this.gridsApiPath}/${gridId}/simulations/runs`, {
				simulationType: 'POWER_FLOW',
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
					const existing = this.latestPowerFlowRunByGridState()[gridId];
					this.latestPowerFlowRunByGridState.update((state) => ({
						...state,
						[gridId]: {
							runId: response.runId,
							gridId,
							status: response.status,
							solver: existing?.solver ?? 'AC_NEWTON_RAPHSON',
							errorMessage: null,
							createdAt: response.createdAt,
							startedAt: existing?.startedAt ?? null,
							finishedAt: null,
							result: existing?.runId === response.runId ? existing.result : null,
						},
					}));
					this.powerFlowRunRefreshState.update((value) => value + 1);
				}),
			);
	}

	getPowerFlowRun$(gridId: string, runId: string): Observable<PowerFlowRunStatus> {
		return this.http
			.get<SimulationRunStatus>(`${this.gridsApiPath}/${gridId}/simulations/runs/${runId}`)
			.pipe(
				map((status) => this.toPowerFlowRunStatus(status)),
				tap((status) => this.setLatestPowerFlowRun(status)),
			);
	}

	listPowerFlowRuns$(gridId: string): Observable<PowerFlowRunStatus[]> {
		return this.http
			.get<SimulationRunStatus[]>(`${this.gridsApiPath}/${gridId}/simulations/runs?simulationType=POWER_FLOW`)
			.pipe(
				map((runs) => runs.map((run) => this.toPowerFlowRunStatus(run))),
				tap((runs) => {
					const latest = runs[0] ?? null;
					if (latest) {
						this.setLatestPowerFlowRun(latest);
					}
				}),
			);
	}

	private setLatestPowerFlowRun(status: PowerFlowRunStatus): void {
		this.latestPowerFlowRunByGridState.update((state) => ({
			...state,
			[status.gridId]: status,
		}));
	}

	private toPowerFlowRunStatus(status: SimulationRunStatus): PowerFlowRunStatus {
		const resultData = status.result?.data as PowerFlowRunStatus['result'] | null | undefined;
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
