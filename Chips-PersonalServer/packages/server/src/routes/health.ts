import type { FastifyPluginAsync } from 'fastify';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/health',
    {
      schema: {
        summary: 'Health check',
        description: 'Returns server health status',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok'] },
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string' },
            },
            required: ['status', 'timestamp', 'version'],
          },
        },
      },
    },
    async (_request, _reply) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env['npm_package_version'] ?? '1.0.0',
      };
    },
  );
};

export default healthRoute;
