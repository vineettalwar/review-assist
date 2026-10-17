export type Voice = "warm" | "professional" | "casual" | "brief";
export type Polarity = "pos" | "neg" | "both";
export type MemKind = "fact" | "style" | "avoid";
export type PortalType = "google" | "trustpilot" | "amazon" | "yelp" | "facebook" | "g2" | "custom";

export interface DraftMemory { key: string; kind: MemKind; text: string; checked: boolean }
export interface DraftHighlight { label: string; polarity: Polarity }
export interface DraftProduct {
  key: string;
  name: string;
  category: string;
  url: string;
  knowledge: string;
  avoid: string;
  // Product context from the page scan; edited later on the product page.
  audience?: string;
  experience?: string;
  praise?: string;
  concerns?: string;
  highlights: DraftHighlight[];
  memories: DraftMemory[];
}
export interface DraftPortal { key: string; type: PortalType; label: string; url: string }
export interface DraftBrand {
  name: string;
  website: string;
  about: string;
  voice: Voice;
  voiceNotes: string;
  wordsToAvoid: string;
  defaultLanguage: string;
}

export interface SavePayload {
  brandId?: string; // set once saved; a repeat call never duplicates
  brand: DraftBrand;
  brandMemories: { kind: MemKind; text: string }[];
  products: (Omit<DraftProduct, "memories"> & { memories: { kind: MemKind; text: string }[] })[];
  portals: { type: PortalType; label: string; url: string }[];
}

export interface SavedProduct {
  key: string;
  id: string;
  name: string;
  highlights: { id: string; label: string; polarity: Polarity }[];
}
