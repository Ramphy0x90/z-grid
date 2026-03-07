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
import { GridSelectors } from '../../stores/grid/grid.selectors';
import { PowerQualityRunService } from '../../services/power-quality-run.service';
import { GridHoverResultOverlayService } from '../../services/grid-hover-result-overlay.service';
import type {
	GridHoverResultCard,
	GridHoverResultContext,
	GridHoverResultProvider,
	GridHoverResultTone,
} from '../../types/grid-hover-result.types';
import type {
	PowerQualityBusResult,
	PowerQualityCountry,
	PowerQualityDgType,
	PowerQualityRunStatus,
} from '../../types/power-quality.types';

@Component({
	selector: 'app-power-quality-page',
	imports: [GridSelectorComponent],
	templateUrl: './power-quality-page.component.html',
	styleUrl: './power-quality-page.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerQualityPageComponent {
	private readonly runService = inject(PowerQualityRunService);
	private readonly hoverResultOverlayService = inject(GridHoverResultOverlayService);
	private readonly store = inject(Store);
	private readonly destroyRef = inject(DestroyRef);

	private readonly runState = signal<PowerQualityRunStatus | null>(null);
	private readonly loadingState = signal(false);
	private readonly runningState = signal(false);
	private readonly errorState = signal<string | null>(null);
	private readonly selectedCountryState = signal<PowerQualityCountry>('DE');
	private readonly selectedDgTypeState = signal<PowerQualityDgType>('GENERIC');
	private readonly selectedDgKwState = signal(250);
	private readonly selectedPowerFactorState = signal(1);
	private pollTimer: number | null = null;
	private pollInFlight = false;

	protected readonly selectedProjectId = this.store.selectSignal(ProjectSelectors.selectedProjectId);
	protected readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
	protected readonly run = this.runState.asReadonly();
	protected readonly loading = this.loadingState.asReadonly();
	protected readonly running = this.runningState.asReadonly();
	protected readonly error = this.errorState.asReadonly();
	protected readonly selectedCountry = this.selectedCountryState.asReadonly();
	protected readonly selectedDgType = this.selectedDgTypeState.asReadonly();
	protected readonly selectedDgKw = this.selectedDgKwState.asReadonly();
	protected readonly selectedPowerFactor = this.selectedPowerFactorState.asReadonly();
	protected readonly hasResult = computed(() => this.runState()?.result != null);
	protected readonly result = computed(() => this.runState()?.result ?? null);
	protected readonly busRows = computed<PowerQualityBusResult[]>(() => this.result()?.busResults ?? []);
	protected readonly passCount = computed(() => this.busRows().filter((row) => row.passes).length);
	protected readonly failCount = computed(() => this.busRows().length - this.passCount());

	constructor() {
		const unregisterHoverProvider = this.hoverResultOverlayService.registerProvider(
			this.provideHoverResultCard,
		);
		effect(() => {
			const gridId = this.selectedGridId();
			this.runService.runRefreshToken();
			this.stopPolling();
			this.runState.set(null);
			if (!gridId) {
				this.errorState.set('Select a grid to run power-quality calculation.');
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

	protected setCountry(country: PowerQualityCountry): void {
		this.selectedCountryState.set(country);
	}

	protected setDgType(dgType: PowerQualityDgType): void {
		this.selectedDgTypeState.set(dgType);
	}

	protected setDgKw(value: string): void {
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) {
			return;
		}
		this.selectedDgKwState.set(Math.max(1, parsed));
	}

	protected setPowerFactor(value: string): void {
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) {
			return;
		}
		this.selectedPowerFactorState.set(Math.min(1, Math.max(0.1, parsed)));
	}

	protected runPowerQuality(): void {
		const projectId = this.selectedProjectId();
		const gridId = this.selectedGridId();
		if (!projectId || !gridId || this.running()) {
			return;
		}
		this.runningState.set(true);
		this.errorState.set(null);
		this.runService
			.startRun$(gridId, {
				country: this.selectedCountry(),
				dgKw: this.selectedDgKw(),
				dgType: this.selectedDgType(),
				dgPowerFactor: this.selectedPowerFactor(),
			})
			.pipe(
				take(1),
				finalize(() => this.runningState.set(false)),
			)
			.subscribe({
				next: (response) => {
					const current = this.runState();
					this.runState.set({
						runId: response.runId,
						gridId,
						status: response.status,
						solver: current?.solver ?? 'remote-python-power-quality-v1',
						errorMessage: null,
						createdAt: response.createdAt,
						startedAt: current?.startedAt ?? null,
						finishedAt: null,
						result: current?.runId === response.runId ? current.result : null,
					});
					this.startPolling(gridId);
				},
				error: () => {
					this.errorState.set('Failed to start power-quality run.');
				},
			});
	}

	private loadLatestRun(gridId: string): void {
		this.loadingState.set(true);
		this.runService
			.listRuns$(gridId)
			.pipe(
				take(1),
				finalize(() => this.loadingState.set(false)),
			)
			.subscribe({
				next: (runs) => {
					const latest = runs[0] ?? null;
					this.runState.set(latest);
					if (!latest) {
						this.stopPolling();
					} else if (latest.status === 'QUEUED' || latest.status === 'RUNNING') {
						this.startPolling(gridId);
					} else {
						this.stopPolling();
					}
				},
				error: () => {
					const cached = this.runService.getLatestRun(gridId);
					this.runState.set(cached);
					if (!cached) {
						this.errorState.set('Could not load power-quality history.');
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
		this.runService
			.getRun$(gridId, runId)
			.pipe(
				take(1),
				finalize(() => {
					this.pollInFlight = false;
				}),
			)
			.subscribe({
				next: (run) => {
					this.runState.set(run);
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
			return { title, statusText: 'No power-quality run available for this grid.', rows: [] };
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
		return this.buildResultHoverCard(context, run);
	};

	private buildResultHoverCard(
		context: GridHoverResultContext,
		run: PowerQualityRunStatus,
	): GridHoverResultCard {
		const title = this.getHoverElementTitle(context) ?? 'Element';
		const result = run.result;
		if (!result) {
			return { title, statusText: 'No result payload available.', rows: [] };
		}
		const directBusResult =
			context.hoveredElement.kind === 'bus'
				? result.busResults.find((item) => item.busId === context.hoveredElement.id) ?? null
				: null;
		if (directBusResult) {
			return this.toBusHoverCard(title, directBusResult, false);
		}

		const attachedBusId = this.resolveAttachedElementBusId(context);
		if (attachedBusId) {
			const busResult = result.busResults.find((item) => item.busId === attachedBusId);
			if (!busResult) {
				return { title, statusText: 'No linked bus result available.', rows: [] };
			}
			return this.toBusHoverCard(title, busResult, true);
		}

		return { title, statusText: 'No power-quality result available for this element.', rows: [] };
	}

	private toBusHoverCard(
		title: string,
		busResult: PowerQualityBusResult,
		showLinkedSubtitle: boolean,
	): GridHoverResultCard {
		const metricTone = this.toMetricTone(busResult.passes);
		const thdLimit = this.result()?.constraintsApplied.thdLimitPct ?? 8;
		const flickerLimit = this.result()?.constraintsApplied.flickerPltLimit ?? 1;
		const unbalanceLimit = this.result()?.constraintsApplied.voltageUnbalanceLimitPct ?? 2;
		return {
			title,
			subtitle: showLinkedSubtitle ? `Bus ${busResult.busId}` : undefined,
			rows: [
				{ label: 'Status', value: busResult.passes ? 'PASS' : 'FAIL', tone: metricTone },
				{
					label: 'THD',
					value: `${busResult.thdPct.toFixed(3)}% (limit ${thdLimit.toFixed(3)}%)`,
					tone: busResult.thdPct <= thdLimit ? 'ok' : 'critical',
				},
				{
					label: 'Flicker',
					value: `${busResult.flickerPlt.toFixed(3)} (limit ${flickerLimit.toFixed(3)})`,
					tone: busResult.flickerPlt <= flickerLimit ? 'ok' : 'critical',
				},
				{
					label: 'Unbalance',
					value: `${busResult.voltageUnbalancePct.toFixed(3)}% (limit ${unbalanceLimit.toFixed(3)}%)`,
					tone: busResult.voltageUnbalancePct <= unbalanceLimit ? 'ok' : 'critical',
				},
				{
					label: 'Limiting Metric',
					value: busResult.limitingMetric,
					tone: busResult.limitingMetric === 'NONE' ? 'ok' : 'warn',
				},
				{
					label: 'Ssc/Sn',
					value: busResult.sscSnRatio === null ? '-' : busResult.sscSnRatio.toFixed(3),
				},
			],
		};
	}

	private toMetricTone(passes: boolean): GridHoverResultTone {
		return passes ? 'ok' : 'critical';
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
