import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
export const mediaOutputRoot = resolve(projectRoot, 'media/output');

type FixtureSource = {
  url: string;
  relativePath: string;
  available: boolean;
};

type MediaFixture = {
  id: string;
  label: string;
  description: string;
  sources: {
    mp4?: FixtureSource;
    hls?: FixtureSource;
    youtube?: FixtureSource;
  };
};

const fixtureSpecs = [
  {
    id: 'sample',
    label: 'Sample clip',
    description: 'Synthetic fixture generated from scripts/generate-media.sh.',
    mp4RelativePath: 'mp4/sample.mp4',
    hlsRelativePath: 'hls/sample/master.m3u8'
  },
  {
    id: 'youtube-sample',
    label: 'YouTube sample (NOiyDlWl534)',
    description: 'Remote YouTube source - playable in Plyr lane only.',
    youtubeVideoId: 'NOiyDlWl534'
  }
] as const;

export function getMediaFixtures(): MediaFixture[] {
  return fixtureSpecs.map((fixture) => {
    const sources: MediaFixture['sources'] = {};

    if ('mp4RelativePath' in fixture) {
      sources.mp4 = {
        url: `/media/${fixture.mp4RelativePath}`,
        relativePath: fixture.mp4RelativePath,
        available: existsSync(resolve(mediaOutputRoot, fixture.mp4RelativePath))
      };
    }

    if ('hlsRelativePath' in fixture) {
      sources.hls = {
        url: `/media/${fixture.hlsRelativePath}`,
        relativePath: fixture.hlsRelativePath,
        available: existsSync(resolve(mediaOutputRoot, fixture.hlsRelativePath))
      };
    }

    if ('youtubeVideoId' in fixture) {
      sources.youtube = {
        url: `https://www.youtube.com/watch?v=${fixture.youtubeVideoId}`,
        relativePath: fixture.youtubeVideoId,
        available: true
      };
    }

    return {
      id: fixture.id,
      label: fixture.label,
      description: fixture.description,
      sources
    };
  });
}
