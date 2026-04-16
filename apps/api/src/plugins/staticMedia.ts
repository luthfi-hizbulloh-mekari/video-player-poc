import fastifyStatic from '@fastify/static';
import type { FastifyPluginAsync } from 'fastify';

import { mediaOutputRoot } from '../domain/mediaFixtures.js';

export const staticMediaPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyStatic, {
    root: mediaOutputRoot,
    prefix: '/media/',
    decorateReply: false,
    setHeaders(response, filePath) {
      if (filePath.endsWith('.m3u8')) {
        response.setHeader('content-type', 'application/vnd.apple.mpegurl');
      }

      if (filePath.endsWith('.ts')) {
        response.setHeader('content-type', 'video/mp2t');
      }

      if (filePath.endsWith('.m4s')) {
        response.setHeader('content-type', 'video/iso.segment');
      }
    }
  });
};
