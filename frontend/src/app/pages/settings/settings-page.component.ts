import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	OnInit,
	inject,
	signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take, finalize } from 'rxjs';
import { UserPreferencesService } from '../../services/user-preferences.service';
import type {
	UserDefaultMapView,
	UserMapStyle,
	UserPreferenceCountry,
} from '../../types/user-preferences.types';

@Component({
	selector: 'app-settings-page',
	imports: [ReactiveFormsModule],
	templateUrl: './settings-page.component.html',
	styleUrl: './settings-page.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent implements OnInit {
	private readonly fb = inject(FormBuilder);
	private readonly userPreferencesService = inject(UserPreferencesService);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly saving = signal(false);
	protected readonly saveSuccess = signal(false);
	protected readonly saveError = signal<string | null>(null);

	protected readonly mapStyleOptions: { value: UserMapStyle; label: string; description: string }[] = [
		{ value: 'cartoDark', label: 'Carto Dark', description: 'Dark basemap, ideal for night use' },
		{ value: 'cartoLight', label: 'Carto Light', description: 'Clean light basemap' },
		{ value: 'osmStandard', label: 'OSM Standard', description: 'OpenStreetMap standard tiles' },
		{ value: 'openTopo', label: 'Open Topo', description: 'Topographic map with elevation detail' },
	];

	protected readonly mapViewOptions: { value: UserDefaultMapView; label: string; icon: string }[] = [
		{ value: 'map', label: 'Geographic Map', icon: 'bi-map' },
		{ value: 'schematic', label: 'Schematic', icon: 'bi-diagram-3' },
	];

	protected readonly countryOptions: { value: UserPreferenceCountry; label: string; flag: string }[] = [
		{ value: 'DE', label: 'Germany', flag: '🇩🇪' },
		{ value: 'CH', label: 'Switzerland', flag: '🇨🇭' },
		{ value: 'FR', label: 'France', flag: '🇫🇷' },
		{ value: 'ES', label: 'Spain', flag: '🇪🇸' },
		{ value: 'IT', label: 'Italy', flag: '🇮🇹' },
		{ value: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
	];

	protected readonly form: FormGroup = this.fb.group({
		mapStyle: ['' as UserMapStyle, Validators.required],
		defaultMapView: ['' as UserDefaultMapView, Validators.required],
		defaultPowerQualityCountry: ['' as UserPreferenceCountry, Validators.required],
		defaultHostingCapacityCountry: ['' as UserPreferenceCountry, Validators.required],
	});

	constructor() {
		this.destroyRef.onDestroy(() => {});
	}

	ngOnInit(): void {
		const prefs = this.userPreferencesService.preferences();
		this.form.setValue({
			mapStyle: prefs.mapStyle,
			defaultMapView: prefs.defaultMapView,
			defaultPowerQualityCountry: prefs.defaultPowerQualityCountry,
			defaultHostingCapacityCountry: prefs.defaultHostingCapacityCountry,
		});
	}

	protected save(): void {
		if (this.form.invalid || this.saving()) {
			return;
		}
		this.saving.set(true);
		this.saveSuccess.set(false);
		this.saveError.set(null);

		const current = this.userPreferencesService.preferences();
		const updated = {
			...current,
			mapStyle: this.form.value.mapStyle as UserMapStyle,
			defaultMapView: this.form.value.defaultMapView as UserDefaultMapView,
			defaultPowerQualityCountry: this.form.value.defaultPowerQualityCountry as UserPreferenceCountry,
			defaultHostingCapacityCountry: this.form.value.defaultHostingCapacityCountry as UserPreferenceCountry,
		};

		this.userPreferencesService
			.updateMyPreferences$(updated)
			.pipe(
				take(1),
				finalize(() => this.saving.set(false)),
			)
			.subscribe({
				next: () => {
					this.saveSuccess.set(true);
					window.setTimeout(() => this.saveSuccess.set(false), 3000);
				},
				error: () => {
					this.saveError.set('Failed to save preferences. Please try again.');
				},
			});
	}
}
