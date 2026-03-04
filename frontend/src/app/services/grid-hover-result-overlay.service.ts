import { Injectable, signal } from '@angular/core';
import type { GridHoverResultProvider } from '../types/grid-hover-result.types';

@Injectable({
	providedIn: 'root',
})
export class GridHoverResultOverlayService {
	private readonly activeProviderState = signal<GridHoverResultProvider | null>(null);

	readonly activeProvider = this.activeProviderState.asReadonly();

	setActiveProvider(provider: GridHoverResultProvider | null): void {
		this.activeProviderState.set(provider);
	}

	registerProvider(provider: GridHoverResultProvider): () => void {
		this.activeProviderState.set(provider);
		return () => {
			if (this.activeProviderState() === provider) {
				this.activeProviderState.set(null);
			}
		};
	}
}
