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
import { ShortCircuitRunService } from '../../services/short-circuit-run.service';
import { GridHoverResultOverlayService } from '../../services/grid-hover-result-overlay.service';
import type {
	GridHoverResultCard,
	GridHoverResultContext,
	GridHoverResultProvider,
	GridHoverResultRow,
} from '../../types/grid-hover-result.types';
import type {
	ShortCircuitFaultType,
	ShortCircuitRunStatus,
} from '../../types/short-circuit.types';

const ALL_FAULT_TYPES: readonly ShortCircuitFaultType[] = ['3PH', 'SLG', 'LL', 'DLG'];

@Component({
  selector: 'app-short-circuit-page',
  imports: [GridSelectorComponent],
  templateUrl: './short-circuit-page.component.html',
  styleUrl: './short-circuit-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortCircuitPageComponent {
	private readonly runService = inject(ShortCircuitRunService);
	private readonly hoverResultOverlayService = inject(GridHoverResultOverlayService);
	private readonly store = inject(Store);
	private readonly destroyRef = inject(DestroyRef);

	private readonly runState = signal<ShortCircuitRunStatus | null>(null);
	private readonly loadingState = signal(false);
	private readonly errorState = signal<string | null>(null);
	private readonly succeededWithoutResultPollCountState = signal(0);
	private readonly selectedFaultTypesState = signal<Set<ShortCircuitFaultType>>(
		new Set<ShortCircuitFaultType>(ALL_FAULT_TYPES),
	);
	private pollTimer: number | null = null;
	private pollInFlight = false;

	protected readonly selectedProjectId = this.store.selectSignal(ProjectSelectors.selectedProjectId);
	protected readonly selectedGridId = this.store.selectSignal(GridSelectors.selectedGridId);
	protected readonly runOperation = this.store.selectSignal(GridSelectors.shortCircuitRunOperation);
	protected readonly run = this.runState.asReadonly();
	protected readonly loading = this.loadingState.asReadonly();
	protected readonly error = this.errorState.asReadonly();
	protected readonly hasResult = computed(() => this.runState()?.result != null);
	protected readonly result = computed(() => this.runState()?.result ?? null);
	protected readonly selectedFaultTypes = computed<ShortCircuitFaultType[]>(() =>
		ALL_FAULT_TYPES.filter((faultType) => this.selectedFaultTypesState().has(faultType)),
	);
	protected readonly busRows = computed(() => this.result()?.busResults ?? []);
	protected readonly maxFaultKa = computed(() => {
		const rows = this.busRows();
		if (rows.length === 0) {
			return 0;
		}
		return Math.max(...rows.map((row) => row.maxIkssKa));
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
				this.errorState.set('Select a grid to run short-circuit calculation.');
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

	protected toggleFaultType(faultType: ShortCircuitFaultType, checked: boolean): void {
		this.selectedFaultTypesState.update((current) => {
			const next = new Set(current);
			if (checked) {
				next.add(faultType);
			} else if (next.size > 1) {
				next.delete(faultType);
			}
			return next;
		});
	}

	protected runShortCircuit(): void {
		const projectId = this.selectedProjectId();
		const gridId = this.selectedGridId();
		if (!projectId || !gridId || this.runOperation().isRunning) {
			return;
		}
		const faultTypes = this.selectedFaultTypes();
		this.store.dispatch(
			GridActions.shortCircuitRunRequested({
				projectId,
				gridId,
				options: { faultTypes },
			}),
		);
	}

	protected faultValue(
		faults: Partial<Record<ShortCircuitFaultType, { ikssKa: number }>>,
		faultType: ShortCircuitFaultType,
	): number | null {
		const value = faults[faultType]?.ikssKa;
		return typeof value === 'number' ? value : null;
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
					const cached = this.runService.getLatestRun(gridId);
					this.runState.set(cached);
					if (!cached) {
						this.errorState.set('Could not load short-circuit history.');
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
					if (run.status === 'SUCCEEDED' && run.result === null) {
						const attempts = this.succeededWithoutResultPollCountState() + 1;
						this.succeededWithoutResultPollCountState.set(attempts);
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
		if (context.hoveredElement.kind !== 'bus') {
			return null;
		}
		const bus = context.dataset.buses.find((item) => item.id === context.hoveredElement.id);
		if (!bus) {
			return null;
		}
		const run = this.runState();
		if (!run || !run.result) {
			return { title: bus.name, statusText: 'No short-circuit result available.', rows: [] };
		}
		const busResult = run.result.busResults.find((item) => item.busId === bus.id);
		if (!busResult) {
			return { title: bus.name, statusText: 'No short-circuit result for this bus.', rows: [] };
		}
		const rows: GridHoverResultRow[] = [];
		for (const faultType of this.selectedFaultTypes()) {
			const metric = busResult.faults[faultType];
			if (!metric) {
				continue;
			}
			rows.push({
				label: faultType,
				value: `${metric.ikssKa.toFixed(3)} kA`,
				tone: metric.ikssKa >= 25 ? 'critical' : metric.ikssKa >= 15 ? 'warn' : 'ok',
			});
		}
		return {
			title: bus.name,
			subtitle: `${bus.nominalVoltageKv.toFixed(1)} kV`,
			rows,
		};
	};
}
