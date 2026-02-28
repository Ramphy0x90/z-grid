export type BusType = 'PQ' | 'PV' | 'SLACK';
export type LoadType = 'PQ' | 'I' | 'Z';
export type ShuntType = 'CAPACITOR' | 'REACTOR';
export type TapSide = 'HV' | 'LV';
export type WindingType = 'TWO_WINDING' | 'THREE_WINDING';

export type GridModel = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  baseMva: number;
  frequencyHz: number;
};

export type BusModel = {
  id: string;
  gridId: string;
  name: string;
  nominalVoltageKv: number;
  busType: BusType;
  voltageMagnitudePu: number;
  voltageAngleDeg: number;
  minVoltagePu: number;
  maxVoltagePu: number;
  inService: boolean;
  area: string;
  zone: string;
};

export type LineModel = {
  id: string;
  gridId: string;
  fromBusId: string;
  toBusId: string;
  name: string;
  resistancePu: number;
  reactancePu: number;
  susceptancePu: number;
  ratingMva: number;
  lengthKm: number;
  inService: boolean;
  ratingMvaShortTerm: number;
  maxLoadingPercent: number;
  fromSwitchClosed: boolean;
  toSwitchClosed: boolean;
};

export type TransformerModel = {
  id: string;
  gridId: string;
  fromBusId: string;
  toBusId: string;
  name: string;
  resistancePu: number;
  reactancePu: number;
  magnetizingSusceptancePu: number;
  ratingMva: number;
  inService: boolean;
  tapRatio: number;
  tapMin: number;
  tapMax: number;
  tapStepPercent: number;
  tapSide: TapSide;
  windingType: WindingType;
  maxLoadingPercent: number;
  fromSwitchClosed: boolean;
  toSwitchClosed: boolean;
};

export type LoadModel = {
  id: string;
  busId: string;
  name: string;
  activePowerMw: number;
  reactivePowerMvar: number;
  inService: boolean;
  loadType: LoadType;
  scalingFactor: number;
};

export type GeneratorModel = {
  id: string;
  busId: string;
  name: string;
  activePowerMw: number;
  reactivePowerMvar: number;
  voltagePu: number;
  minMw: number;
  maxMw: number;
  inService: boolean;
  minMvar: number;
  maxMvar: number;
  xdppPu: number;
  costA: number;
  costB: number;
  costC: number;
  rampRateMwPerMin: number;
};

export type ShuntCompensatorModel = {
  id: string;
  busId: string;
  name: string;
  shuntType: ShuntType;
  qMvar: number;
  maxStep: number;
  currentStep: number;
  inService: boolean;
};

export type BusLayout = {
  busId: string;
  lat: number;
  lng: number;
  schematicX: number;
  schematicY: number;
};

export type EdgeLayout = {
  edgeId: string;
  mapMidpoint?: [number, number];
  schematicMidpoint?: [number, number];
};

export type GridDataset = {
  grid: GridModel;
  buses: BusModel[];
  lines: LineModel[];
  transformers: TransformerModel[];
  loads: LoadModel[];
  generators: GeneratorModel[];
  shuntCompensators: ShuntCompensatorModel[];
  busLayout: BusLayout[];
  edgeLayout: EdgeLayout[];
};
