export interface Pharmacy {
  id: string; // ODSCode
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  openingTimes: OpeningTime[];
  subType: string | null;
}

export interface OpeningTime {
  Weekday: string;
  OpeningTime: string;
  ClosingTime: string;
  IsOpen: boolean;
}

export interface PharmacySearchResponse {
  pharmacies: Pharmacy[];
  total: number;
  error?: string;
}
