const MAX_MERCATOR_LATITUDE = 85.05112878;

const clampLatitude = (latitude: number): number =>
	Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude));

export const latToMercatorY = (latitude: number): number => {
	const lat = clampLatitude(latitude);
	const latRad = (lat * Math.PI) / 180;
	return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
};

export const mercatorYToLat = (mercatorY: number): number => {
	const yRad = (mercatorY * Math.PI) / 180;
	return (Math.atan(Math.sinh(yRad)) * 180) / Math.PI;
};
