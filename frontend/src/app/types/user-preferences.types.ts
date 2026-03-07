export type UserMapStyle = 'cartoDark' | 'cartoLight' | 'osmStandard' | 'openTopo';
export type UserPreferenceCountry = 'ES' | 'CH' | 'DE' | 'FR' | 'IT' | 'GB';
export type UserDefaultMapView = 'map' | 'schematic';

export type UserPreferences = {
	userId: string;
	mapStyle: UserMapStyle;
	defaultPowerQualityCountry: UserPreferenceCountry;
	defaultHostingCapacityCountry: UserPreferenceCountry;
	defaultMapView: UserDefaultMapView;
	voltageLevelColors: Record<string, string>;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
	userId: '',
	mapStyle: 'cartoDark',
	defaultPowerQualityCountry: 'DE',
	defaultHostingCapacityCountry: 'DE',
	defaultMapView: 'map',
	voltageLevelColors: {},
};
