"use client";

import { useEffect, useRef, useCallback } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/input";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface ParsedAddress {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface AddressAutocompleteInnerProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (address: ParsedAddress) => void;
  placeholder?: string;
}

function AddressAutocompleteInner({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
}: AddressAutocompleteInnerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const places = useMapsLibrary("places");

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.address_components) return;

    const components = place.address_components;
    let streetNumber = "";
    let route = "";
    let city = "";
    let state = "";
    let postalCode = "";
    let country = "";

    for (const component of components) {
      const types = component.types;
      if (types.includes("street_number")) {
        streetNumber = component.long_name;
      } else if (types.includes("route")) {
        route = component.long_name;
      } else if (
        types.includes("locality") ||
        types.includes("postal_town")
      ) {
        city = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        state = component.long_name;
      } else if (types.includes("postal_code")) {
        postalCode = component.long_name;
      } else if (types.includes("country")) {
        country = component.long_name;
      }
    }

    const addressLine1 = streetNumber
      ? `${streetNumber} ${route}`
      : route || place.formatted_address || "";

    onPlaceSelect({
      addressLine1: addressLine1.trim(),
      city,
      state,
      postalCode,
      country,
    });
  }, [onPlaceSelect]);

  useEffect(() => {
    if (!places || !inputRef.current || autocompleteRef.current) return;

    autocompleteRef.current = new places.Autocomplete(inputRef.current, {
      types: ["address"],
      fields: ["address_components", "formatted_address"],
    });

    autocompleteRef.current.addListener("place_changed", handlePlaceChanged);

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [places, handlePlaceChanged]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1.5"
    />
  );
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (address: ParsedAddress) => void;
  placeholder?: string;
}

export function AddressAutocomplete(props: AddressAutocompleteProps) {
  if (!API_KEY) {
    return (
      <Input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="mt-1.5"
      />
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <AddressAutocompleteInner {...props} />
    </APIProvider>
  );
}
