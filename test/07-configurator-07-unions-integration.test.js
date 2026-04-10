
import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { Schema, SchemaResolver } from '@versionzero/schema';

describe('Configurator - Unions Integration', function() {

  describe('Array of union objects (primary use case)', function() {

    it('should handle array of operation unions from defaults', async function() {
      const schema = new Schema('object')
        .property('operations', new Schema('array')
          .property('*', new Schema('object')
            .unionSchema('seek', new Schema('object')
              .property('type', new Schema('string').values(['seek']))
              .property('x', new Schema('number'))
              .property('y', new Schema('number'))
            )
            .unionSchema('punch', new Schema('object')
              .property('type', new Schema('string').values(['punch']))
              .property('count', new Schema('number', { default: 1 }))
            )
            .unionSchema('read', new Schema('object')
              .property('type', new Schema('string').values(['read']))
              .property('length', new Schema('number', { default: 1 }))
            )
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          operations: [
            { type: 'seek', x: 10, y: 20 },
            { type: 'punch', count: 3 },
            { type: 'read', length: 100 },
            { type: 'seek', x: 0, y: 0 }
          ]
        },
        env: {},
        argv: []
      });

      assert.strictEqual(config.operations.length, 4);

      assert.strictEqual(config.operations[0].type, 'seek');
      assert.strictEqual(config.operations[0].x, 10);
      assert.strictEqual(config.operations[0].y, 20);
      assert.strictEqual(config.operations[0].count, undefined);

      assert.strictEqual(config.operations[1].type, 'punch');
      assert.strictEqual(config.operations[1].count, 3);
      assert.strictEqual(config.operations[1].x, undefined);

      assert.strictEqual(config.operations[2].type, 'read');
      assert.strictEqual(config.operations[2].length, 100);

      assert.strictEqual(config.operations[3].type, 'seek');
      assert.strictEqual(config.operations[3].x, 0);
      assert.strictEqual(config.operations[3].y, 0);
    });

    it('should handle array of endpoint unions with different configurations', async function() {
      const schema = new Schema('object')
        .property('endpoints', new Schema('array')
          .property('*', new Schema('object')
            .unionSchema('http', new Schema('object')
              .property('protocol', new Schema('string').values(['http']))
              .property('url', new Schema('string'))
              .property('timeout', new Schema('number', { default: 30000 }))
            )
            .unionSchema('grpc', new Schema('object')
              .property('protocol', new Schema('string').values(['grpc']))
              .property('host', new Schema('string'))
              .property('port', new Schema('number'))
              .property('useTls', new Schema('boolean', { default: true }))
            )
            .unionSchema('graphql', new Schema('object')
              .property('protocol', new Schema('string').values(['graphql']))
              .property('endpoint', new Schema('string'))
              .property('subscriptions', new Schema('boolean', { default: false }))
            )
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          endpoints: [
            { protocol: 'http', url: 'https://api.example.com/rest' },
            { protocol: 'grpc', host: 'grpc.example.com', port: 50051, useTls: false },
            { protocol: 'graphql', endpoint: 'https://api.example.com/graphql', subscriptions: true }
          ]
        },
        env: {},
        argv: []
      });

      assert.strictEqual(config.endpoints.length, 3);

      // HTTP endpoint
      assert.strictEqual(config.endpoints[0].protocol, 'http');
      assert.strictEqual(config.endpoints[0].url, 'https://api.example.com/rest');
      assert.strictEqual(config.endpoints[0].timeout, 30000);
      assert.strictEqual(config.endpoints[0].host, undefined);

      // gRPC endpoint
      assert.strictEqual(config.endpoints[1].protocol, 'grpc');
      assert.strictEqual(config.endpoints[1].host, 'grpc.example.com');
      assert.strictEqual(config.endpoints[1].port, 50051);
      assert.strictEqual(config.endpoints[1].useTls, false);
      assert.strictEqual(config.endpoints[1].url, undefined);

      // GraphQL endpoint
      assert.strictEqual(config.endpoints[2].protocol, 'graphql');
      assert.strictEqual(config.endpoints[2].endpoint, 'https://api.example.com/graphql');
      assert.strictEqual(config.endpoints[2].subscriptions, true);
      assert.strictEqual(config.endpoints[2].host, undefined);
    });
  });

  describe('Hoisted discriminator properties', function() {

    it('should hoist common discriminator property to array element schema', async function() {
      const schema = new Schema('object')
        .property('tasks', new Schema('array')
          .property('*', new Schema('object')
            .unionSchema('build', new Schema('object')
              .property('action', new Schema('string').values(['build']))
              .property('target', new Schema('string'))
            )
            .unionSchema('test', new Schema('object')
              .property('action', new Schema('string').values(['test']))
              .property('suite', new Schema('string'))
            )
            .unionSchema('deploy', new Schema('object')
              .property('action', new Schema('string').values(['deploy']))
              .property('environment', new Schema('string'))
            )
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          tasks: [
            { action: 'build', target: 'production' },
            { action: 'test', suite: 'unit' },
            { action: 'deploy', environment: 'staging' }
          ]
        },
        env: {},
        argv: []
      });

      assert.strictEqual(config.tasks.length, 3);
      assert.strictEqual(config.tasks[0].action, 'build');
      assert.strictEqual(config.tasks[0].target, 'production');
      assert.strictEqual(config.tasks[1].action, 'test');
      assert.strictEqual(config.tasks[1].suite, 'unit');
      assert.strictEqual(config.tasks[2].action, 'deploy');
      assert.strictEqual(config.tasks[2].environment, 'staging');
    });

    it('should support hoisted discriminator property from CLI', async function() {
      // Single top-level union showing hoisted 'type' property works with CLI
      const schema = new Schema('object')
        .property('cache', new Schema('object')
          .unionSchema('memory', new Schema('object')
            .property('type', new Schema('string').values(['memory']))
            .property('maxSize', new Schema('number', { default: 1000 }))
          )
          .unionSchema('redis', new Schema('object')
            .property('type', new Schema('string').values(['redis']))
            .property('host', new Schema('string', { default: 'localhost' }))
            .property('port', new Schema('number', { default: 6379 }))
          )
        );

      const configurator = new Configurator({ schema });

      // Hoisted 'type' property accessible via CLI
      const config = await configurator.configure({
        appName: 'app',
        argv: ['--cache-type', 'redis'],
        env: {},
        defaults: {}
      });

      // Type from CLI, other properties from schema defaults
      assert.strictEqual(config.cache.type, 'redis');
      assert.strictEqual(config.cache.host, 'localhost');
      assert.strictEqual(config.cache.port, 6379);
    });
  });

  describe('Unions with custom types', function() {

    it('should apply custom types to union members in arrays', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('url', new Schema('string', {
        normalizer: (value) => typeof value === 'string' ? value.trim() : value,
        validator: (value) => {
          try {
            new URL(value);
            return value;
          } catch {
            throw new Error(`Invalid URL: ${value}`);
          }
        }
      }));

      const schema = new Schema('object')
        .property('services', new Schema('array')
          .property('*', new Schema('object')
            .unionSchema('rest', new Schema('object')
              .property('type', new Schema('string').values(['rest']))
              .property('baseUrl', new Schema('url'))
            )
            .unionSchema('websocket', new Schema('object')
              .property('type', new Schema('string').values(['websocket']))
              .property('url', new Schema('url'))
              .property('reconnect', new Schema('boolean', { default: true }))
            )
          )
        );

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          services: [
            { type: 'rest', baseUrl: '  https://api.example.com  ' },
            { type: 'websocket', url: '  wss://ws.example.com  ', reconnect: false }
          ]
        },
        env: {},
        argv: []
      });

      assert.strictEqual(config.services.length, 2);
      assert.strictEqual(config.services[0].type, 'rest');
      assert.strictEqual(config.services[0].baseUrl, 'https://api.example.com'); // Trimmed
      assert.strictEqual(config.services[1].type, 'websocket');
      assert.strictEqual(config.services[1].url, 'wss://ws.example.com'); // Trimmed
      assert.strictEqual(config.services[1].reconnect, false);
    });
  });

  describe('Unions with transformers', function() {

    it('should apply transformers to union member properties', async function() {
      const schema = new Schema('object')
        .property('credentials', new Schema('array')
          .property('*', new Schema('object')
            .unionSchema('basic', new Schema('object')
              .property('type', new Schema('string').values(['basic']))
              .property('username', new Schema('string'))
              .property('password', new Schema('string', {
                transformer: (value) => `***${value.slice(-4)}`
              }))
            )
            .unionSchema('token', new Schema('object')
              .property('type', new Schema('string').values(['token']))
              .property('token', new Schema('string', {
                transformer: (value) => `***${value.slice(-8)}`
              }))
            )
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          credentials: [
            { type: 'basic', username: 'admin', password: 'secretpass123' },
            { type: 'token', token: 'abcdefghijklmnop' }
          ]
        },
        env: {},
        argv: []
      });

      assert.strictEqual(config.credentials.length, 2);
      assert.strictEqual(config.credentials[0].type, 'basic');
      assert.strictEqual(config.credentials[0].username, 'admin');
      assert.strictEqual(config.credentials[0].password, '***s123'); // Transformed
      assert.strictEqual(config.credentials[1].type, 'token');
      assert.strictEqual(config.credentials[1].token, '***ijklmnop'); // Transformed
    });
  });

  describe('Nested unions', function() {

    it('should handle unions with common properties across members', async function() {
      // Simpler nested pattern - array of notifications with different channel types
      const schema = new Schema('object')
        .property('notifications', new Schema('array')
          .property('*', new Schema('object')
            .unionSchema('email', new Schema('object')
              .property('type', new Schema('string').values(['email']))
              .property('to', new Schema('string'))
              .property('subject', new Schema('string'))
            )
            .unionSchema('sms', new Schema('object')
              .property('type', new Schema('string').values(['sms']))
              .property('to', new Schema('string'))
              .property('message', new Schema('string'))
            )
            .unionSchema('push', new Schema('object')
              .property('type', new Schema('string').values(['push']))
              .property('deviceId', new Schema('string'))
              .property('title', new Schema('string'))
            )
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          notifications: [
            { type: 'email', to: 'user@example.com', subject: 'Hello' },
            { type: 'sms', to: '+1234567890', message: 'Hi there' },
            { type: 'push', deviceId: 'device-123', title: 'Notification' }
          ]
        },
        env: {},
        argv: []
      });

      assert.strictEqual(config.notifications.length, 3);

      // Email
      assert.strictEqual(config.notifications[0].type, 'email');
      assert.strictEqual(config.notifications[0].to, 'user@example.com');
      assert.strictEqual(config.notifications[0].subject, 'Hello');
      assert.strictEqual(config.notifications[0].message, undefined);

      // SMS
      assert.strictEqual(config.notifications[1].type, 'sms');
      assert.strictEqual(config.notifications[1].to, '+1234567890');
      assert.strictEqual(config.notifications[1].message, 'Hi there');
      assert.strictEqual(config.notifications[1].subject, undefined);

      // Push
      assert.strictEqual(config.notifications[2].type, 'push');
      assert.strictEqual(config.notifications[2].deviceId, 'device-123');
      assert.strictEqual(config.notifications[2].title, 'Notification');
      assert.strictEqual(config.notifications[2].to, undefined);
    });
  });

  describe('Priority of defaults vs overrides', function() {

    it('should merge array elements via assignment explosion', async function() {
      const schema = new Schema('object')
        .property('servers', new Schema('array')
          .property('*', new Schema('object')
            .unionSchema('http', new Schema('object')
              .property('protocol', new Schema('string').values(['http']))
              .property('port', new Schema('number', { default: 80 }))
            )
            .unionSchema('https', new Schema('object')
              .property('protocol', new Schema('string').values(['https']))
              .property('port', new Schema('number', { default: 443 }))
              .property('cert', new Schema('string'))
            )
            .unionSchema('grpc', new Schema('object')
              .property('protocol', new Schema('string').values(['grpc']))
              .property('port', new Schema('number'))
            )
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          servers: [
            { protocol: 'http', port: 8080 },
            { protocol: 'https', port: 8443, cert: '/etc/ssl/cert.pem' }
          ]
        },
        overrides: {
          servers: [
            { protocol: 'grpc', port: 9000 }
          ]
        },
        env: {},
        argv: []
      });

      // Array elements are assigned incrementally via "assignment explosion"
      // When array schema has defined children, assignments get exploded to individual paths
      // So we get 2 elements: first overridden by overrides, second from defaults
      assert.strictEqual(config.servers.length, 2);

      // First element: overridden by overrides source
      assert.strictEqual(config.servers[0].protocol, 'grpc');
      assert.strictEqual(config.servers[0].port, 9000);

      // Second element: remains from defaults source
      assert.strictEqual(config.servers[1].protocol, 'https');
      assert.strictEqual(config.servers[1].port, 8443);
      assert.strictEqual(config.servers[1].cert, '/etc/ssl/cert.pem');
    });
  });

  describe('Real-world union patterns', function() {

    it('should handle deployment steps with different actions', async function() {
      const schema = new Schema('object')
        .property('pipeline', new Schema('object')
          .property('steps', new Schema('array')
            .property('*', new Schema('object')
              .unionSchema('script', new Schema('object')
                .property('type', new Schema('string').values(['script']))
                .property('command', new Schema('string'))
                .property('workingDir', new Schema('string', { default: '.' }))
              )
              .unionSchema('docker', new Schema('object')
                .property('type', new Schema('string').values(['docker']))
                .property('image', new Schema('string'))
                .property('command', new Schema('string'))
              )
              .unionSchema('artifact', new Schema('object')
                .property('type', new Schema('string').values(['artifact']))
                .property('path', new Schema('string'))
                .property('name', new Schema('string'))
              )
            )
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          pipeline: {
            steps: [
              { type: 'script', command: 'npm install' },
              { type: 'script', command: 'npm test', workingDir: './tests' },
              { type: 'docker', image: 'node:18', command: 'npm run build' },
              { type: 'artifact', path: './dist', name: 'build-output' }
            ]
          }
        },
        env: {},
        argv: []
      });

      assert.strictEqual(config.pipeline.steps.length, 4);

      assert.strictEqual(config.pipeline.steps[0].type, 'script');
      assert.strictEqual(config.pipeline.steps[0].command, 'npm install');
      assert.strictEqual(config.pipeline.steps[0].workingDir, '.');

      assert.strictEqual(config.pipeline.steps[1].type, 'script');
      assert.strictEqual(config.pipeline.steps[1].command, 'npm test');
      assert.strictEqual(config.pipeline.steps[1].workingDir, './tests');

      assert.strictEqual(config.pipeline.steps[2].type, 'docker');
      assert.strictEqual(config.pipeline.steps[2].image, 'node:18');
      assert.strictEqual(config.pipeline.steps[2].command, 'npm run build');

      assert.strictEqual(config.pipeline.steps[3].type, 'artifact');
      assert.strictEqual(config.pipeline.steps[3].path, './dist');
      assert.strictEqual(config.pipeline.steps[3].name, 'build-output');
    });
  });
});
