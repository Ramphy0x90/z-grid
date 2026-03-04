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
import { GridHoverResultOverlayService } from '../../services/grid-hover-result-overlay.service';
import type {
	GridHoverResultCard,
	GridHoverResultContext,
	GridHoverResultProvider,
} from '../../types/grid-hover-result.types';

@Component({
	selector: 'app-power-flow-page',
	imports: [GridSelectorComponent],
	templateUrl: './power-flow-page.component.html',
	styleUrl: './power-flow-page.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerFlowPageComponent {
	private readonly powerFlowRunService = inject(PowerFlowRunService);
	private readonly hoverResultOverlayService = inject(GridHoverResultOverlayService);
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
		const unregisterHoverProvider = this.hoverResultOverlayService.registerProvider(
			this.provideHoverResultCard,
		);
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

		this.destroyRef.onDestroy(() => {
			unregisterHoverProvider();
			this.stopPolling();
		});
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

	private readonly provideHoverResultCard: GridHoverResultProvider = (
		context: GridHoverResultContext,
	): GridHoverResultCard | null => {
		const title = this.getHoverElementTitle(context);
		if (!title) {
			return null;
		}
		const run = this.runState();
		if (!run) {
			return { title, statusText: 'No power flow run available for this grid.', rows: [] };
		}
		if (run.status === 'QUEUED' || run.status === 'RUNNING') {
			return { title, statusText: `Run status: ${run.status}.`, rows: [] };
		}
		if (run.status === 'FAILED') {
			return {
				title,
				statusText: run.errorMessage ?? 'Run failed and no result payload is available.',
				rows: [],
			};
		}
		if (!run.result) {
			return {
				title,
				statusText: 'Run succeeded but result payload is not available yet.',
				rows: [],
			};
		}
		return this.buildResultCardFromPayload(context, run);
	};

	private buildResultCardFromPayload(
		context: GridHoverResultContext,
		run: PowerFlowRunStatus,
	): GridHoverResultCard {
		const title = this.getHoverElementTitle(context) ?? 'Element';
		const result = run.result;
		if (!result) {
			return { title, statusText: 'No result payload available.', rows: [] };
		}
		if (context.hoveredElement.kind === 'bus') {
			const busResult = result.busResults.find((item) => item.busId === context.hoveredElement.id);
			if (!busResult) {
				return { title, statusText: 'No bus result available.', rows: [] };
			}
			const v = busResult.voltageMagnitudePu;
			const voltageTone = v < 0.9 || v > 1.1 ? 'critical' : v < 0.95 || v > 1.05 ? 'warn' : 'ok';
			return {
				title,
				rows: [
					{ label: 'Voltage', value: `${v.toFixed(4)} pu`, tone: voltageTone },
					{ label: 'Angle', value: `${busResult.voltageAngleDeg.toFixed(3)} deg` },
				],
			};
		}
		if (context.hoveredElement.kind === 'line' || context.hoveredElement.kind === 'transformer') {
			const branchResult = result.branchResults.find(
				(item) => item.elementId === context.hoveredElement.id,
			);
			if (!branchResult) {
				return { title, statusText: 'No branch result available.', rows: [] };
			}
			const loadingTone =
				branchResult.loadingPercent >= 100
					? 'critical'
					: branchResult.loadingPercent >= 90
						? 'warn'
						: 'ok';
			return {
				title,
				subtitle: branchResult.elementType,
				rows: [
					{
						label: 'Loading',
						value: `${branchResult.loadingPercent.toFixed(1)}%`,
						tone: loadingTone,
					},
					{ label: 'P From', value: `${branchResult.pFromMw.toFixed(2)} MW` },
					{ label: 'P To', value: `${branchResult.pToMw.toFixed(2)} MW` },
				],
			};
		}
		const busId = this.resolveAttachedElementBusId(context);
		if (!busId) {
			return { title, statusText: 'No linked bus found for this element.', rows: [] };
		}
		const busResult = result.busResults.find((item) => item.busId === busId);
		if (!busResult) {
			return { title, statusText: 'No linked bus result available.', rows: [] };
		}
		const v = busResult.voltageMagnitudePu;
		const voltageTone = v < 0.9 || v > 1.1 ? 'critical' : v < 0.95 || v > 1.05 ? 'warn' : 'ok';
		return {
			title,
			subtitle: `Bus: ${busResult.busName}`,
			rows: [
				{ label: 'Bus Voltage', value: `${v.toFixed(4)} pu`, tone: voltageTone },
				{ label: 'Bus Angle', value: `${busResult.voltageAngleDeg.toFixed(3)} deg` },
			],
		};
	}

	private getHoverElementTitle(context: GridHoverResultContext): string | null {
		const id = context.hoveredElement.id;
		if (context.hoveredElement.kind === 'bus') {
			return context.dataset.buses.find((item) => item.id === id)?.name ?? null;
		}
		if (context.hoveredElement.kind === 'line') {
			return context.dataset.lines.find((item) => item.id === id)?.name ?? null;
		}
		if (context.hoveredElement.kind === 'transformer') {
			return context.dataset.transformers.find((item) => item.id === id)?.name ?? null;
		}
		if (context.hoveredElement.kind === 'load') {
			return context.dataset.loads.find((item) => item.id === id)?.name ?? null;
		}
		if (context.hoveredElement.kind === 'generator') {
			return context.dataset.generators.find((item) => item.id === id)?.name ?? null;
		}
		return context.dataset.shuntCompensators.find((item) => item.id === id)?.name ?? null;
	}

	private resolveAttachedElementBusId(context: GridHoverResultContext): string | null {
		const id = context.hoveredElement.id;
		if (context.hoveredElement.kind === 'load') {
			return context.dataset.loads.find((item) => item.id === id)?.busId ?? null;
		}
		if (context.hoveredElement.kind === 'generator') {
			return context.dataset.generators.find((item) => item.id === id)?.busId ?? null;
		}
		if (context.hoveredElement.kind === 'shunt') {
			return context.dataset.shuntCompensators.find((item) => item.id === id)?.busId ?? null;
		}
		return null;
	}
}
