// @ts-nocheck

import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Configurator - Custom Types Integration', function() {

  describe('Custom types from multiple sources', function() {

    it('should parse URL type from environment and command line', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('url', new Schema('string', {
        normalizer: (value) => {
          if (typeof value === 'string') {
            return value.trim();
          }
          return value;
        },
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
        .property('apiEndpoint', new Schema('url'))
        .property('webhookUrl', new Schema('url'));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--api-endpoint', 'https://api.example.com/v1'],
        env: {
          'APP_WEBHOOK_URL': 'https://webhooks.example.com/hook'
        }
      });

      assert.strictEqual(config.apiEndpoint, 'https://api.example.com/v1');
      assert.strictEqual(config.webhookUrl, 'https://webhooks.example.com/hook');
    });

    it('should validate custom types from all sources', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('port', new Schema('number', {
        validator: (value) => {
          if (value < 1 || value > 65535) {
            throw new Error(`Port must be between 1 and 65535, got ${value}`);
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('port', new Schema('port'));

      const configurator = new Configurator({ schema, resolver });

      await assert.rejects(
        () => configurator.configure({
          appName: 'app',
          argv: [],
          env: { 'APP_PORT': '99999' }
        }),
        (err) => {
          assert.strictEqual(err.name, 'ValidationError');
          assert.match(err.cause.message, /Port must be between 1 and 65535/);
          return true;
        }
      );
    });
  });

  describe('Complex custom types', function() {

    it('should handle duration type from multiple sources', async function() {
      const resolver = new SchemaResolver();

      // Duration type: accepts "30s", "5m", "2h", "1d" or milliseconds
      resolver.registerSchema('duration', new Schema('any', {
        normalizer: (value) => {
          if (typeof value === 'number') return value;
          if (typeof value === 'string') return value.trim();
          throw new Error('Duration must be number or string');
        },
        transformer: (value) => {
          if (typeof value === 'number') return value;

          const match = /^(\d+)([smhd])$/.exec(value);
          if (!match) {
            throw new Error(`Invalid duration format: ${value}`);
          }

          const [, amount, unit] = match;
          const num = parseInt(amount, 10);

          switch (unit) {
            case 's': return num * 1000;
            case 'm': return num * 60 * 1000;
            case 'h': return num * 60 * 60 * 1000;
            case 'd': return num * 24 * 60 * 60 * 1000;
            default: throw new Error(`Unknown unit: ${unit}`);
          }
        }
      }));

      const schema = new Schema('object')
        .property('timeout', new Schema('duration'))
        .property('retryDelay', new Schema('duration'))
        .property('cacheExpiry', new Schema('duration'));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--timeout', '30s'],
        env: {
          'APP_RETRY_DELAY': '5m',
          'APP_CACHE_EXPIRY': '1h'
        }
      });

      assert.strictEqual(config.timeout, 30000);        // 30 seconds
      assert.strictEqual(config.retryDelay, 300000);    // 5 minutes
      assert.strictEqual(config.cacheExpiry, 3600000);  // 1 hour
    });

    it('should handle email type with normalization and validation', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('email', new Schema('string', {
        normalizer: (value) => {
          if (typeof value === 'string') {
            return value.trim().toLowerCase();
          }
          return value;
        },
        validator: (value) => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error(`Invalid email: ${value}`);
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('adminEmail', new Schema('email'))
        .property('supportEmail', new Schema('email'));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--admin-email', '  Admin@Example.COM  '],
        env: { 'APP_SUPPORT_EMAIL': 'Support@Example.COM' }
      });

      assert.strictEqual(config.adminEmail, 'admin@example.com');
      assert.strictEqual(config.supportEmail, 'support@example.com');
    });
  });

  describe('Custom types with defaults and conditions', function() {

    it('should apply defaults with custom types', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('logLevel', new Schema('string', {
        normalizer: (value) => value.toLowerCase(),
        validator: (value) => {
          const valid = ['debug', 'info', 'warn', 'error'];
          if (!valid.includes(value)) {
            throw new Error(`Log level must be one of: ${valid.join(', ')}`);
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('environment', new Schema('string', { default: 'development' }))
        .property('logLevel', new Schema('logLevel', {
          default: 'info'
        }));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.environment, 'development');
      assert.strictEqual(config.logLevel, 'info');
    });

    it('should use custom types with conditions', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('percentage', new Schema('number', {
        normalizer: (value) => {
          if (typeof value === 'string' && value.endsWith('%')) {
            return parseFloat(value) / 100;
          }
          return typeof value === 'string' ? parseFloat(value) : value;
        },
        validator: (value) => {
          if (value < 0 || value > 1) {
            throw new Error('Percentage must be between 0 and 1');
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('enableSampling', new Schema('boolean'))
        .property('sampleRate', new Schema('percentage', {
          condition: (value, config) => config.enableSampling === true,
          default: 0.1
        }));

      const configurator = new Configurator({ schema, resolver });

      const config1 = await configurator.configure({
        appName: 'app',
        argv: ['--enable-sampling'],
        env: { 'APP_SAMPLE_RATE': '25%' }
      });

      assert.strictEqual(config1.enableSampling, true);
      assert.strictEqual(config1.sampleRate, 0.25);

      const config2 = await configurator.configure({
        appName: 'app',
        argv: [],
        env: { 'APP_SAMPLE_RATE': '50%' }
      });

      // Condition not met, sampleRate suppressed
      assert.strictEqual(config2.enableSampling, undefined);
      assert.strictEqual(config2.sampleRate, undefined);
    });
  });

  describe('Nested custom types', function() {

    it('should handle custom types in nested objects', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('ipAddress', new Schema('string', {
        validator: (value) => {
          const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
          if (!ipv4Regex.test(value)) {
            throw new Error(`Invalid IP address: ${value}`);
          }
          const parts = value.split('.').map(Number);
          if (parts.some(p => p > 255)) {
            throw new Error(`Invalid IP address: ${value}`);
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('host', new Schema('ipAddress'))
          .property('port', new Schema('number'))
        )
        .property('database', new Schema('object')
          .property('host', new Schema('ipAddress'))
          .property('port', new Schema('number'))
        );

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--server-host', '192.168.1.1', '--server-port', '8080'],
        env: {
          'APP_DATABASE_HOST': '10.0.0.5',
          'APP_DATABASE_PORT': '5432'
        }
      });

      assert.strictEqual(config.server.host, '192.168.1.1');
      assert.strictEqual(config.server.port, 8080);
      assert.strictEqual(config.database.host, '10.0.0.5');
      assert.strictEqual(config.database.port, 5432);
    });

    it('should handle custom types in arrays', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('semver', new Schema('string', {
        validator: (value) => {
          if (!/^\d+\.\d+\.\d+$/.test(value)) {
            throw new Error(`Invalid semver: ${value}`);
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('supportedVersions', new Schema('array')
          .property('*', new Schema('semver'))
        );

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--supported-versions', '1.0.0', '1.1.0', '2.0.0'],
        env: {},
        defaults: {}
      });

      assert.deepStrictEqual(config.supportedVersions, ['1.0.0', '1.1.0', '2.0.0']);
    });
  });

  describe('Custom enum-like types', function() {

    it('should create enum type with validation', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('environment', new Schema('string', {
        normalizer: (value) => value.toLowerCase(),
        validator: (value) => {
          const valid = ['development', 'staging', 'production'];
          if (!valid.includes(value)) {
            throw new Error(`Environment must be one of: ${valid.join(', ')}`);
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('env', new Schema('environment'));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--env', 'PRODUCTION'],
        env: {}
      });

      assert.strictEqual(config.env, 'production');

      await assert.rejects(
        () => configurator.configure({
          appName: 'app',
          argv: [],
          env: { 'APP_ENV': 'invalid' }
        }),
        (err) => {
          // @ts-ignore
          assert.strictEqual(err.name, 'ValidationError');
          // @ts-ignore
          assert.match(err.cause?.message, /Environment must be one of/);
          return true;
        }
      );
    });
  });

  describe('Custom types with serialization', function() {

    it('should serialize custom types for dump', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('timestamp', new Schema('any', {
        transformer: (value) => {
          if (typeof value === 'number') return value;
          if (value === 'now') return Date.now();
          if (typeof value === 'string') {
            const t = new Date(value).getTime();
            if (isNaN(t)) throw new Error(`Invalid timestamp: ${value}`);
            return t;
          }
          throw new Error('Invalid timestamp');
        },
        serializer: (value) => {
          return new Date(value).toISOString();
        }
      }));

      const schema = new Schema('object')
        .property('createdAt', new Schema('timestamp'))
        .property('updatedAt', new Schema('timestamp'));

      const configurator = new Configurator({ schema, resolver });

      const compiled = resolver.compile(schema);

      // Transform from string to ms
      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {
          'APP_CREATED_AT': '2024-01-01T00:00:00Z',
          'APP_UPDATED_AT': '2024-12-31T23:59:59Z'
        }
      });

      assert.strictEqual(typeof config.createdAt, 'number');
      assert.strictEqual(typeof config.updatedAt, 'number');

      // Serialize back to ISO string
      const serialized = await compiled.serialize(config);

      assert.strictEqual(serialized.createdAt, '2024-01-01T00:00:00.000Z');
      assert.strictEqual(serialized.updatedAt, '2024-12-31T23:59:59.000Z');
    });
  });

  describe('Real-world custom type scenarios', function() {

    it('should handle connection string type', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('connectionString', new Schema('string', {
        validator: (value) => {
          // Validate basic connection string format
          if (!value.includes('://')) {
            throw new Error('Connection string must include protocol (://)');
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('database', new Schema('connectionString'));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {
          'APP_DATABASE': 'postgresql://user:pass@localhost:5432/mydb'
        }
      });

      assert.strictEqual(config.database, 'postgresql://user:pass@localhost:5432/mydb');
    });

    it('should handle file path type with validation', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('filePath', new Schema('string', {
        normalizer: (value) => {
          // Normalize path separators
          return value.replace(/\\/g, '/');
        },
        validator: (value) => {
          // Basic path validation
          if (value.includes('..')) {
            throw new Error('Path cannot contain ..');
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('configFile', new Schema('filePath'))
        .property('dataDir', new Schema('filePath'));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--config-file', '/etc/app/config.json'],
        env: { 'APP_DATA_DIR': '/var/lib/app/data' }
      });

      assert.strictEqual(config.configFile, '/etc/app/config.json');
      assert.strictEqual(config.dataDir, '/var/lib/app/data');
    });

    it('should handle multiple independent custom types together', async function() {
      const resolver = new SchemaResolver();

      // Register multiple custom types
      resolver.registerSchema('url', new Schema('string', {
        validator: (v) => {
          new URL(v); // Throws if invalid
          return v;
        }
      }));

      resolver.registerSchema('email', new Schema('string', {
        normalizer: (v) => v.trim().toLowerCase(),
        validator: (v) => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
            throw new Error(`Invalid email: ${v}`);
          }
          return v;
        }
      }));

      resolver.registerSchema('port', new Schema('number', {
        validator: (v) => {
          if (v < 1 || v > 65535) {
            throw new Error(`Invalid port: ${v}`);
          }
          return v;
        }
      }));

      const schema = new Schema('object')
        .property('apiUrl', new Schema('url'))
        .property('contactEmail', new Schema('email'))
        .property('port', new Schema('port'));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--api-url', 'https://api.example.com', '--port', '3000'],
        env: { 'APP_CONTACT_EMAIL': '  Admin@Example.COM  ' }
      });

      assert.strictEqual(config.apiUrl, 'https://api.example.com');
      assert.strictEqual(config.contactEmail, 'admin@example.com');
      assert.strictEqual(config.port, 3000);
    });
  });
});
