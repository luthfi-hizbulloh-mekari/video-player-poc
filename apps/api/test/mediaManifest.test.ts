import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { mediaOutputRoot } from '../src/domain/mediaFixtures.js';

let app: Awaited<ReturnType<typeof buildApp>>;

async function seedMediaFixtures() {
  await mkdir(resolve(mediaOutputRoot, 'mp4'), { recursive: true });
  await mkdir(resolve(mediaOutputRoot, 'hls/sample'), { recursive: true });
  await writeFile(resolve(mediaOutputRoot, 'mp4/sample.mp4'), Buffer.from('0123456789'));
  await writeFile(
    resolve(mediaOutputRoot, 'hls/sample/master.m3u8'),
    '#EXTM3U\n#EXTINF:2,\nsegment0.ts\n'
  );
  await writeFile(resolve(mediaOutputRoot, 'hls/sample/segment0.ts'), Buffer.from('transport'));
}

beforeEach(async () => {
  await seedMediaFixtures();
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
  await rm(mediaOutputRoot, { recursive: true, force: true });
  await mkdir(resolve(mediaOutputRoot, 'mp4'), { recursive: true });
  await mkdir(resolve(mediaOutputRoot, 'hls'), { recursive: true });
});

describe('media manifest and static media routes', () => {
  it('returns canonical fixture metadata', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/media/manifest'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      fixtures: [
        {
          id: 'sample',
          sources: {
            mp4: {
              url: '/media/mp4/sample.mp4',
              available: true
            },
            hls: {
              url: '/media/hls/sample/master.m3u8',
              available: true
            }
          }
        },
        {
          id: 'youtube-sample',
          sources: {
            youtube: {
              url: 'https://www.youtube.com/watch?v=NOiyDlWl534',
              relativePath: 'NOiyDlWl534',
              available: true
            }
          }
        }
      ]
    });
  });

  it('serves media with route prefixes and HLS content types', async () => {
    const playlistResponse = await app.inject({
      method: 'GET',
      url: '/media/hls/sample/master.m3u8'
    });

    expect(playlistResponse.statusCode).toBe(200);
    expect(playlistResponse.headers['content-type']).toContain('application/vnd.apple.mpegurl');

    const segmentResponse = await app.inject({
      method: 'GET',
      url: '/media/hls/sample/segment0.ts'
    });

    expect(segmentResponse.statusCode).toBe(200);
    expect(segmentResponse.headers['content-type']).toContain('video/mp2t');

    const mp4Response = await app.inject({
      method: 'GET',
      url: '/media/mp4/sample.mp4',
      headers: {
        range: 'bytes=0-4'
      }
    });

    expect(mp4Response.statusCode).toBe(206);
    expect(mp4Response.headers['content-range']).toContain('bytes 0-4/');
  });
});
