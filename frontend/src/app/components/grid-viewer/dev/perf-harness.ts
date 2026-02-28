import type { GridDataset } from '../models/grid.models';
import { createSyntheticGridDataset } from '../data/mock-grid.data';

export const createPerfGridDataset = (busCount: number): GridDataset =>
  createSyntheticGridDataset(busCount, {
    name: `Perf ${busCount} bus`,
  });
