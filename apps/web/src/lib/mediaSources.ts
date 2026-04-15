import type { DeliveryType } from 'shared';

export type ManifestSource = {
  url: string;
  relativePath: string;
  available: boolean;
};

export type MediaFixture = {
  id: string;
  label: string;
  description: string;
  sources: {
    mp4?: ManifestSource;
    hls?: ManifestSource;
    youtube?: ManifestSource;
  };
};

export type MediaSourceDefinition = {
  mediaId: string;
  label: string;
  description: string;
  deliveryType: DeliveryType;
  url: string;
  relativePath: string;
  available: boolean;
};

export type MediaManifestResponse = {
  fixtures: MediaFixture[];
  generatedAt: string;
};

const deliveryTypeOrder: DeliveryType[] = ['mp4', 'hls', 'youtube'];

export async function fetchMediaManifest(): Promise<MediaManifestResponse> {
  const response = await fetch('/api/media/manifest');

  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.status}`);
  }

  return response.json();
}

export function getSourceForDelivery(
  fixture: MediaFixture,
  deliveryType: DeliveryType
): MediaSourceDefinition | null {
  const source = fixture.sources[deliveryType];

  if (!source) {
    return null;
  }

  return {
    mediaId: fixture.id,
    label: fixture.label,
    description: fixture.description,
    deliveryType,
    url: source.url,
    relativePath: source.relativePath,
    available: source.available
  };
}

export function getAvailableDeliveryTypes(fixture: MediaFixture): DeliveryType[] {
  return deliveryTypeOrder.filter((deliveryType) => fixture.sources[deliveryType]);
}
