import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);
export const mediaOutputRoot = resolve(projectRoot, "media/output");

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
    mux?: FixtureSource;
  };
};

type FixtureSpec = {
  id: string;
  label: string;
  description: string;
  mp4RelativePath?: string;
  hlsRelativePath?: string;
  muxPlaybackId?: string;
};

const fixtureSpecs: FixtureSpec[] = [
  {
    id: "sample",
    label: "Sample clip",
    description: "Synthetic fixture generated from scripts/generate-media.sh.",
    mp4RelativePath: "mp4/sample.mp4",
    hlsRelativePath: "hls/sample/master.m3u8",
    muxPlaybackId: "wZuyI8vwgDB9dkKmx1OpO574uA7YJO7NA3A8Mz66lZU",
  },
];

export function getMediaFixtures(): MediaFixture[] {
  return fixtureSpecs.map((fixture) => {
    const sources: MediaFixture["sources"] = {};

    if (fixture.mp4RelativePath) {
      sources.mp4 = {
        url: `/media/${fixture.mp4RelativePath}`,
        relativePath: fixture.mp4RelativePath,
        available: existsSync(
          resolve(mediaOutputRoot, fixture.mp4RelativePath),
        ),
      };
    }

    if (fixture.hlsRelativePath) {
      sources.hls = {
        url: `/media/${fixture.hlsRelativePath}`,
        relativePath: fixture.hlsRelativePath,
        available: existsSync(
          resolve(mediaOutputRoot, fixture.hlsRelativePath),
        ),
      };
    }

    if (fixture.muxPlaybackId) {
      sources.mux = {
        url: `https://stream.mux.com/${fixture.muxPlaybackId}.m3u8`,
        relativePath: fixture.muxPlaybackId,
        available: true,
      };
    }

    return {
      id: fixture.id,
      label: fixture.label,
      description: fixture.description,
      sources,
    };
  });
}
