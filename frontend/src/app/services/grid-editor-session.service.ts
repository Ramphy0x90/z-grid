import { Injectable, inject, signal } from '@angular/core';
import type { GridDataset } from '../components/grid-viewer/models/grid.models';
import { ProjectService } from './project.service';

export type GridEditorMode = 'view' | 'edit' | 'create';

@Injectable({
	providedIn: 'root',
})
export class GridEditorSessionService {
	private readonly projectService = inject(ProjectService);
	private readonly gridEditorModeState = signal<GridEditorMode>('view');
	private readonly createDraftDatasetState = signal<GridDataset | null>(null);

	readonly gridEditorMode = this.gridEditorModeState.asReadonly();

	getCurrentEditorDataset(selectedGridId: string | null): GridDataset | null {
		if (this.gridEditorModeState() === 'create') {
			return this.createDraftDatasetState();
		}
		if (!selectedGridId) {
			return null;
		}
		return this.projectService.getGridDatasetById(selectedGridId);
	}

	setGridEditorMode(mode: GridEditorMode): void {
		this.gridEditorModeState.set(mode);
	}

	beginCreateDraft(projectId: string): GridDataset {
		const draft: GridDataset = {
			grid: {
				id: 'draft-grid',
				projectId,
				name: 'New Grid',
				description: '',
				baseMva: 100,
				frequencyHz: 50,
			},
			buses: [],
			lines: [],
			transformers: [],
			loads: [],
			generators: [],
			shuntCompensators: [],
			busLayout: [],
			edgeLayout: [],
		};
		this.createDraftDatasetState.set(draft);
		return draft;
	}

	clearCreateDraft(): void {
		this.createDraftDatasetState.set(null);
	}

	updateCreateDraftDataset(dataset: GridDataset): void {
		const currentDraft = this.createDraftDatasetState();
		if (!currentDraft) {
			return;
		}
		this.createDraftDatasetState.set({
			...dataset,
			grid: {
				...dataset.grid,
				id: currentDraft.grid.id,
				projectId: currentDraft.grid.projectId,
			},
			buses: Array.isArray(dataset.buses) ? dataset.buses : [],
			lines: Array.isArray(dataset.lines) ? dataset.lines : [],
			transformers: Array.isArray(dataset.transformers) ? dataset.transformers : [],
			loads: Array.isArray(dataset.loads) ? dataset.loads : [],
			generators: Array.isArray(dataset.generators) ? dataset.generators : [],
			shuntCompensators: Array.isArray(dataset.shuntCompensators) ? dataset.shuntCompensators : [],
			busLayout: Array.isArray(dataset.busLayout) ? dataset.busLayout : [],
			edgeLayout: Array.isArray(dataset.edgeLayout) ? dataset.edgeLayout : [],
		});
	}

	getCreateDraftDataset(): GridDataset | null {
		return this.createDraftDatasetState();
	}
}
