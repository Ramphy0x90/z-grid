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
import { HostingCapacityRunService } from '../../services/hosting-capacity-run.service';
import { GridHoverResultOverlayService } from '../../services/grid-hover-result-overlay.service';
import type {
	GridHoverResultCard,
	GridHoverResultContext,
	GridHoverResultProvider,
	GridHoverResultTone,
} from '../../types/grid-hover-result.types';
import type {
	HostingCapacityBusResult,
	HostingCapacityRunStatus,
} from '../../types/hosting-capacity.types';

@Component({
	selector: 'app-hosting-capacity-page',
	imports: [GridSelectorComponent],
	templateUrl: './hosting-capacity-page.component.html',
	styleUrl: './hosting-capacity-page.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HostingCapacityPageComponent {
	private readonly runService = inject(HostingCapacityRunService);
	private readonly hoverResultOverlayService = inject(GridHoverResultOverlayService);
	private readonly store = inject(Store);
	private readonly destroyRef = inject(DestroyRef);

	private readonly runState = signal<HostingCapacityRunStatus | null>(null);
	private readonly loadingState = signal(false);
	private readonly runningState = signal(false);
	private readonly errorState = signal<string | null>(null);
	private readonly selectedCountryState = signal<'ES' | 'CH' | 'DE' | 'FR' | 'IT' | 'GB'>('DE');
	private readonly checkPowerQualityState = signal(true);
	private pollTimer: number | null = null;
	private pollInFlight = false;

	protected readonly selectedProjectId = this.store.selectSignal(ProjectSelectors.selectedProjectId);
	protected readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
	protected readonly run = this.runState.asReadonly();
	protected readonly loading = this.loadingState.asReadonly();
	protected readonly running = this.runningState.asReadonly();
	protected readonly error = this.errorState.asReadonly();
	protected readonly selectedCountry = this.selectedCountryState.asReadonly();
	protected readonly checkPowerQuality = this.checkPowerQualityState.asReadonly();
	protected readonly hasResult = computed(() => this.runState()?.result != null);
	protected readonly result = computed(() => this.runState()?.result ?? null);
	protected readonly busRows = computed<HostingCapacityBusResult[]>(() => this.result()?.busResults ?? []);
	protected readonly meanHcKw = computed(() => {
		const rows = this.busRows();
		if (rows.length === 0) {
			return 0;
		}
		return rows.reduce((sum, row) => sum + row.hcKw, 0) / rows.length;
	});
	protected readonly minHcKw = computed(() => {
		const rows = this.busRows();
		if (rows.length === 0) {
			return 0;
		}
		return Math.min(...rows.map((row) => row.hcKw));
	});
	protected readonly maxHcKw = computed(() => {
		const rows = this.busRows();
		if (rows.length === 0) {
			return 0;
		}
		return Math.max(...rows.map((row) => row.hcKw));
	});

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
				this.errorState.set('Select a grid to run hosting capacity calculation.');
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

	protected setCountry(country: 'ES' | 'CH' | 'DE' | 'FR' | 'IT' | 'GB'): void {
		this.selectedCountryState.set(country);
	}

	protected setCheckPowerQuality(checked: boolean): void {
		this.checkPowerQualityState.set(checked);
	}

	protected runHostingCapacity(): void {
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
				checkPowerQuality: this.checkPowerQuality(),
				checkVoltage: true,
				checkVoltageRise: true,
				checkThermal: true,
				checkShortCircuit: true,
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
						solver: current?.solver ?? 'remote-python-hosting-capacity-v1',
						errorMessage: null,
						createdAt: response.createdAt,
						startedAt: current?.startedAt ?? null,
						finishedAt: null,
						result: current?.runId === response.runId ? current.result : null,
					});
					this.startPolling(gridId);
				},
				error: () => {
					this.errorState.set('Failed to start hosting capacity run.');
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
						this.errorState.set('Could not load hosting capacity history.');
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
			return { title, statusText: 'No hosting-capacity run available for this grid.', rows: [] };
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
		run: HostingCapacityRunStatus,
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
			return this.toBusHoverCard(context, title, directBusResult);
		}

		const attachedBusId = this.resolveAttachedElementBusId(context);
		if (attachedBusId) {
			const busResult = result.busResults.find((item) => item.busId === attachedBusId);
			if (!busResult) {
				return { title, statusText: 'No linked bus result available.', rows: [] };
			}
			return this.toBusHoverCard(context, title, busResult, true);
		}

		if (context.hoveredElement.kind === 'line' || context.hoveredElement.kind === 'transformer') {
			const limitingBus = result.busResults.find(
				(item) => item.maxBranchId === context.hoveredElement.id,
			);
			if (!limitingBus) {
				return { title, statusText: 'No hosting-capacity result available for this element.', rows: [] };
			}
			return this.toBusHoverCard(context, title, limitingBus, true);
		}

		return { title, statusText: 'No result available for this element.', rows: [] };
	}

	private toBusHoverCard(
		context: GridHoverResultContext,
		title: string,
		busResult: HostingCapacityBusResult,
		showLinkedSubtitle = false,
	): GridHoverResultCard {
		const nominalKv = context.dataset.buses.find((item) => item.id === busResult.busId)?.nominalVoltageKv;
		const voltageTone = this.toVoltageTone(busResult.voltageAtHcPu);
		const riseLimit = this.resolveVoltageRiseLimit(context, busResult.busId);
		const voltageRiseTone = this.toVoltageRiseTone(busResult.voltageRiseAtHcPu, riseLimit);
		const loadingTone = this.toLoadingTone(busResult.maxBranchLoadingPct);
		const sscSnTone = this.toSscSnTone(busResult.sscSnRatio);
		return {
			title,
			subtitle: showLinkedSubtitle
				? `Bus ${busResult.busId}${typeof nominalKv === 'number' ? ` (${nominalKv.toFixed(1)} kV)` : ''}`
				: typeof nominalKv === 'number'
					? `${nominalKv.toFixed(1)} kV`
					: undefined,
			rows: [
				{ label: 'Hosting Capacity', value: `${busResult.hcKw.toFixed(2)} kW`, tone: 'ok' },
				{ label: 'Constraint', value: this.prettyConstraint(busResult.bindingConstraint) },
				{
					label: 'Voltage @ HC',
					value: `${busResult.voltageAtHcPu.toFixed(4)} pu`,
					tone: voltageTone,
				},
				{
					label: 'Voltage Rise',
					value: `${busResult.voltageRiseAtHcPu.toFixed(4)} pu`,
					tone: voltageRiseTone,
				},
				{
					label: 'Max Branch Loading',
					value: `${busResult.maxBranchLoadingPct.toFixed(2)}%`,
					tone: loadingTone,
				},
				{
					label: 'Ssc/Sn',
					value: busResult.sscSnRatio === null ? '-' : busResult.sscSnRatio.toFixed(3),
					tone: sscSnTone,
				},
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

	private prettyConstraint(value: HostingCapacityBusResult['bindingConstraint']): string {
		return value.replaceAll('_', ' ');
	}

	private toVoltageTone(voltagePu: number): GridHoverResultTone {
		if (voltagePu < 0.9 || voltagePu > 1.1) {
			return 'critical';
		}
		if (voltagePu < 0.95 || voltagePu > 1.05) {
			return 'warn';
		}
		return 'ok';
	}

	private resolveVoltageRiseLimit(context: GridHoverResultContext, busId: string): number {
		const runResult = this.runState()?.result;
		if (!runResult) {
			return 0.03;
		}
		const bus = context.dataset.buses.find((item) => item.id === busId);
		if (!bus) {
			return Math.max(
				runResult.constraintsApplied.voltageRiseLimitLvPu,
				runResult.constraintsApplied.voltageRiseLimitMvPu,
			);
		}
		return bus.nominalVoltageKv <= 1
			? runResult.constraintsApplied.voltageRiseLimitLvPu
			: runResult.constraintsApplied.voltageRiseLimitMvPu;
	}

	private toVoltageRiseTone(voltageRisePu: number, limitPu: number): GridHoverResultTone {
		if (voltageRisePu > limitPu) {
			return 'critical';
		}
		if (voltageRisePu > limitPu * 0.85) {
			return 'warn';
		}
		return 'ok';
	}

	private toLoadingTone(loadingPct: number): GridHoverResultTone {
		if (loadingPct >= 100) {
			return 'critical';
		}
		if (loadingPct >= 90) {
			return 'warn';
		}
		return 'ok';
	}

	private toSscSnTone(sscSnRatio: number | null): GridHoverResultTone {
		if (sscSnRatio === null) {
			return 'default';
		}
		const limit = this.runState()?.result?.constraintsApplied.minSscSnRatio;
		if (typeof limit !== 'number') {
			return sscSnRatio < 1 ? 'critical' : sscSnRatio < 1.3 ? 'warn' : 'ok';
		}
		if (sscSnRatio < limit) {
			return 'critical';
		}
		if (sscSnRatio < limit * 1.2) {
			return 'warn';
		}
		return 'ok';
	}
}
