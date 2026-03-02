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
import { finalize, take } from 'rxjs';
import { Store } from '@ngrx/store';
import { GridSelectorComponent } from '../../components/grid-selector/grid-selector.component';
import { ProjectSelectors } from '../../stores/project/project.selectors';
import { GridActions } from '../../stores/grid/grid.actions';
import { GridSelectors } from '../../stores/grid/grid.selectors';
import { PowerFlowRunService } from '../../services/power-flow-run.service';
import type { PowerFlowRunStatus } from '../../types/power-flow.types';

@Component({
	selector: 'app-power-flow-page',
	imports: [GridSelectorComponent],
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

	protected readonly selectedProjectId = this.store.selectSignal(ProjectSelectors.selectedProjectId);
	protected readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
	protected readonly runOperation = this.store.selectSignal(GridSelectors.runOperation);
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
			this.loadLatestRun(gridId);
		});

		this.destroyRef.onDestroy(() => this.stopPolling());
	}

	protected setActivePane(pane: 'buses' | 'branches' | 'violations'): void {
		this.activePaneState.set(pane);
	}

	protected runPowerFlow(): void {
		const projectId = this.selectedProjectId();
		const gridId = this.selectedGridId();
		if (!projectId || !gridId || this.runOperation().isRunning) {
			return;
		}
		this.store.dispatch(GridActions.powerFlowRunRequested({ projectId, gridId }));
	}

	private loadLatestRun(gridId: string): void {
		this.loadingState.set(true);
		this.powerFlowRunService
			.listPowerFlowRuns$(gridId)
			.pipe(
				take(1),
				finalize(() => this.loadingState.set(false)),
			)
			.subscribe({
				next: (runs) => {
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
				},
				error: () => {
					const cached = this.powerFlowRunService.getLatestPowerFlowRun(gridId);
					this.runState.set(cached);
					if (!cached) {
						this.errorState.set('Could not load power-flow history.');
					}
				},
			});
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
			this.fetchRun(gridId, run.runId);
		}, 2000);
	}

	private stopPolling(): void {
		if (this.pollTimer !== null) {
			window.clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		this.pollInFlight = false;
	}

	private fetchRun(gridId: string, runId: string): void {
		this.powerFlowRunService
			.getPowerFlowRun$(gridId, runId)
			.pipe(
				take(1),
				finalize(() => {
					this.pollInFlight = false;
				}),
			)
			.subscribe({
				next: (run) => {
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
					}
					this.succeededWithoutResultPollCountState.set(0);
					if (run.status !== 'QUEUED' && run.status !== 'RUNNING') {
						this.stopPolling();
					}
				},
				error: (error: unknown) => {
					if (error instanceof HttpErrorResponse && error.status === 404) {
						this.stopPolling();
						this.runState.set(null);
						this.loadLatestRun(gridId);
						return;
					}
					this.errorState.set('Run status polling failed. The run may still be processing.');
				},
			});
	}
}
