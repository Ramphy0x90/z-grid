import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

@Component({
	selector: 'app-layout-divider',
	templateUrl: './layout-divider.component.html',
	styleUrl: './layout-divider.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutDividerComponent {
	private static readonly DRAG_SNAP_THRESHOLD = 2.5;

	readonly trackElement = input<HTMLElement | null>(null);
	readonly value = input.required<number>();
	readonly min = input(20);
	readonly max = input(80);
	readonly presets = input<readonly number[]>([]);
	readonly leftPanelLabel = input('page');
	readonly rightPanelLabel = input('grid viewer');
	readonly ariaLabel = input('Resize page and grid viewer panels');

	readonly valueChange = output<number>();
	readonly draggingChange = output<boolean>();

	private readonly draggingState = signal(false);
	private readonly dragValueState = signal<number | null>(null);

	protected readonly isDragging = this.draggingState.asReadonly();
	protected readonly ariaValueText = computed(() => {
		const left = Math.round(this.currentValue());
		return `${left}% ${this.leftPanelLabel()}, ${100 - left}% ${this.rightPanelLabel()}`;
	});

	protected onPointerDown(event: PointerEvent): void {
		if (event.button !== 0) {
			return;
		}
		const divider = event.currentTarget;
		if (!(divider instanceof HTMLElement)) {
			return;
		}
		divider.setPointerCapture(event.pointerId);
		this.draggingState.set(true);
		this.draggingChange.emit(true);
		this.updateFromClientX(event.clientX, true);
	}

	protected onPointerMove(event: PointerEvent): void {
		if (!this.draggingState()) {
			return;
		}
		this.updateFromClientX(event.clientX, true);
	}

	protected onPointerUp(event: PointerEvent): void {
		if (!this.draggingState()) {
			return;
		}
		const divider = event.currentTarget;
		if (divider instanceof HTMLElement && divider.hasPointerCapture(event.pointerId)) {
			divider.releasePointerCapture(event.pointerId);
		}
		this.draggingState.set(false);
		this.draggingChange.emit(false);

		const snapped = this.snapToNearestPreset(this.currentValue());
		this.dragValueState.set(null);
		this.valueChange.emit(snapped);
	}

	protected onKeydown(event: KeyboardEvent): void {
		const current = this.currentValue();
		let nextPreset: number | null = null;

		if (event.key === 'ArrowLeft') {
			nextPreset = this.findPreviousPreset(current);
		} else if (event.key === 'ArrowRight') {
			nextPreset = this.findNextPreset(current);
		} else if (event.key === 'Home') {
			nextPreset = this.presets()[0] ?? this.min();
		} else if (event.key === 'End') {
			nextPreset = this.presets()[this.presets().length - 1] ?? this.max();
		}

		if (nextPreset === null) {
			return;
		}
		event.preventDefault();
		this.valueChange.emit(nextPreset);
	}

	protected currentValue(): number {
		return this.dragValueState() ?? this.value();
	}

	private updateFromClientX(clientX: number, applyMagneticSnap: boolean): void {
		const trackElement = this.trackElement();
		if (!trackElement) {
			return;
		}
		const bounds = trackElement.getBoundingClientRect();
		if (bounds.width <= 0) {
			return;
		}

		const dividerWidth = this.getDividerWidth(trackElement);
		const usableWidth = bounds.width - dividerWidth;
		if (usableWidth <= 0) {
			return;
		}

		const rawPercent = ((clientX - bounds.left - dividerWidth / 2) / usableWidth) * 100;
		const clamped = this.clamp(rawPercent, this.min(), this.max());
		const next = applyMagneticSnap ? this.applyDragSnap(clamped) : clamped;

		this.dragValueState.set(next);
		this.valueChange.emit(next);
	}

	private applyDragSnap(value: number): number {
		const presets = this.presets();
		if (presets.length === 0) {
			return value;
		}
		const nearest = this.nearestPreset(value);
		return Math.abs(nearest - value) <= LayoutDividerComponent.DRAG_SNAP_THRESHOLD
			? nearest
			: value;
	}

	private snapToNearestPreset(value: number): number {
		const presets = this.presets();
		if (presets.length === 0) {
			return value;
		}
		return this.nearestPreset(value);
	}

	private nearestPreset(value: number): number {
		const presets = this.presets();
		if (presets.length === 0) {
			return value;
		}
		return presets.reduce((closest, preset) =>
			Math.abs(preset - value) < Math.abs(closest - value) ? preset : closest,
		);
	}

	private findPreviousPreset(current: number): number | null {
		const values = this.presets();
		if (values.length === 0) {
			return null;
		}
		const previous = values.filter((preset) => preset < current);
		return previous.length > 0 ? previous[previous.length - 1] : null;
	}

	private findNextPreset(current: number): number | null {
		const values = this.presets();
		if (values.length === 0) {
			return null;
		}
		const next = values.filter((preset) => preset > current);
		return next.length > 0 ? next[0] : null;
	}

	private getDividerWidth(trackElement: HTMLElement): number {
		const widthValue = getComputedStyle(trackElement).getPropertyValue('--divider-width').trim();
		const parsed = Number.parseFloat(widthValue);
		return Number.isFinite(parsed) ? parsed : 10;
	}

	private clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}
}
