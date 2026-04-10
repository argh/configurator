
import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { Schema } from '@versionzero/schema';
import { ConfigurationSource, ObjectSource, EnvironmentSource, CommandLineSource } from '../src/configuration-sources/index.js';

describe('Configurator - Conditions Integration', function() {

  describe('Conditions with multiple sources', function() {

    it('should suppress conditional properties based on values from different sources', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string', { default: 'production' }))
        .property('debugOptions', new Schema('object', {
          condition: (value, configuration) => configuration?.mode === 'development'
        })
          .property('verbose', new Schema('boolean', { default: false }))
          .property('logLevel', new Schema('string', { default: 'debug' }))
        );

      const configurator = new Configurator({ schema });

      // Mode from env, debug options from CLI
      const config = await configurator.configure({
        appName: 'app',
        argv: ['--debug-options-verbose', '--debug-options-log-level', 'trace'],
        env: {
          'APP_MODE': 'production'
        }
      });

      // debugOptions should be suppressed because mode is production
      assert.strictEqual(config.mode, 'production');
      assert.strictEqual(config.debugOptions, undefined);
    });

    it('should include conditional properties when condition is met', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string'))
        .property('debugOptions', new Schema('object', {
          condition: (value, configuration) => configuration?.mode === 'development'
        })
          .property('verbose', new Schema('boolean', { default: false }))
          .property('logLevel', new Schema('string', { default: 'debug' }))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--debug-options-verbose'],
        env: {
          'APP_MODE': 'development'
        }
      });

      // debugOptions should be included because mode is development
      assert.strictEqual(config.mode, 'development');
      assert.deepStrictEqual(config.debugOptions, {
        verbose: true,
        logLevel: 'debug'
      });
    });

    it('should work with conditions depending on CLI overriding env', async function() {
      const schema = new Schema('object')
        .property('useCache', new Schema('boolean', { default: true }))
        .property('cache', new Schema('object', {
          condition: (value, configuration) => configuration?.useCache === true
        })
          .property('ttl', new Schema('number', { default: 3600 }))
          .property('maxSize', new Schema('number', { default: 1000 }))
        );

      const configurator = new Configurator({ schema });

      // Env says use cache, but CLI disables it
      const config = await configurator.configure({
        appName: 'app',
        argv: ['--use-cache', 'false'],
        env: {
          'APP_CACHE_TTL': '7200',
          'APP_CACHE_MAX_SIZE': '5000'
        }
      });

      // CLI (600) overrides env (400), but config file (900) would override CLI
      // In this case, no config file, so CLI wins
      // Wait - based on runtime mutability, maybe config file would win
      // Actually for this test, no config file involved
      assert.strictEqual(config.useCache, false);
      assert.strictEqual(config.cache, undefined);
    });
  });

  describe('Conditional custom sources', function() {

    it('should work with conditions on values from custom sources', async function() {
      class FeatureFlagSource extends ConfigurationSource {
        constructor() {
          super({ name: 'feature-flags', sequence: 450 }); // Between env and secrets
        }

        async load(schema, context) {
          const assignments = new Map();
          // Simulated feature flags
          if (context.appName === 'app') {
            assignments.set('enableNewFeature', true);
            assignments.set('enableBetaFeature', false);
          }
          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('enableNewFeature', new Schema('boolean', { default: false }))
        .property('newFeatureConfig', new Schema('object', {
          condition: (value, configuration) => configuration?.enableNewFeature === true
        })
          .property('apiVersion', new Schema('string', { default: 'v2' }))
          .property('timeout', new Schema('number', { default: 5000 }))
        )
        .property('enableBetaFeature', new Schema('boolean', { default: false }))
        .property('betaFeatureConfig', new Schema('object', {
          condition: (value, configuration) => configuration?.enableBetaFeature === true
        })
          .property('experimental', new Schema('boolean', { default: true }))
        );

      const sources = [
        new EnvironmentSource(),
        new FeatureFlagSource(),
        new CommandLineSource(),
        new ObjectSource({ contextName: 'overrides', sequence: 1000 })
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: [],
        env: {}
      }, {deep: true});

      // New feature enabled, beta disabled
      assert.strictEqual(config.enableNewFeature, true);
      assert.ok(config.newFeatureConfig);
      assert.strictEqual(config.newFeatureConfig.apiVersion, 'v2');

      assert.strictEqual(config.enableBetaFeature, false);
      assert.strictEqual(config.betaFeatureConfig, undefined);
    });

    it('should allow higher priority sources to change condition state', async function() {
      class DefaultsSource extends ConfigurationSource {
        constructor() {
          super({ name: 'app-defaults', sequence: 200 });
        }

        async load() {
          const assignments = new Map();
          assignments.set('enableFeature', false);
          assignments.set('featureConfig.setting', 'from-defaults');
          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('enableFeature', new Schema('boolean'))
        .property('featureConfig', new Schema('object', {
          condition: (value, configuration) => configuration?.enableFeature === true
        })
          .property('setting', new Schema('string'))
        );

      const sources = [
        new DefaultsSource(),
        new EnvironmentSource(),
        new CommandLineSource()
      ];

      const configurator = new Configurator({ schema, sources });

      // CLI enables the feature that was disabled by defaults
      const config = await configurator.configure({
        appName: 'app',
        argv: ['--enable-feature'],
        env: {}
      });

      assert.strictEqual(config.enableFeature, true);
      // Even though featureConfig.setting came from low priority source,
      // it should now be included because CLI enabled the feature
      assert.strictEqual(config.featureConfig.setting, 'from-defaults');
    });
  });

  describe('Conditions with source priority', function() {

    it('should suppress values from all sources when condition fails', async function() {
      const schema = new Schema('object')
        .property('secure', new Schema('boolean', { default: false }))
        .property('ssl', new Schema('object', {
          condition: (value, configuration) => configuration?.secure === true
        })
          .property('cert', new Schema('string'))
          .property('key', new Schema('string'))
          .property('ca', new Schema('string'))
        );

      const configurator = new Configurator({ schema });

      // Multiple sources all provide SSL config, but secure is false
      const config = await configurator.configure({
        appName: 'app',
        argv: ['--ssl-cert', '/cli/cert.pem'],
        env: {
          'APP_SSL_KEY': '/env/key.pem',
          'APP_SSL_CA': '/env/ca.pem'
        },
        defaults: {
          ssl: {
            cert: '/default/cert.pem',
            key: '/default/key.pem',
            ca: '/default/ca.pem'
          }
        }
      });

      // All SSL config should be suppressed
      assert.strictEqual(config.secure, false);
      assert.strictEqual(config.ssl, undefined);
    });

    it('should respect source priority for conditional property values', async function() {
      const schema = new Schema('object')
        .property('enableLogging', new Schema('boolean'))
        .property('logging', new Schema('object', {
          condition: (value, configuration) => configuration?.enableLogging === true
        })
          .property('level', new Schema('string', { default: 'info' }))
          .property('format', new Schema('string', { default: 'json' }))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--enable-logging', '--logging-level', 'debug'],
        env: {
          'APP_LOGGING_FORMAT': 'text'
        },
        defaults: {
          logging: {
            level: 'warn',
            format: 'pretty'
          }
        }
      });

      // Condition met, values should come from highest priority source
      assert.strictEqual(config.enableLogging, true);
      assert.strictEqual(config.logging.level, 'debug');  // CLI wins
      assert.strictEqual(config.logging.format, 'text');   // Env wins over defaults
    });
  });

  describe('Multi-level conditional dependencies', function() {

    it('should handle cascading conditions across sources', async function() {
      const schema = new Schema('object')
        .property('stage', new Schema('string'))
        .property('enableMonitoring', new Schema('boolean', {
          condition: (value, configuration) => configuration?.stage === 'production'
        }))
        .property('monitoring', new Schema('object', {
          condition: (value, configuration) => configuration?.enableMonitoring === true
        })
          .property('endpoint', new Schema('string'))
          .property('interval', new Schema('number', { default: 60 }))
        );

      const configurator = new Configurator({ schema });

      // Stage from env, enableMonitoring from CLI, monitoring config from defaults
      const config1 = await configurator.configure({
        appName: 'app',
        argv: ['--enable-monitoring'],
        env: { 'APP_STAGE': 'production' },
        defaults: {
          monitoring: {
            endpoint: 'http://monitor.example.com',
            interval: 30
          }
        }
      });

      // Both conditions met
      assert.strictEqual(config1.stage, 'production');
      assert.strictEqual(config1.enableMonitoring, true);
      assert.strictEqual(config1.monitoring.endpoint, 'http://monitor.example.com');

      // Now with stage=development
      const config2 = await configurator.configure({
        appName: 'app',
        argv: ['--enable-monitoring'],
        env: { 'APP_STAGE': 'development' },
        defaults: {
          monitoring: {
            endpoint: 'http://monitor.example.com'
          }
        }
      });

      // First condition fails, so enableMonitoring is suppressed, cascading to monitoring
      assert.strictEqual(config2.stage, 'development');
      assert.strictEqual(config2.enableMonitoring, undefined);
      assert.strictEqual(config2.monitoring, undefined);
    });

    it('should handle conditions with lazy evaluation dependencies', async function() {
      class AsyncConfigSource extends ConfigurationSource {
        constructor() {
          super({ name: 'async-config', sequence: 350 });
        }

        async load() {
          const assignments = new Map();
          // Use lazy function that depends on other config
          assignments.set('database.connection', async (currentValue, config) => {
            if (!config.database?.host) {
              return undefined; // Retry later when host is available
            }
            return `postgresql://${config.database.host}:5432`;
          });
          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('enableDatabase', new Schema('boolean'))
        .property('database', new Schema('object', {
          condition: (value, configuration) => configuration?.enableDatabase === true
        })
          .property('host', new Schema('string'))
          .property('connection', new Schema('string'))
        );

      const sources = [
        new AsyncConfigSource(),
        new EnvironmentSource(),
        new CommandLineSource()
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--enable-database'],
        env: {
          'APP_DATABASE_HOST': 'db.example.com'
        }
      });

      assert.strictEqual(config.enableDatabase, true);
      assert.strictEqual(config.database.host, 'db.example.com');
      assert.strictEqual(config.database.connection, 'postgresql://db.example.com:5432');
    });
  });

  describe('Real-world scenario: Environment-based features', function() {

    it('should configure production vs development features', async function() {
      const schema = new Schema('object').deep()
        .property('environment', new Schema('string')
          .values(['development', 'staging', 'production'])
          .default('development')
        )
        .property('devTools', new Schema('object').deep()
          .condition( (value, configuration) => configuration?.environment === 'development')
          .property('hotReload', new Schema('boolean', { default: true }))
          .property('debugPanel', new Schema('boolean', { default: true }))
        )
        .property('monitoring', new Schema('object').deep()
          .condition((value, configuration) => configuration?.environment === 'staging' || configuration.environment === 'production')
          .property('enabled', new Schema('boolean', { default: true }))
          .property('sampleRate', new Schema('number', { default: 1.0 }))
        )
        .property('optimizations', new Schema('object').deep()
          .condition( (value, configuration) => configuration?.environment === 'production')
          .property('minify', new Schema('boolean', { default: true }))
          .property('cache', new Schema('boolean', { default: true }))
        );

      const configurator = new Configurator({ schema });

      // Development environment
      const devConfig = await configurator.configure({
        appName: 'app',
        argv: [],
        env: { 'APP_ENVIRONMENT': 'development' }
      });

      assert.strictEqual(devConfig.environment, 'development');
      assert.ok(devConfig.devTools);
      assert.strictEqual(devConfig.devTools.hotReload, true);
      assert.strictEqual(devConfig.monitoring, undefined);
      assert.strictEqual(devConfig.optimizations, undefined);

      // Production environment
      const prodConfig = await configurator.configure({
        appName: 'app',
        argv: [],
        env: { 'APP_ENVIRONMENT': 'production' }
      });

      assert.strictEqual(prodConfig.environment, 'production');
      assert.strictEqual(prodConfig.devTools, undefined);
      assert.ok(prodConfig.monitoring);
      assert.ok(prodConfig.optimizations);
      assert.strictEqual(prodConfig.optimizations.minify, true);
    });

    it('should handle feature flags from multiple sources with conditions', async function() {
      class FeatureFlagSource extends ConfigurationSource {
        constructor() {
          super({ name: 'feature-flags', sequence: 500 });
        }

        async load(schema, context) {
          const assignments = new Map();
          // Remote feature flags
          assignments.set('features.newUI', true);
          assignments.set('features.betaAPI', false);
          assignments.set('features.experimentalCache', true);
          return assignments;
        }
      }

      const schema = new Schema('object')
        .property('features', new Schema('object')
          .property('newUI', new Schema('boolean'))
          .property('betaAPI', new Schema('boolean'))
          .property('experimentalCache', new Schema('boolean'))
        )
        .property('uiConfig', new Schema('object', {
          condition: (value, configuration) => configuration?.features?.newUI === true
        })
          .property('theme', new Schema('string', { default: 'modern' }))
          .property('animations', new Schema('boolean', { default: true }))
        )
        .property('apiConfig', new Schema('object', {
          condition: (value, configuration) => configuration?.features?.betaAPI === true
        })
          .property('endpoint', new Schema('string'))
        )
        .property('cacheConfig', new Schema('object', {
          condition: (value, configuration) => configuration?.features?.experimentalCache === true
        })
          .property('strategy', new Schema('string', { default: 'lru' }))
          .property('size', new Schema('number', { default: 1000 }))
        );

      const sources = [
        new EnvironmentSource(),
        new FeatureFlagSource(),  // Higher priority than env
        new CommandLineSource(),
        new ObjectSource({ contextName: 'overrides', sequence: 1000 })
      ];

      const configurator = new Configurator({ schema, sources });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--cache-config-size', '5000'],
        env: {
          'APP_UI_CONFIG_THEME': 'classic'
        }
      });

      // newUI enabled, so uiConfig included
      assert.strictEqual(config.features.newUI, true);
      assert.ok(config.uiConfig);
      assert.strictEqual(config.uiConfig.theme, 'classic'); // from env

      // betaAPI disabled, so apiConfig suppressed
      assert.strictEqual(config.features.betaAPI, false);
      assert.strictEqual(config.apiConfig, undefined);

      // experimentalCache enabled, so cacheConfig included
      assert.strictEqual(config.features.experimentalCache, true);
      assert.ok(config.cacheConfig);
      assert.strictEqual(config.cacheConfig.size, 5000); // from CLI
    });
  });
});
