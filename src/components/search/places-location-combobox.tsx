"use client";

/**
 * Wrapper around LocationCombobox that provides the Google Maps Places library
 * for client-side autocomplete. This avoids server-side REST API calls which
 * fail when the API key has HTTP referrer restrictions.
 *
 * Uses @vis.gl/react-google-maps APIProvider to load the Places library,
 * then passes it to LocationCombobox via the _placesLib prop.
 */

import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import {
  LocationCombobox,
  type LocationComboboxProps,
} from "./location-combobox";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Bridge component that loads the Places library via hook */
function PlacesBridge(props: LocationComboboxProps) {
  const placesLib = useMapsLibrary("places");
  return <LocationCombobox {...props} _placesLib={placesLib ?? undefined} />;
}

/**
 * LocationCombobox with Google Places Autocomplete support.
 *
 * When `onPlaceSelect` is provided and the API key exists, wraps in
 * APIProvider so the Maps JS Places library is available client-side.
 * Otherwise renders a plain LocationCombobox.
 */
export function PlacesLocationCombobox(props: LocationComboboxProps) {
  if (!props.onPlaceSelect || !API_KEY) {
    return <LocationCombobox {...props} />;
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <PlacesBridge {...props} />
    </APIProvider>
  );
}
