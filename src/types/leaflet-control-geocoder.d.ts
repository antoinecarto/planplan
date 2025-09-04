declare module "leaflet-control-geocoder" {
  import * as L from "leaflet";

  interface GeocoderResult {
    name: string;
    bbox: L.LatLngBounds;
    center: L.LatLng;
  }

  interface GeocoderOptions {
    geocoder?: any;
    defaultMarkGeocode?: boolean;
  }

  const nominatim: () => any;
  const geocoder: (options?: GeocoderOptions) => any;

  export { nominatim, geocoder };
  export default { nominatim, geocoder };
}
