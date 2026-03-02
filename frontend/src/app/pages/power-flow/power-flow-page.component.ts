import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	computed,
	effect,
	inject,
	signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Store } from '@ngrx/store';
import { GridSelectors } from '../../stores/grid/grid.selectors';
import { PowerFlowRunService } from '../../services/power-flow-run.service';
import type { PowerFlowRunStatus } from '../../types/power-flow.types';

@Component({
	selector: 'app-power-flow-page',
	templateUrl: './power-flow-page.component.html',
	styleUrl: './power-flow-page.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerFlowPageComponent {
	private readonly powerFlowRunService = inject(PowerFlowRunService);
	private readonly store = inject(Store);
	private readonly destroyRef = inject(DestroyRef);

	private readonly runState = signal<PowerFlowRunStatus | null>(null);
	private readonly loadingState = signal(false);
	private readonly errorState = signal<string | null>(null);
	private readonly activePaneState = signal<'buses' | 'branches' | 'violations'>('buses');
	private readonly succeededWithoutResultPollCountState = signal(0);
	private pollTimer: number | null = null;
	private pollInFlight = false;

	protected readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
	protected readonly run = this.runState.asReadonly();
	protected readonly loading = this.loadingState.asReadonly();
	protected readonly error = this.errorState.asReadonly();
	protected readonly activePane = this.activePaneState.asReadonly();
	protected readonly hasResult = computed(() => this.runState()?.result != null);
	protected readonly result = computed(() => this.runState()?.result ?? null);
	protected readonly violationsCount = computed(() => {
		const r = this.result();
		if (!r) return 0;
		return r.violations.voltage.length + r.violations.thermal.length;
	});

	constructor() {
		effect(() => {
			const gridId = this.selectedGridId();
			this.powerFlowRunService.powerFlowRunRefreshToken();
			this.stopPolling();
			this.runState.set(null);
			if (!gridId) {
				this.errorState.set('Select a grid to run power flow.');
				return;
			}
			this.errorState.set(null);
			void this.loadLatestRun(gridId);
		});

		this.destroyRef.onDestroy(() => this.stopPolling());
	}

	protected setActivePane(pane: 'buses' | 'branches' | 'violations'): void {
		this.activePaneState.set(pane);
	}

	private async loadLatestRun(gridId: string): Promise<void> {
		this.loadingState.set(true);
		try {
			const runs = await firstValueFrom(this.powerFlowRunService.listPowerFlowRuns$(gridId));
			const latest = runs[0] ?? null;
			this.runState.set(latest);
			this.succeededWithoutResultPollCountState.set(0);
			if (!latest) {
				this.stopPolling();
			} else if (latest.status === 'QUEUED' || latest.status === 'RUNNING') {
				this.startPolling(gridId);
			} else if (latest.status === 'SUCCEEDED' && latest.result === null) {
				this.startPolling(gridId);
			} else {
				this.stopPolling();
			}
		} catch {
			const cached = this.powerFlowRunService.getLatestPowerFlowRun(gridId);
			this.runState.set(cached);
			if (!cached) {
				this.errorState.set('Could not load power-flow history.');
			}
		} finally {
			this.loadingState.set(false);
		}
	}

	private startPolling(gridId: string): void {
		this.stopPolling();
		this.pollTimer = window.setInterval(() => {
			if (this.pollInFlight) {
				return;
			}
			const run = this.runState();
			if (!run || run.gridId !== gridId) {
				this.stopPolling();
				return;
			}
			this.pollInFlight = true;
			void this.fetchRun(gridId, run.runId);
		}, 2000);
	}

	private stopPolling(): void {
		if (this.pollTimer !== null) {
			window.clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		this.pollInFlight = false;
	}

	private async fetchRun(gridId: string, runId: string): Promise<void> {
		try {
			const run = await firstValueFrom(this.powerFlowRunService.getPowerFlowRun$(gridId, runId));
			this.runState.set(run);
			if (run.status === 'SUCCEEDED' && run.result === null) {
				const attempts = this.succeededWithoutResultPollCountState() + 1;
				this.succeededWithoutResultPollCountState.set(attempts);
				// Keep polling briefly to bridge backend write timing.
				if (attempts < 10) {
					return;
				}
				this.errorState.set(
					'Run completed but result payload is not available yet. Please run again.',
				);
				this.stopPolling();
				return;
			} else {
				this.succeededWithoutResultPollCountState.set(0);
			}
			if (run.status !== 'QUEUED' && run.status !== 'RUNNING') {
				this.stopPolling();
			}
		} catch (error) {
			if (error instanceof HttpErrorResponse && error.status === 404) {
				this.stopPolling();
				this.runState.set(null);
				await this.loadLatestRun(gridId);
				return;
			}
			this.errorState.set('Run status polling failed. The run may still be processing.');
		} finally {
			this.pollInFlight = false;
		}
	}
}
