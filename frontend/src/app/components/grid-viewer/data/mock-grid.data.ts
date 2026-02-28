import type {
  BusLayout,
  BusModel,
  GeneratorModel,
  GridDataset,
  GridModel,
  LineModel,
  LoadModel,
  ShuntCompensatorModel,
  TransformerModel,
} from '../models/grid.models';

const DEFAULT_GRID: GridModel = {
  id: 'vienna-mv-grid',
  projectId: 'vienna-mv',
  name: 'Vienna District 3 - Operational Grid',
  description: 'Mock grid dataset shaped after backend models, including map/schematic layout metadata.',
  baseMva: 100,
  frequencyHz: 50,
};

const pseudoRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const buildBus = (gridId: string, index: number): BusModel => ({
  id: `bus-${index + 1}`,
  gridId,
  name: `Bus ${index + 1}`,
  nominalVoltageKv: index % 7 === 0 ? 110 : 20,
  busType: index === 0 ? 'SLACK' : index % 9 === 0 ? 'PV' : 'PQ',
  voltageMagnitudePu: 0.97 + pseudoRandom(index + 2) * 0.06,
  voltageAngleDeg: -8 + pseudoRandom(index + 7) * 16,
  minVoltagePu: 0.9,
  maxVoltagePu: 1.1,
  inService: pseudoRandom(index + 101) > 0.03,
  area: `A${(index % 4) + 1}`,
  zone: `Z${(index % 6) + 1}`,
});

const buildLayout = (busId: string, index: number, ringSize: number): BusLayout => {
  const ringIndex = Math.floor(index / ringSize);
  const indexInRing = index % ringSize;
  const angle = (indexInRing / ringSize) * Math.PI * 2;
  const radius = 0.015 + ringIndex * 0.01;

  const baseLat = 48.195;
  const baseLng = 16.41;

  const radialX = Math.cos(angle) * (180 + ringIndex * 62);
  const radialY = Math.sin(angle) * (180 + ringIndex * 62);

  return {
    busId,
    lat: baseLat + Math.sin(angle) * radius,
    lng: baseLng + Math.cos(angle) * radius,
    schematicX: 360 + radialX + (pseudoRandom(index + 1) - 0.5) * 22,
    schematicY: 280 + radialY + (pseudoRandom(index + 15) - 0.5) * 22,
  };
};

const buildLines = (gridId: string, buses: BusModel[], ringSize: number): LineModel[] => {
  const lines: LineModel[] = [];
  for (let index = 0; index < buses.length; index += 1) {
    const fromBus = buses[index];
    const nextInRing = index + 1;
    if (nextInRing < buses.length && nextInRing % ringSize !== 0) {
      lines.push({
        id: `line-ring-${index + 1}`,
        gridId,
        fromBusId: fromBus.id,
        toBusId: buses[nextInRing].id,
        name: `Line Ring ${index + 1}`,
        resistancePu: 0.004 + pseudoRandom(index) * 0.004,
        reactancePu: 0.03 + pseudoRandom(index + 3) * 0.02,
        susceptancePu: 0.001 + pseudoRandom(index + 4) * 0.004,
        ratingMva: 45 + pseudoRandom(index + 21) * 35,
        lengthKm: 0.8 + pseudoRandom(index + 31) * 2.4,
        inService: pseudoRandom(index + 141) > 0.02,
        ratingMvaShortTerm: 70,
        maxLoadingPercent: 100,
        fromSwitchClosed: true,
        toSwitchClosed: true,
      });
    }

    const sameIndexNextRing = index + ringSize;
    if (sameIndexNextRing < buses.length) {
      lines.push({
        id: `line-radial-${index + 1}`,
        gridId,
        fromBusId: fromBus.id,
        toBusId: buses[sameIndexNextRing].id,
        name: `Line Radial ${index + 1}`,
        resistancePu: 0.005 + pseudoRandom(index + 44) * 0.004,
        reactancePu: 0.02 + pseudoRandom(index + 55) * 0.03,
        susceptancePu: 0.002 + pseudoRandom(index + 66) * 0.004,
        ratingMva: 40 + pseudoRandom(index + 77) * 30,
        lengthKm: 1.2 + pseudoRandom(index + 88) * 2,
        inService: pseudoRandom(index + 188) > 0.015,
        ratingMvaShortTerm: 65,
        maxLoadingPercent: 100,
        fromSwitchClosed: true,
        toSwitchClosed: true,
      });
    }
  }
  return lines;
};

const buildTransformers = (gridId: string, buses: BusModel[]): TransformerModel[] => {
  const transformers: TransformerModel[] = [];
  for (let index = 0; index < buses.length; index += 140) {
    const source = buses[index];
    const targetIndex = Math.min(buses.length - 1, index + 70);
    if (source && buses[targetIndex] && source.id !== buses[targetIndex].id) {
      transformers.push({
        id: `tx-${index + 1}`,
        gridId,
        fromBusId: source.id,
        toBusId: buses[targetIndex].id,
        name: `Transformer ${index + 1}`,
        resistancePu: 0.0018,
        reactancePu: 0.085,
        magnetizingSusceptancePu: 0.005,
        ratingMva: 90,
        inService: true,
        tapRatio: 1,
        tapMin: 0.9,
        tapMax: 1.1,
        tapStepPercent: 1.25,
        tapSide: 'HV',
        windingType: 'TWO_WINDING',
        maxLoadingPercent: 100,
        fromSwitchClosed: true,
        toSwitchClosed: true,
      });
    }
  }
  return transformers;
};

const buildLoads = (buses: BusModel[]): LoadModel[] =>
  buses
    .filter((_, index) => index % 2 === 0)
    .map((bus, index) => ({
      id: `load-${index + 1}`,
      busId: bus.id,
      name: `Load ${index + 1}`,
      activePowerMw: 0.8 + pseudoRandom(index + 200) * 3,
      reactivePowerMvar: 0.2 + pseudoRandom(index + 230) * 1.5,
      inService: true,
      loadType: 'PQ',
      scalingFactor: 1,
    }));

const buildGenerators = (buses: BusModel[]): GeneratorModel[] =>
  buses
    .filter((_, index) => index % 25 === 0)
    .map((bus, index) => ({
      id: `gen-${index + 1}`,
      busId: bus.id,
      name: `Generator ${index + 1}`,
      activePowerMw: 2 + pseudoRandom(index + 300) * 10,
      reactivePowerMvar: 0.5 + pseudoRandom(index + 330) * 5,
      voltagePu: 1,
      minMw: 0,
      maxMw: 20,
      inService: true,
      minMvar: -10,
      maxMvar: 10,
      xdppPu: 0.2,
      costA: 0.01,
      costB: 4,
      costC: 60,
      rampRateMwPerMin: 5,
    }));

const buildShunts = (buses: BusModel[]): ShuntCompensatorModel[] =>
  buses
    .filter((_, index) => index % 40 === 0)
    .map((bus, index) => ({
      id: `shunt-${index + 1}`,
      busId: bus.id,
      name: `Shunt ${index + 1}`,
      shuntType: index % 2 === 0 ? 'CAPACITOR' : 'REACTOR',
      qMvar: 1.5 + pseudoRandom(index + 400) * 3.5,
      maxStep: 10,
      currentStep: 4,
      inService: true,
    }));

export const createSyntheticGridDataset = (
  busCount: number,
  options?: {
    projectId?: string;
    name?: string;
  },
): GridDataset => {
  const normalizedBusCount = Math.floor(busCount);

  const grid: GridModel = {
    ...DEFAULT_GRID,
    id: options?.name ? `grid-${options.name.toLowerCase().replace(/\s+/g, '-')}` : DEFAULT_GRID.id,
    projectId: options?.projectId ?? DEFAULT_GRID.projectId,
    name: options?.name ?? DEFAULT_GRID.name,
  };

  if (normalizedBusCount <= 0) {
    return {
      grid,
      buses: [],
      lines: [],
      transformers: [],
      loads: [],
      generators: [],
      shuntCompensators: [],
      busLayout: [],
      edgeLayout: [],
    };
  }

  const clampedBusCount = Math.max(24, normalizedBusCount);
  const ringSize = Math.max(12, Math.floor(Math.sqrt(clampedBusCount) * 2.2));

  const buses = Array.from({ length: clampedBusCount }, (_, index) => buildBus(grid.id, index));
  const busLayout = buses.map((bus, index) => buildLayout(bus.id, index, ringSize));
  const lines = buildLines(grid.id, buses, ringSize);
  const transformers = buildTransformers(grid.id, buses);
  const loads = buildLoads(buses);
  const generators = buildGenerators(buses);
  const shuntCompensators = buildShunts(buses);

  return {
    grid,
    buses,
    lines,
    transformers,
    loads,
    generators,
    shuntCompensators,
    busLayout,
    edgeLayout: [],
  };
};

export const mockGridDataset = createSyntheticGridDataset(320);
