import swaggerAutogen from 'swagger-autogen';

const doc = {
  info: { title: 'Review Kantin API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:3000' }],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      description: 'Masukkan token dengan format: Bearer <token>',
    },
  },
  definitions: {
    StallInput: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Warung Baru' },
        category: { type: 'string', example: 'Nasi' },
        location: { type: 'string', example: 'Kantin FK' },
        description: { type: 'string' },
      },
    },
  },
};

const outputFile = './backend/docs/swagger-output.json';
const endpointsFiles = ['./backend/index.ts'];

swaggerAutogen()(outputFile, endpointsFiles, doc);