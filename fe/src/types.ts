export type RegionId = 'saigon' | 'binhduong' | 'vungtau';
export type TimeSlot = 'morning' | 'afternoon' | 'night';
export interface Vendor {
  id: string;
  name: string;
  nameEn?: string;
  owner: string;
  dish: string;
  dishEn: string;
  region: RegionId;
  area: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  hours: [number, number];
  years: number;
  ingredients: string[];
  ingredientsEn?: string[];
  allergens: string[];
  tip: string;
  tipEn?: string;
  story: string;
  storyEn?: string;
  storyAudioUrl?: string;
  storyAudioUrlEn?: string;
  badge: string;
  image: string;
  arrival?: string;
  dataType?: 'illustrative' | 'reference' | 'community';
  sourceUrl?: string;
  sourceRecordId?: string;
  sourceRetrievedAt?: string;
  verification?: 'unverified' | 'reviewed';
  allergensKnown?: boolean;
  revision?: number;
}
export interface Quest {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  region: RegionId;
  area?: string;
  time: TimeSlot;
  timeLabel: string;
  stops: Vendor[];
  stopCount: number;
  budget: number;
  duration: number;
  distance: number;
  image: string;
  label: string;
  color?: string;
  difficulty: string;
  vendorIds?: string[];
  dataType?: string;
}
export interface MapCandidate {
  id: string;
  name: string;
  dish: string;
  category: string;
  region: RegionId;
  area: string;
  ward: string;
  lat: number;
  lng: number;
  sourceUrl: string;
  mapUrl: string;
}
export interface WardRoute {
  id: string;
  revision: number;
  title: string;
  ward: string;
  stops: MapCandidate[];
  stopCount: number;
  distance: number;
  duration: number;
  label: string;
}
export interface Catalog {
  regions: { id: RegionId; name: string; subtitle: string; center: [number, number] }[];
  allergens: { id: string; name: string; en: string }[];
  vendors: Vendor[];
  mapCandidates: MapCandidate[];
  wards: string[];
  quests: Quest[];
  aiConfigured: boolean;
  dataMode: string;
}
export interface Stamp {
  id: number;
  vendorId: string;
  mode: 'demo' | 'ai-observed';
  createdAt: string;
  vendor: Vendor;
  purchaseVerified: false;
}
export interface Passport {
  stamps: Stamp[];
  totalVendors: number;
}
export interface ScanResult {
  matched: boolean;
  reason?:
    | 'different-dish'
    | 'uncertain'
    | 'out-of-catalog'
    | 'unsupported-dish'
    | 'poor-image'
    | 'not-food';
  mode: 'demo' | 'ai-observed';
  vendor?: Vendor;
  observation?: { dishName: string; explanation: string; confidence: number };
  message: string;
  newStamp?: boolean;
}
