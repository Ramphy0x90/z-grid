import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '../types/user-preferences.types';

@Injectable({
	providedIn: 'root',
})
export class UserPreferencesService {
	private readonly http = inject(HttpClient);
	private readonly userPreferencesApiPath = `${environment.apiBaseUrl}/api/user/preferences/me`;
	private readonly preferencesState = signal<UserPreferences>(DEFAULT_USER_PREFERENCES);
	private readonly loadedState = signal(false);
	private readonly loadedUserIdState = signal<string | null>(null);

	readonly preferences = this.preferencesState.asReadonly();
	readonly isLoaded = this.loadedState.asReadonly();

	loadMyPreferences$(): Observable<UserPreferences> {
		return this.http.get<UserPreferences>(this.userPreferencesApiPath).pipe(
			tap((preferences) => {
				this.preferencesState.set(preferences);
				this.loadedState.set(true);
				this.loadedUserIdState.set(preferences.userId);
			}),
		);
	}

	ensureLoadedForUser$(userId: string): Observable<UserPreferences> {
		if (this.loadedState() && this.loadedUserIdState() === userId) {
			return of(this.preferencesState());
		}
		return this.loadMyPreferences$();
	}

	updateMyPreferences$(preferences: UserPreferences): Observable<UserPreferences> {
		return this.http.put<UserPreferences>(this.userPreferencesApiPath, preferences).pipe(
			tap((updatedPreferences) => {
				this.preferencesState.set(updatedPreferences);
				this.loadedState.set(true);
				this.loadedUserIdState.set(updatedPreferences.userId);
			}),
		);
	}

	reset(): void {
		this.preferencesState.set(DEFAULT_USER_PREFERENCES);
		this.loadedState.set(false);
		this.loadedUserIdState.set(null);
	}
}
