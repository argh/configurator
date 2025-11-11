
import { strict as assert } from 'assert';
import { setTimeout } from 'node:timers/promises';
import { Configurator } from '../src/configurator.js';
import { Schema } from '../src/schema/schema.js';
import { ConfigurationSource, SchemaDefaultsSource, EnvironmentSource, CommandLineSource } from '../src/configuration-sources/index.js';
import { toConstantCase } from '../src/utils.js';

describe('Configurator - Custom Sources', function() {

  describe('Basic custom source', function() {

    it('should register and use a simple custom source', async function() {
      class SimpleSource extends ConfigurationSource {
        constructor() {
          super({ name: 'simple-source', sequence: 350 });
        }

        async load(schema, context) {
          const assignments = new Map();
          assignments.set('custom', 'from-custom-source');
          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('custom', new Schema('string'));

      const sources = [
        new SchemaDefaultsSource(),
        new SimpleSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.custom, 'from-custom-source');
    });

    it('should respect custom source sequence number', async function() {
      class LowPrioritySource extends ConfigurationSource {
        constructor() {
          super({ name: 'low-priority', sequence: 200 });
        }
        async load() {
          return new Map([['value', 'low']]);
        }
      }

      class HighPrioritySource extends ConfigurationSource {
        constructor() {
          super({ name: 'high-priority', sequence: 800 });
        }
        async load() {
          return new Map([['value', 'high']]);
        }
      }

      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const sources = [
        new SchemaDefaultsSource(),
        new LowPrioritySource(),
        new HighPrioritySource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      // High priority (800) should win
      assert.strictEqual(config.value, 'high');
    });
  });

  describe('Using visitSchema', function() {

    it('should use visitSchema to find properties with metadata', async function() {
      class MetadataSource extends ConfigurationSource {
        constructor() {
          super({ name: 'metadata-source', sequence: 350 });
        }

        async load(schema, context) {
          const assignments = new Map();

          schema.visitSchema((schema, path) => {
            if (schema.metadata.customFlag) {
              assignments.set(path, 'marked-by-metadata');
            }
          });

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('regular', new Schema('string'))
        .property('marked', new Schema('string', { _customFlag: true }))
        .property('alsoMarked', new Schema('string', { _customFlag: true }));

      const sources = [
        new SchemaDefaultsSource(),
        new MetadataSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.regular, undefined);
      assert.strictEqual(config.marked, 'marked-by-metadata');
      assert.strictEqual(config.alsoMarked, 'marked-by-metadata');
    });

    it('should use visitSchema to process nested properties', async function() {
      class NestedMetadataSource extends ConfigurationSource {
        constructor() {
          super({ name: 'nested-metadata', sequence: 350 });
        }

        async load(schema, context) {
          const assignments = new Map();

          schema.visitSchema((schema, path) => {
            if (schema.metadata.secret) {
              assignments.set(path, `secret-value-for-${path}`);
            }
          });

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('name', new Schema('string'))
          .property('password', new Schema('string', { _secret: true }))
        )
        .property('apiKey', new Schema('string', { _secret: true }));

      const sources = [
        new SchemaDefaultsSource(),
        new NestedMetadataSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.user.password, 'secret-value-for-user.password');
      assert.strictEqual(config.apiKey, 'secret-value-for-apiKey');
    });
  });

  describe('Lazy value resolution', function() {

    it('should support function assignments for lazy evaluation', async function() {
      class LazySource extends ConfigurationSource {
        constructor() {
          super({ name: 'lazy-source', sequence: 350 });
        }

        async load(schema, context) {
          const assignments = new Map();

          // Set a lazy value that will be resolved later
          assignments.set('lazy', async () => {
            await setTimeout(10);
            return 'computed-value';
          });

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('lazy', new Schema('string'));

      const sources = [
        new SchemaDefaultsSource(),
        new LazySource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.lazy, 'computed-value');
    });

    it('should support lazy values that depend on config state', async function() {
      class DependentLazySource extends ConfigurationSource {
        constructor() {
          super({ name: 'dependent-lazy', sequence: 350 });
        }

        async load(schema, context) {
          const assignments = new Map();

          // This value depends on another property being set first
          assignments.set('dependent', (currentValue, config) => {
            if (typeof config.delay !== 'number') {
              // Return undefined to retry later
              return undefined;
            }
            return `computed-after-${config.delay}ms`;
          });

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('delay', new Schema('number', { default: 100 }))
        .property('dependent', new Schema('string'));

      const sources = [
        new SchemaDefaultsSource(),
        new DependentLazySource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.dependent, 'computed-after-100ms');
    });

    it('should handle lazy values that access configuration context', async function() {
      class ContextAwareLazySource extends ConfigurationSource {
        constructor() {
          super({ name: 'context-aware', sequence: 350 });
        }

        async load(schema, context) {
          const assignments = new Map();

          assignments.set('combined', (currentValue, config) => {
            if (!config?.prefix || !config?.suffix) {
              return undefined;
            }
            return `${config.prefix}-middle-${config.suffix}`;
          });

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('prefix', new Schema('string'))
        .property('suffix', new Schema('string'))
        .property('combined', new Schema('string'));

      const sources = [
        new SchemaDefaultsSource(),
        new ContextAwareLazySource(),
        new EnvironmentSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {
          'APP_PREFIX': 'start',
          'APP_SUFFIX': 'end'
        }
      });

      assert.strictEqual(config.combined, 'start-middle-end');
    });
  });

  describe('FakeSecretsSource pattern', function() {

    it('should implement a secrets source like everything.js', async function() {
      class FakeSecretsSource extends ConfigurationSource {
        constructor() {
          super({ name: 'fake-secrets', sequence: ConfigurationSource.DefaultSequence.SECRETS });
          this.secrets = {
            'APP_USER_TOKEN': 'secret-token-123',
            'APP_API_KEY': 'secret-key-456'
          };
        }

        async load(schema, context) {
          const assignments = new Map();
          const appName = context.appName;
          const appPrefix = toConstantCase(appName || '');

          schema.visitSchema((schema, path) => {
            if (!schema.metadata.secret) {
              return;
            }

            const suffix = toConstantCase(path);
            const secretKey = appPrefix ? `${appPrefix}_${suffix}` : suffix;

            if (this.secrets[secretKey]) {
              assignments.set(path, this.secrets[secretKey]);
            }
          });

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('name', new Schema('string'))
          .property('token', new Schema('string', { _secret: true }))
        )
        .property('apiKey', new Schema('string', { _secret: true }));

      const sources = [
        new SchemaDefaultsSource(),
        new FakeSecretsSource(),
        new EnvironmentSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {
          'APP_USER_NAME': 'alice'
        }
      });

      assert.strictEqual(config.user.name, 'alice');
      assert.strictEqual(config.user.token, 'secret-token-123');
      assert.strictEqual(config.apiKey, 'secret-key-456');
    });

    it('should use lazy resolution for expensive operations', async function() {
      class ExpensiveSecretsSource extends ConfigurationSource {
        constructor() {
          super({ name: 'expensive-secrets', sequence: 350 });  // Lower than defaults
          this.fetchCount = 0;
        }

        async load(schema, context) {
          const assignments = new Map();

          schema.visitSchema((schema, path) => {
            if (!schema.metadata.secret) {
              return;
            }

            // Use lazy function to defer expensive operation
            assignments.set(path, async () => {
              this.fetchCount++;
              await setTimeout(10); // Simulate API call
              return `secret-${path}`;
            });
          });

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('used', new Schema('string', { _secret: true }))
        .property('unused', new Schema('string', { _secret: true }));

      const source = new ExpensiveSecretsSource();
      const sources = [
        new SchemaDefaultsSource(),
        source,
        new EnvironmentSource()  // Env (400) will override secrets (350)
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {
          'APP_UNUSED': 'from-env'  // Override prevents lazy resolution
        }
      });

      assert.strictEqual(config.used, 'secret-used');
      assert.strictEqual(config.unused, 'from-env');

      // Only the 'used' secret should have been fetched (lazy evaluation)
      // The 'unused' was overridden by env, so its lazy function never ran
      assert.strictEqual(source.fetchCount, 1);
    });

    it('should handle lazy values that wait for dependencies', async function() {
      class DependentSecretsSource extends ConfigurationSource {
        constructor() {
          super({ name: 'dependent-secrets', sequence: ConfigurationSource.DefaultSequence.SECRETS });
        }

        async load(schema, context) {
          const assignments = new Map();

          schema.visitSchema((schema, path) => {
            if (!schema.metadata.secret) {
              return;
            }

            // Lazy function that depends on config.delay
            assignments.set(path, async (currentValue, config) => {
              if (typeof config.delay !== 'number') {
                // Can't resolve yet, retry later
                return undefined;
              }
              await setTimeout(config.delay);
              return `secret-after-${config.delay}ms`;
            });
          });

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('delay', new Schema('number', { default: 50 }))
        .property('token', new Schema('string', { _secret: true }));

      const sources = [
        new SchemaDefaultsSource(),
        new DependentSecretsSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.token, 'secret-after-50ms');
    });
  });

  describe('Custom source with context awareness', function() {

    it('should access context properties during load', async function() {
      class ContextSource extends ConfigurationSource {
        constructor() {
          super({ name: 'context-source', sequence: 350 });
        }

        async load(schema, context) {
          const assignments = new Map();

          // Access custom context properties
          if (context.customData) {
            assignments.set('fromContext', context.customData.value);
          }

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('fromContext', new Schema('string'));

      const sources = [
        new SchemaDefaultsSource(),
        new ContextSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        customData: { value: 'custom-value' },
        argv: [],
        env: {}
      });

      assert.strictEqual(config.fromContext, 'custom-value');
    });

    it('should use app name prefix for env var lookups', async function() {
      class PrefixedSecretsSource extends ConfigurationSource {
        constructor() {
          super({ name: 'prefixed-secrets', sequence: 350 });
        }

        async load(schema, context) {
          const assignments = new Map();
          const appPrefix = toConstantCase(context.appName || '');

          schema.visitSchema((schema, path) => {
            if (schema.metadata.fromSecrets) {
              const envKey = appPrefix ? `${appPrefix}_SECRET_${toConstantCase(path)}` : `SECRET_${toConstantCase(path)}`;
              const env = context.env || process.env;

              if (env[envKey]) {
                assignments.set(path, env[envKey]);
              }
            }
          });

          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('apiKey', new Schema('string', { _fromSecrets: true }))
        .property('token', new Schema('string', { _fromSecrets: true }));

      const sources = [
        new SchemaDefaultsSource(),
        new PrefixedSecretsSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'myapp',
        argv: [],
        env: {
          'MYAPP_SECRET_API_KEY': 'key-123',
          'MYAPP_SECRET_TOKEN': 'tok-456'
        }
      });

      assert.strictEqual(config.apiKey, 'key-123');
      assert.strictEqual(config.token, 'tok-456');
    });
  });

  describe('Multiple custom sources interaction', function() {

    it('should handle multiple custom sources with different sequences', async function() {
      class Source1 extends ConfigurationSource {
        constructor() {
          super({ name: 'source1', sequence: 250 });
        }
        async load() {
          return new Map([
            ['a', 'from-source1'],
            ['b', 'from-source1'],
            ['c', 'from-source1']
          ]);
        }
      }

      class Source2 extends ConfigurationSource {
        constructor() {
          super({ name: 'source2', sequence: 450 });
        }
        async load() {
          return new Map([
            ['b', 'from-source2'],
            ['c', 'from-source2']
          ]);
        }
      }

      class Source3 extends ConfigurationSource {
        constructor() {
          super({ name: 'source3', sequence: 750 });
        }
        async load() {
          return new Map([
            ['c', 'from-source3']
          ]);
        }
      }

      const schema = new Schema('object')
        .property('a', new Schema('string'))
        .property('b', new Schema('string'))
        .property('c', new Schema('string'));

      const sources = [
        new SchemaDefaultsSource(),
        new Source1(),
        new Source2(),
        new Source3()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      });

      assert.strictEqual(config.a, 'from-source1');  // Only source1
      assert.strictEqual(config.b, 'from-source2');  // source2 overrides source1
      assert.strictEqual(config.c, 'from-source3');  // source3 overrides source2 and source1
    });

    it('should combine default sources with custom sources', async function() {
      class CustomMiddleSource extends ConfigurationSource {
        constructor() {
          super({ name: 'custom-middle', sequence: 450 });
        }
        async load() {
          return new Map([['middle', 'from-custom']]);
        }
      }

      const schema = new Schema('object')
        .property('fromDefault', new Schema('string', { default: 'default-value' }))
        .property('middle', new Schema('string'))
        .property('fromEnv', new Schema('string'))
        .property('fromCli', new Schema('string'));

      const sources = [
        new SchemaDefaultsSource(),           // 100
        new EnvironmentSource(),              // 400
        new CustomMiddleSource(),             // 450 (between env and CLI)
        new CommandLineSource()               // 600
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--from-cli', 'cli-value'],
        env: {
          'APP_FROM_ENV': 'env-value',
          'APP_MIDDLE': 'env-middle'  // Will be overridden by custom source
        }
      });

      assert.strictEqual(config.fromDefault, 'default-value');
      assert.strictEqual(config.middle, 'from-custom');  // Custom (450) beats env (400)
      assert.strictEqual(config.fromEnv, 'env-value');
      assert.strictEqual(config.fromCli, 'cli-value');
    });
  });
});
