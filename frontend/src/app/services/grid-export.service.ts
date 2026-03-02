import { Injectable } from '@angular/core';
import type { GridDataset } from '../components/grid-viewer/models/grid.models';

@Injectable({
	providedIn: 'root',
})
export class GridExportService {
	exportDatasetAsJson(gridId: string, gridName: string | null | undefined, dataset: GridDataset): void {
		const filenameBase = this.toSafeFileName(gridName ?? '') || `grid-${gridId}`;
		this.downloadTextFile(
			`${filenameBase}.json`,
			JSON.stringify(dataset, null, 2),
			'application/json;charset=utf-8',
		);
	}

	private toSafeFileName(value: string): string {
		return value
			.trim()
			.replace(/[^a-zA-Z0-9_-]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	private downloadTextFile(filename: string, content: string, mimeType: string): void {
		const blob = new Blob([content], { type: mimeType });
		const objectUrl = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = objectUrl;
		anchor.download = filename;
		anchor.style.display = 'none';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(objectUrl);
	}
}
