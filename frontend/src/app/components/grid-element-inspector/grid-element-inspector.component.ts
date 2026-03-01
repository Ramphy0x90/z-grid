import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { merge } from 'rxjs';
import { INSPECTOR_TITLES, resolveInspectorFields } from './types/inspector-field-config';
import { GridSelectors } from '../../stores/grid/grid.selectors';
import type {
	FieldDescriptor,
	GridElementInspectorApplyEvent,
	GridElementInspectorSelection,
} from './types/inspector.types';

export type { GridElementInspectorApplyEvent, GridElementInspectorSelection } from './types/inspector.types';

@Component({
	selector: 'app-grid-element-inspector',
	imports: [ReactiveFormsModule],
	templateUrl: './grid-element-inspector.component.html',
	styleUrl: './grid-element-inspector.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridElementInspectorComponent {
	private readonly store = inject(Store);
	private formSignature: string | null = null;

	readonly selection = input<GridElementInspectorSelection | null>(null);
	protected readonly editEnabled = this.store.selectSignal(GridSelectors.isGridEditState);
	readonly busIds = input<readonly string[]>([]);
	readonly applyRequested = output<GridElementInspectorApplyEvent>();

	private readonly formState = signal<FormGroup<Record<string, FormControl<unknown>>> | null>(null);
	private readonly formChangeTick = signal(0);
	protected readonly form = this.formState.asReadonly();
	protected readonly title = computed(() => {
		const kind = this.selection()?.kind;
		return kind ? INSPECTOR_TITLES[kind] : 'Element Inspector';
	});
	protected readonly fields = computed(() => {
		const selection = this.selection();
		return selection ? resolveInspectorFields(selection.kind, this.busIds()) : [];
	});
	protected readonly canApply = computed(() => {
		this.formChangeTick();
		const form = this.form();
		return Boolean(form && this.editEnabled() && form.valid && form.dirty);
	});

	constructor() {
		effect((onCleanup) => {
			const selection = this.selection();
			const fields = this.fields();
			if (!selection) {
				this.formSignature = null;
				this.formState.set(null);
				this.formChangeTick.update((value) => value + 1);
				return;
			}
			const signature = this.createFormSignature(selection, fields);
			if (this.formSignature === signature && this.formState()) {
				return;
			}
			const rawElement = selection.element as Record<string, unknown>;
			const controls: Record<string, FormControl<unknown>> = {};
			for (const field of fields) {
				const initial = this.resolveInitialFieldValue(field, rawElement[field.key]);
				controls[field.key] = new FormControl(initial, {
					nonNullable: true,
					validators: field.inputType === 'number' ? [Validators.required] : [],
				});
			}
			const form = new FormGroup(controls);
			const formChangesSubscription = merge(form.valueChanges, form.statusChanges).subscribe(() => {
				this.formChangeTick.update((value) => value + 1);
			});
			onCleanup(() => formChangesSubscription.unsubscribe());
			this.formState.set(form);
			this.formSignature = signature;
			this.formChangeTick.update((value) => value + 1);
		});
	}

	private createFormSignature(
		selection: GridElementInspectorSelection,
		fields: readonly FieldDescriptor[],
	): string {
		const fieldSignature = fields
			.map((field) =>
				[
					field.key,
					field.inputType,
					field.options?.map((option) => option.value).join(',') ?? '',
				].join(':'),
			)
			.join('|');
		return `${selection.kind}:${selection.element.id}:${fieldSignature}`;
	}

	private resolveInitialFieldValue(field: FieldDescriptor, rawValue: unknown): unknown {
		if (field.inputType === 'number') {
			return typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : 0;
		}
		if (field.inputType === 'boolean') {
			return typeof rawValue === 'boolean' ? rawValue : false;
		}
		if (field.inputType === 'select') {
			if (typeof rawValue === 'string') {
				return rawValue;
			}
			return field.options?.[0]?.value ?? '';
		}
		return typeof rawValue === 'string' ? rawValue : '';
	}

	protected onApply(): void {
		const selection = this.selection();
		const form = this.form();
		if (!selection || !form || !this.editEnabled() || form.invalid || !form.dirty) {
			return;
		}
		this.applyRequested.emit({
			kind: selection.kind,
			id: selection.element.id,
			changes: form.getRawValue(),
		});
	}
}
