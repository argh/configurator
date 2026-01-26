
import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ConfigurationSource, ObjectSource, EnvironmentSource, CommandLineSource } from '../src/configuration-sources/index.js';

describe('Configurator - Transforms Integration', function() {

  describe('Basic transformers with multiple sources', function() {

    it('should transform string to uppercase from any source', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string', {
          transformer: (value) => value.toUpperCase()
        }));

      const configurator = new Configurator({ schema });

      const config1 = await configurator.configure({
        appName: 'app',
        argv: ['--name', 'alice'],
        env: {}
      });

      assert.strictEqual(config1.name, 'ALICE');

      const config2 = await configurator.configure({
        appName: 'app',
        argv: [],
        env: { 'APP_NAME': 'bob' }
      });

      assert.strictEqual(config2.name, 'BOB');
    });

    it('should apply transformers to values from different sources', async function() {
      const schema = new Schema('object')
        .property('port', new Schema('number', {
          transformer: (value) => {
            // Ensure port is in valid range
            if (value < 1024) return 8000 + value;
            return value;
          }
        }))
        .property('timeout', new Schema('number', {
          transformer: (value) => value * 1000  // Convert seconds to milliseconds
        }));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--port', '80'],  // CLI provides low port
        env: {
          'APP_TIMEOUT': '30'     // Env provides timeout in seconds
        }
      });

      assert.strictEqual(config.port, 8080);     // Transformed: 8000 + 80
      assert.strictEqual(config.timeout, 30000); // Transformed: 30 * 1000
    });

    it('should apply transformers after source priority resolution', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string', {
          transformer: (value) => `transformed:${value}`
        }));

      const configurator = new Configurator({ schema });

      // CLI (600) < config file (900) due to runtime mutability
      const config = await configurator.configure({
        appName: 'app',
        argv: ['--value', 'from-cli'],
        env: { 'APP_VALUE': 'from-env' },
        defaults: { value: 'from-defaults' }
      });

      // Env (400) < CLI (600), so CLI wins and gets transformed
      assert.strictEqual(config.value, 'transformed:from-cli');
    });
  });

  describe('Custom type transformers', function() {

    it('should transform timestamp strings to milliseconds', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('timestamp', new Schema('any', {
        transformer: (value) => {
          if (typeof value === 'number') {
            return value;
          }
          else if (value === 'now') {
            return Date.now();
          }
          else if (typeof value === 'string') {
            const t = new Date(value).getTime();
            if (isNaN(t)) {
              throw new Error(`Invalid timestamp: ${value}`);
            }
            return t;
          }
          throw new Error(`Invalid timestamp type: ${typeof value}`);
        }
      }));

      const schema = new Schema('object')
        .property('createdAt', new Schema('timestamp'))
        .property('updatedAt', new Schema('timestamp'));

      const configurator = new Configurator({ schema, resolver });

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
      assert.strictEqual(config.createdAt, new Date('2024-01-01T00:00:00Z').getTime());
      assert.strictEqual(config.updatedAt, new Date('2024-12-31T23:59:59Z').getTime());
    });

    it('should transform class name strings to instances', async function() {
      class Logger { constructor() { this.type = 'base'; } }
      class ConsoleLogger extends Logger { constructor() { super(); this.type = 'console'; } }
      class FileLogger extends Logger { constructor() { super(); this.type = 'file'; } }

      const loggers = new Map([
        ['console', ConsoleLogger],
        ['file', FileLogger]
      ]);

      const resolver = new SchemaResolver();

      resolver.registerSchema('Logger', new Schema('any', {
        transformer: (value) => {
          if (value instanceof Logger) {
            return value;
          }
          if (typeof value === 'string') {
            const LoggerClass = loggers.get(value.toLowerCase());
            if (!LoggerClass) {
              throw new Error(`Unknown logger type: ${value}`);
            }
            return new LoggerClass();
          }
          throw new Error('Invalid logger value');
        },
        validator: (value) => {
          if (!(value instanceof Logger)) {
            throw new Error('Must be a Logger instance');
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('logger', new Schema('Logger'));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--logger', 'console'],
        env: {}
      });

      assert.ok(config.logger instanceof Logger);
      assert.ok(config.logger instanceof ConsoleLogger);
      assert.strictEqual(config.logger.type, 'console');
    });
  });

  describe('Transformers with lazy evaluation', function() {

    it('should support transformers that depend on other config values', async function() {
      // Note: Transformers are only called when there's an assignment.
      // For lazy evaluation that builds computed values, use a source that provides
      // the assignment with a lazy function.

      class ComputedUrlSource extends ConfigurationSource {
        constructor() {
          super({ name: 'computed', sequence: 250 });
        }

        async load() {
          const assignments = new Map();
          // Provide lazy function as assignment value
          assignments.set('url', (currentValue, config) => {
            if (!config?.host || !config?.port) {
              return undefined; // Retry later
            }
            return `http://${config.host}:${config.port}`;
          });
          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('host', new Schema('string'))
        .property('port', new Schema('number'))
        .property('url', new Schema('string'));

      const sources = [
        new ComputedUrlSource(),
        new EnvironmentSource(),
        new CommandLineSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--port', '8080'],
        env: { 'APP_HOST': 'localhost' }
      });

      assert.strictEqual(config.host, 'localhost');
      assert.strictEqual(config.port, 8080);
      assert.strictEqual(config.url, 'http://localhost:8080');
    });

    it('should handle async transformers', async function() {
      // Like above, use a source to provide async lazy function
      class AsyncProfileSource extends ConfigurationSource {
        constructor() {
          super({ name: 'async-profile', sequence: 250 });
        }

        async load() {
          const assignments = new Map();
          assignments.set('userProfile', async (currentValue, config) => {
            if (!config?.userId) {
              return undefined; // Wait for userId
            }

            // Simulate async lookup
            await new Promise(resolve => setTimeout(resolve, 1));

            return {
              id: config.userId,
              name: `User ${config.userId}`,
              role: 'user'
            };
          });
          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('userId', new Schema('string'))
        .property('userProfile', new Schema('any'));

      const sources = [
        new AsyncProfileSource(),
        new EnvironmentSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: { 'APP_USER_ID': 'user123' }
      });

      assert.strictEqual(config.userId, 'user123');
      assert.deepStrictEqual(config.userProfile, {
        id: 'user123',
        name: 'User user123',
        role: 'user'
      });
    });
  });

  describe('Transformers with normalizers', function() {

    it('should apply normalizer before transformer', async function() {
      const resolver = new SchemaResolver();

      resolver.registerSchema('email', new Schema('string', {
        normalizer: (value) => {
          // Normalize: trim whitespace and lowercase
          if (typeof value === 'string') {
            return value.trim().toLowerCase();
          }
          return value;
        },
        transformer: (value) => {
          // Transform: validate email format
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error(`Invalid email format: ${value}`);
          }
          return value;
        }
      }));

      const schema = new Schema('object')
        .property('email', new Schema('email'))
        .property('backupEmail', new Schema('email'));

      const configurator = new Configurator({ schema, resolver });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--email', '  Alice@Example.COM  '],
        env: { 'APP_BACKUP_EMAIL': ' BOB@test.org ' }
      });

      assert.strictEqual(config.email, 'alice@example.com');
      assert.strictEqual(config.backupEmail, 'bob@test.org');
    });
  });

  describe('Transformers with custom sources', function() {

    it('should transform values from custom sources', async function() {
      class RemoteConfigSource extends ConfigurationSource {
        constructor() {
          super({ name: 'remote-config', sequence: 350 });
        }

        async load() {
          const assignments = new Map();
          // Simulate loading from remote config service
          assignments.set('database.host', 'db-prod-001.internal');
          assignments.set('database.port', '5432');
          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('host', new Schema('string', {
            transformer: (value) => {
              // Normalize internal host names to external DNS
              if (value.endsWith('.internal')) {
                return value.replace('.internal', '.example.com');
              }
              return value;
            }
          }))
          .property('port', new Schema('number'))
        );

      const sources = [
        new RemoteConfigSource(),
        new EnvironmentSource(),
        new CommandLineSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.database.host, 'db-prod-001.example.com');
      assert.strictEqual(config.database.port, 5432);
    });
  });

  describe('Transformers with conditions', function() {

    it('should only transform values when condition is met', async function() {
      const schema = new Schema('object')
        .property('enableEncryption', new Schema('boolean'))
        .property('apiKey', new Schema('string', {
          condition: (value, config) => config?.enableEncryption === true,
          transformer: (value) => {
            // Simulate decryption
            if (value.startsWith('encrypted:')) {
              return value.replace('encrypted:', 'decrypted:');
            }
            return value;
          }
        }));

      const configurator = new Configurator({ schema });

      // With encryption disabled
      const config1 = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {
          'APP_ENABLE_ENCRYPTION': 'false',
          'APP_API_KEY': 'encrypted:secret123'
        }
      });

      assert.strictEqual(config1.enableEncryption, false);
      assert.strictEqual(config1.apiKey, undefined); // Suppressed by condition

      // With encryption enabled
      const config2 = await configurator.configure({
        appName: 'app',
        argv: ['--enable-encryption'],
        env: {
          'APP_API_KEY': 'encrypted:secret123'
        }
      });

      assert.strictEqual(config2.enableEncryption, true);
      assert.strictEqual(config2.apiKey, 'decrypted:secret123'); // Transformed
    });
  });

  describe('Complex transformation scenarios', function() {

    it('should transform individual properties within nested objects', async function() {
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('host', new Schema('string', {
            transformer: (value) => value.toLowerCase()
          }))
          .property('port', new Schema('number', {
            transformer: (value) => {
              if (value < 1024) return 8000 + value;
              return value;
            }
          }))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--server-port', '80'],
        env: { 'APP_SERVER_HOST': 'EXAMPLE.COM' }
      });

      assert.strictEqual(config.server.host, 'example.com');
      assert.strictEqual(config.server.port, 8080);
    });

    it('should transform array elements', async function() {
      const schema = new Schema('object')
        .property('tags', new Schema('array')
          .property('*', new Schema('string', {
            transformer: (value) => value.toLowerCase().trim()
          }))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--tags', 'API', ' WEB ', 'Backend '],
        env: {}
      });

      assert.deepStrictEqual(config.tags, ['api', 'web', 'backend']);
    });

    it('should handle transformation errors gracefully', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('number', {
          transformer: (value) => {
            if (value < 0) {
              throw new Error('Value must be non-negative');
            }
            return value * 2;
          }
        }));

      const configurator = new Configurator({ schema });

      await assert.rejects(
        () => configurator.configure({
          appName: 'app',
          argv: [],  // No CLI value
          env: { 'APP_VALUE': '-5' }  // Env provides negative value
        }),
        {
          name: 'TransformError',
          message: /Unable to transform value/
        }
      );
    });
  });

  describe('Real-world scenario: Connection string builder', function() {

    it('should build database connection string from components using lazy source', async function() {
      // Connection string depends on other properties, so use lazy source
      class ConnectionStringSource extends ConfigurationSource {
        constructor() {
          super({ name: 'connection-string', sequence: 250 });
        }

        async load() {
          const assignments = new Map();
          assignments.set('database.connectionString', (currentValue, config) => {
            const db = config?.database;
            if (!db?.type || !db?.host || !db?.port || !db?.database) {
              return undefined; // Wait for required fields
            }

            const auth = db.username && db.password
              ? `${db.username}:${db.password}@`
              : '';

            switch (db.type) {
              case 'postgres':
                return `postgresql://${auth}${db.host}:${db.port}/${db.database}`;
              case 'mysql':
                return `mysql://${auth}${db.host}:${db.port}/${db.database}`;
              case 'mongodb':
                return `mongodb://${auth}${db.host}:${db.port}/${db.database}`;
              default:
                throw new Error(`Unknown database type: ${db.type}`);
            }
          });
          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('type', new Schema('string', {
            values: ['postgres', 'mysql', 'mongodb']
          }))
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
          .property('username', new Schema('string'))
          .property('password', new Schema('string'))
          .property('database', new Schema('string'))
          .property('connectionString', new Schema('string'))
        );

      const sources = [
        new ConnectionStringSource(),
        new EnvironmentSource(),
        new CommandLineSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--database-type', 'postgres'],
        env: {
          'APP_DATABASE_HOST': 'db.example.com',
          'APP_DATABASE_PORT': '5432',
          'APP_DATABASE_USERNAME': 'admin',
          'APP_DATABASE_PASSWORD': 'secret',
          'APP_DATABASE_DATABASE': 'myapp'
        }
      });

      assert.strictEqual(
        config.database.connectionString,
        'postgresql://admin:secret@db.example.com:5432/myapp'
      );
    });

    it('should transform configuration paths to absolute paths', async function() {
      const schema = new Schema('object')
        .property('baseDir', new Schema('string', { default: '/app' }))
        .property('logFile', new Schema('string', {
          transformer: (value, config) => {
            if (!value) return undefined;
            if (value.startsWith('/')) return value; // Already absolute

            if (!config.baseDir) {
              return undefined; // Wait for baseDir
            }

            return `${config.baseDir}/${value}`;
          }
        }))
        .property('dataDir', new Schema('string', {
          transformer: (value, config) => {
            if (!value) return undefined;
            if (value.startsWith('/')) return value;

            if (!config.baseDir) {
              return undefined;
            }

            return `${config.baseDir}/${value}`;
          }
        }));

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--base-dir', '/var/myapp'],
        env: {
          'APP_LOG_FILE': 'logs/app.log',
          'APP_DATA_DIR': 'data'
        }
      });

      assert.strictEqual(config.baseDir, '/var/myapp');
      assert.strictEqual(config.logFile, '/var/myapp/logs/app.log');
      assert.strictEqual(config.dataDir, '/var/myapp/data');
    });
  });
});
