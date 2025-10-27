
import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Configurator - Complex Scenarios', function() {

  describe('Multi-environment application configuration', function() {

    it('should configure complete application with environment-specific settings', async function() {
      const registry = new SchemaResolver();

      // Custom URL type
      registry.registerSchema('url', new Schema('string', {
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
        .property('environment', new Schema('string', {
          values: ['development', 'staging', 'production'],
          default: 'development'
        }))
        .property('app', new Schema('object')
          .property('name', new Schema('string', { default: 'myapp' }))
          .property('version', new Schema('string', { default: '1.0.0' }))
          .property('port', new Schema('number', { default: 3000 }))
        )
        .property('database', new Schema('object')
          .property('host', new Schema('string', { default: 'localhost' }))
          .property('port', new Schema('number', { default: 5432 }))
          .property('name', new Schema('string'))
          .property('poolSize', new Schema('number', {
            default: 10,
            condition: (value, config) => config.environment === 'production'
          }))
        )
        .property('cache', new Schema('object')
          .property('enabled', new Schema('boolean', { default: false }))
          .property('ttl', new Schema('number', {
            default: 3600,
            condition: (value, config) => config.cache?.enabled === true
          }))
        )
        .property('logging', new Schema('object')
          .property('level', new Schema('string', {
            values: ['debug', 'info', 'warn', 'error'],
            default: 'info'
          }))
          .property('format', new Schema('string', {
            values: ['json', 'text', 'pretty'],
            default: 'json'
          }))
        )
        .property('features', new Schema('object')
          .property('analytics', new Schema('boolean', {
            default: false,
            condition: (value, config) => config.environment === 'production'
          }))
          .property('debugging', new Schema('boolean', {
            default: true,
            condition: (value, config) => config.environment === 'development'
          }))
        );

      const configurator = new Configurator({ schema, registry });

      const config = await configurator.configure({
        appName: 'myapp',
        argv: ['--environment', 'production', '--app-port', '8080', '--cache-enabled'],
        env: {
          'MYAPP_DATABASE_HOST': 'prod-db.example.com',
          'MYAPP_DATABASE_NAME': 'production_db',
          'MYAPP_LOGGING_LEVEL': 'warn'
        },
        defaults: {
          app: {
            name: 'MyApplication'
          },
          logging: {
            format: 'text'
          }
        }
      });

      // Environment from CLI
      assert.strictEqual(config.environment, 'production');

      // App config from multiple sources
      assert.strictEqual(config.app.name, 'MyApplication'); // defaults
      assert.strictEqual(config.app.port, 8080); // CLI
      assert.strictEqual(config.app.version, '1.0.0'); // schema default

      // Database from env
      assert.strictEqual(config.database.host, 'prod-db.example.com');
      assert.strictEqual(config.database.name, 'production_db');
      assert.strictEqual(config.database.port, 5432); // schema default
      assert.strictEqual(config.database.poolSize, 10); // condition met (production)

      // Cache from CLI and conditional defaults
      assert.strictEqual(config.cache.enabled, true); // CLI
      assert.strictEqual(config.cache.ttl, 3600); // condition met (enabled)

      // Logging from multiple sources
      assert.strictEqual(config.logging.level, 'warn'); // env
      assert.strictEqual(config.logging.format, 'text'); // defaults

      // Conditional features
      assert.strictEqual(config.features.analytics, false); // production, so included, but default false
      assert.strictEqual(config.features.debugging, undefined); // not development, suppressed
    });
  });

  describe('Microservices configuration with unions', function() {

    it('should configure microservices architecture with different service types', async function() {
      const schema = new Schema('object')
        .property('services', new Schema('array')
          .property('*', new Schema('object')
            .unionSchema('api', new Schema('object')
              .property('type', new Schema('string').values(['api']))
              .property('name', new Schema('string'))
              .property('port', new Schema('number'))
              .property('routes', new Schema('array')
                .property('*', new Schema('string'))
              )
            )
            .unionSchema('worker', new Schema('object')
              .property('type', new Schema('string').values(['worker']))
              .property('name', new Schema('string'))
              .property('queue', new Schema('string'))
              .property('concurrency', new Schema('number', { default: 1 }))
            )
            .unionSchema('scheduler', new Schema('object')
              .property('type', new Schema('string').values(['scheduler']))
              .property('name', new Schema('string'))
              .property('cron', new Schema('string'))
              .property('task', new Schema('string'))
            )
          )
        )
        .property('shared', new Schema('object')
          .property('database', new Schema('string'))
          .property('redis', new Schema('string'))
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          services: [
            { type: 'api', name: 'users-api', port: 3000, routes: ['/users', '/auth'] },
            { type: 'api', name: 'products-api', port: 3001, routes: ['/products', '/categories'] },
            { type: 'worker', name: 'email-worker', queue: 'emails', concurrency: 5 },
            { type: 'worker', name: 'notification-worker', queue: 'notifications' },
            { type: 'scheduler', name: 'cleanup-scheduler', cron: '0 0 * * *', task: 'cleanup' }
          ],
          shared: {
            database: 'postgresql://localhost:5432/microservices',
            redis: 'redis://localhost:6379'
          }
        },
        env: {},
        argv: []
      });

      assert.strictEqual(config.services.length, 5);

      // API services
      assert.strictEqual(config.services[0].type, 'api');
      assert.strictEqual(config.services[0].name, 'users-api');
      assert.strictEqual(config.services[0].port, 3000);
      assert.deepStrictEqual(config.services[0].routes, ['/users', '/auth']);

      assert.strictEqual(config.services[1].type, 'api');
      assert.strictEqual(config.services[1].port, 3001);

      // Worker services
      assert.strictEqual(config.services[2].type, 'worker');
      assert.strictEqual(config.services[2].name, 'email-worker');
      assert.strictEqual(config.services[2].queue, 'emails');
      assert.strictEqual(config.services[2].concurrency, 5);

      assert.strictEqual(config.services[3].type, 'worker');
      assert.strictEqual(config.services[3].concurrency, 1); // default

      // Scheduler service
      assert.strictEqual(config.services[4].type, 'scheduler');
      assert.strictEqual(config.services[4].cron, '0 0 * * *');

      // Shared config
      assert.strictEqual(config.shared.database, 'postgresql://localhost:5432/microservices');
      assert.strictEqual(config.shared.redis, 'redis://localhost:6379');
    });
  });

  describe('CI/CD pipeline configuration', function() {

    it('should configure complex deployment pipeline with transformers and conditions', async function() {
      const schema = new Schema('object')
        .property('ci', new Schema('object')
          .property('enabled', new Schema('boolean', { default: true }))
          .property('triggers', new Schema('array')
            .property('*', new Schema('string'))
          )
          .property('stages', new Schema('array')
            .property('*', new Schema('object')
              .unionSchema('build', new Schema('object')
                .property('stage', new Schema('string').values(['build']))
                .property('script', new Schema('string'))
                .property('cache', new Schema('boolean', { default: true }))
              )
              .unionSchema('test', new Schema('object')
                .property('stage', new Schema('string').values(['test']))
                .property('script', new Schema('string'))
                .property('coverage', new Schema('boolean', { default: false }))
              )
              .unionSchema('deploy', new Schema('object')
                .property('stage', new Schema('string').values(['deploy']))
                .property('environment', new Schema('string'))
                .property('script', new Schema('string'))
                .property('manual', new Schema('boolean', { default: false }))
              )
            )
          )
        )
        .property('secrets', new Schema('object')
          .property('apiKey', new Schema('string', {
            transformer: (value) => `***${value.slice(-4)}`
          }))
          .property('deployToken', new Schema('string', {
            transformer: (value) => `***${value.slice(-6)}`,
            condition: (value, config) => config.ci?.stages?.some(s => s.stage === 'deploy')
          }))
        )
        .property('notifications', new Schema('object')
          .property('enabled', new Schema('boolean', { default: false }))
          .property('channels', new Schema('array', {
            condition: (value, config) => config.notifications?.enabled === true
          })
            .property('*', new Schema('string'))
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          ci: {
            triggers: ['push', 'merge_request'],
            stages: [
              { stage: 'build', script: 'npm run build' },
              { stage: 'test', script: 'npm test', coverage: true },
              { stage: 'deploy', environment: 'staging', script: 'deploy.sh', manual: false },
              { stage: 'deploy', environment: 'production', script: 'deploy.sh', manual: true }
            ]
          },
          secrets: {
            apiKey: 'sk_live_abcdefghijklmnopqrstuvwxyz123456',
            deployToken: 'ghp_abcdefghijklmnopqrstuvwxyz'
          },
          notifications: {
            enabled: true,
            channels: ['slack', 'email']
          }
        },
        env: {},
        argv: []
      });

      // CI config
      assert.strictEqual(config.ci.enabled, true);
      assert.deepStrictEqual(config.ci.triggers, ['push', 'merge_request']);
      assert.strictEqual(config.ci.stages.length, 4);

      // Build stage
      assert.strictEqual(config.ci.stages[0].stage, 'build');
      assert.strictEqual(config.ci.stages[0].cache, true);

      // Test stage
      assert.strictEqual(config.ci.stages[1].stage, 'test');
      assert.strictEqual(config.ci.stages[1].coverage, true);

      // Deploy stages
      assert.strictEqual(config.ci.stages[2].stage, 'deploy');
      assert.strictEqual(config.ci.stages[2].environment, 'staging');
      assert.strictEqual(config.ci.stages[2].manual, false);

      assert.strictEqual(config.ci.stages[3].stage, 'deploy');
      assert.strictEqual(config.ci.stages[3].manual, true);

      // Secrets (transformed)
      assert.strictEqual(config.secrets.apiKey, '***3456');
      assert.strictEqual(config.secrets.deployToken, '***uvwxyz'); // condition met (has deploy stage)

      // Notifications
      assert.strictEqual(config.notifications.enabled, true);
      assert.deepStrictEqual(config.notifications.channels, ['slack', 'email']);
    });
  });

  describe('Multi-tenant SaaS configuration', function() {

    it('should configure tenant-specific settings with custom types', async function() {
      const registry = new SchemaResolver();

      // Custom email type
      registry.registerSchema('email', new Schema('string', {
        normalizer: (value) => value.trim().toLowerCase(),
        validator: (value) => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error(`Invalid email: ${value}`);
          }
          return value;
        }
      }));

      // Custom duration type
      registry.registerSchema('duration', new Schema('any', {
        transformer: (value) => {
          if (typeof value === 'number') return value;
          const match = /^(\d+)([smhd])$/.exec(value);
          if (!match) throw new Error(`Invalid duration: ${value}`);
          const [, amount, unit] = match;
          const num = parseInt(amount, 10);
          const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
          return num * multipliers[unit];
        }
      }));

      const schema = new Schema('object')
        .property('tenant', new Schema('object')
          .property('id', new Schema('string'))
          .property('name', new Schema('string'))
          .property('tier', new Schema('string', {
            values: ['free', 'professional', 'enterprise'],
            default: 'free'
          }))
        )
        .property('limits', new Schema('object')
          .property('users', new Schema('number', { default: 5 }))
          .property('storage', new Schema('number', { default: 1024 }))
          .property('apiCalls', new Schema('number', {
            default: 1000,
            condition: (value, config) => config.tenant?.tier !== 'free'
          }))
        )
        .property('features', new Schema('object')
          .property('customDomain', new Schema('boolean', {
            default: false,
            condition: (value, config) => config.tenant?.tier === 'enterprise'
          }))
          .property('sso', new Schema('boolean', {
            default: false,
            condition: (value, config) =>
              config.tenant?.tier === 'professional' || config.tenant?.tier === 'enterprise'
          }))
          .property('support', new Schema('string', {
            values: ['community', 'email', 'priority'],
            default: 'community'
          }))
        )
        .property('contacts', new Schema('array')
          .property('*', new Schema('object')
            .property('name', new Schema('string'))
            .property('email', new Schema('email'))
            .property('role', new Schema('string'))
          )
        )
        .property('billing', new Schema('object')
          .property('enabled', new Schema('boolean', {
            default: true,
            condition: (value, config) => config.tenant?.tier !== 'free'
          }))
          .property('cycle', new Schema('duration', {
            default: '30d',
            condition: (value, config) => config.billing?.enabled === true
          }))
        );

      const configurator = new Configurator({ schema, registry });

      const config = await configurator.configure({
        appName: 'app',
        argv: ['--tenant-tier', 'enterprise'],
        env: {
          'APP_TENANT_ID': 'tenant_12345',
          'APP_TENANT_NAME': 'Acme Corporation'
        },
        defaults: {
          limits: {
            users: 100,
            storage: 102400,
            apiCalls: 1000000
          },
          features: {
            support: 'priority'
          },
          contacts: [
            { name: 'John Doe', email: '  John.Doe@EXAMPLE.COM  ', role: 'admin' },
            { name: 'Jane Smith', email: 'Jane.Smith@Example.com', role: 'billing' }
          ]
        }
      });

      // Tenant info
      assert.strictEqual(config.tenant.id, 'tenant_12345');
      assert.strictEqual(config.tenant.name, 'Acme Corporation');
      assert.strictEqual(config.tenant.tier, 'enterprise');

      // Limits
      assert.strictEqual(config.limits.users, 100);
      assert.strictEqual(config.limits.storage, 102400);
      assert.strictEqual(config.limits.apiCalls, 1000000); // condition met (not free)

      // Features
      assert.strictEqual(config.features.customDomain, false); // enterprise, so included with default
      assert.strictEqual(config.features.sso, false); // enterprise, so included with default
      assert.strictEqual(config.features.support, 'priority');

      // Contacts with email normalization
      assert.strictEqual(config.contacts.length, 2);
      assert.strictEqual(config.contacts[0].email, 'john.doe@example.com'); // normalized
      assert.strictEqual(config.contacts[1].email, 'jane.smith@example.com'); // normalized

      // Billing
      assert.strictEqual(config.billing.enabled, true); // enterprise
      assert.strictEqual(config.billing.cycle, 2592000000); // 30 days in ms
    });
  });

  describe('IoT device fleet configuration', function() {

    it('should configure device fleet with nested arrays and unions', async function() {
      const schema = new Schema('object')
        .property('fleet', new Schema('object')
          .property('name', new Schema('string'))
          .property('region', new Schema('string', {
            values: ['us-east', 'us-west', 'eu-central', 'ap-southeast']
          }))
        )
        .property('devices', new Schema('array')
          .property('*', new Schema('object')
            .property('id', new Schema('string'))
            .property('type', new Schema('string', {
              values: ['sensor', 'gateway', 'actuator']
            }))
            .property('location', new Schema('string'))
            .property('config', new Schema('object')
              .unionSchema('sensor', new Schema('object')
                .property('deviceType', new Schema('string').values(['sensor']))
                .property('interval', new Schema('number', { default: 60 }))
                .property('metrics', new Schema('array')
                  .property('*', new Schema('string'))
                )
              )
              .unionSchema('gateway', new Schema('object')
                .property('deviceType', new Schema('string').values(['gateway']))
                .property('protocol', new Schema('string', {
                  values: ['mqtt', 'coap', 'http']
                }))
                .property('maxConnections', new Schema('number', { default: 100 }))
              )
              .unionSchema('actuator', new Schema('object')
                .property('deviceType', new Schema('string').values(['actuator']))
                .property('actions', new Schema('array')
                  .property('*', new Schema('string'))
                )
                .property('timeout', new Schema('number', { default: 30 }))
              )
            )
          )
        )
        .property('monitoring', new Schema('object')
          .property('enabled', new Schema('boolean', { default: true }))
          .property('alerts', new Schema('array')
            .property('*', new Schema('object')
              .property('metric', new Schema('string'))
              .property('threshold', new Schema('number'))
              .property('action', new Schema('string'))
            )
          )
        );

      const configurator = new Configurator({ schema });

      const config = await configurator.configure({
        appName: 'app',
        defaults: {
          fleet: {
            name: 'Production Fleet Alpha',
            region: 'us-east'
          },
          devices: [
            {
              id: 'sensor-001',
              type: 'sensor',
              location: 'Building A',
              config: {
                deviceType: 'sensor',
                interval: 30,
                metrics: ['temperature', 'humidity', 'pressure']
              }
            },
            {
              id: 'gateway-001',
              type: 'gateway',
              location: 'Building A',
              config: {
                deviceType: 'gateway',
                protocol: 'mqtt',
                maxConnections: 500
              }
            },
            {
              id: 'actuator-001',
              type: 'actuator',
              location: 'Building B',
              config: {
                deviceType: 'actuator',
                actions: ['open', 'close', 'adjust'],
                timeout: 60
              }
            }
          ],
          monitoring: {
            alerts: [
              { metric: 'temperature', threshold: 80, action: 'notify' },
              { metric: 'connection_loss', threshold: 1, action: 'alert' }
            ]
          }
        },
        env: {},
        argv: []
      });

      // Fleet config
      assert.strictEqual(config.fleet.name, 'Production Fleet Alpha');
      assert.strictEqual(config.fleet.region, 'us-east');

      // Devices
      assert.strictEqual(config.devices.length, 3);

      // Sensor device
      assert.strictEqual(config.devices[0].id, 'sensor-001');
      assert.strictEqual(config.devices[0].type, 'sensor');
      assert.strictEqual(config.devices[0].config.deviceType, 'sensor');
      assert.strictEqual(config.devices[0].config.interval, 30);
      assert.deepStrictEqual(config.devices[0].config.metrics, ['temperature', 'humidity', 'pressure']);

      // Gateway device
      assert.strictEqual(config.devices[1].id, 'gateway-001');
      assert.strictEqual(config.devices[1].config.deviceType, 'gateway');
      assert.strictEqual(config.devices[1].config.protocol, 'mqtt');
      assert.strictEqual(config.devices[1].config.maxConnections, 500);

      // Actuator device
      assert.strictEqual(config.devices[2].id, 'actuator-001');
      assert.strictEqual(config.devices[2].config.deviceType, 'actuator');
      assert.deepStrictEqual(config.devices[2].config.actions, ['open', 'close', 'adjust']);
      assert.strictEqual(config.devices[2].config.timeout, 60);

      // Monitoring
      assert.strictEqual(config.monitoring.enabled, true);
      assert.strictEqual(config.monitoring.alerts.length, 2);
      assert.strictEqual(config.monitoring.alerts[0].metric, 'temperature');
      assert.strictEqual(config.monitoring.alerts[0].threshold, 80);
    });
  });

  describe('Feature flag system with complex conditions', function() {

    it('should handle cascading feature flags and dependent configurations', async function() {
      const schema = new Schema('object')
        .property('experimentalFeatures', new Schema('boolean', { default: false }))
        .property('betaProgram', new Schema('boolean', { default: false }))
        .property('userTier', new Schema('string', {
          values: ['free', 'premium', 'enterprise'],
          default: 'free'
        }))
        .property('features', new Schema('object')
          .property('newUI', new Schema('boolean', {
            default: false,
            condition: (value, config) => config.experimentalFeatures === true
          }))
          .property('advancedAnalytics', new Schema('boolean', {
            default: false,
            condition: (value, config) =>
              config.userTier === 'premium' || config.userTier === 'enterprise'
          }))
          .property('aiAssistant', new Schema('boolean', {
            default: false,
            condition: (value, config) =>
              config.betaProgram === true && config.userTier === 'enterprise'
          }))
        )
        .property('uiSettings', new Schema('object', {
          condition: (value, config) => config.features?.newUI === true
        })
          .property('theme', new Schema('string', {
            values: ['light', 'dark', 'auto'],
            default: 'auto'
          }))
          .property('animations', new Schema('boolean', { default: true }))
        )
        .property('analyticsConfig', new Schema('object', {
          condition: (value, config) => config.features?.advancedAnalytics === true
        })
          .property('retention', new Schema('number', { default: 90 }))
          .property('customReports', new Schema('boolean', { default: true }))
        )
        .property('aiConfig', new Schema('object', {
          condition: (value, config) => config.features?.aiAssistant === true
        })
          .property('model', new Schema('string', { default: 'gpt-4' }))
          .property('maxTokens', new Schema('number', { default: 4000 }))
        );

      const configurator = new Configurator({ schema });

      // Test enterprise beta user with features available but not enabled
      const enterpriseConfigDefaults = await configurator.configure({
        appName: 'app',
        argv: ['--experimental-features', '--beta-program', '--user-tier', 'enterprise'],
        env: {},
        defaults: {}
      });

      assert.strictEqual(enterpriseConfigDefaults.experimentalFeatures, true);
      assert.strictEqual(enterpriseConfigDefaults.betaProgram, true);
      assert.strictEqual(enterpriseConfigDefaults.userTier, 'enterprise');

      // Features available (condition met) but default to false
      assert.strictEqual(enterpriseConfigDefaults.features.newUI, false);
      assert.strictEqual(enterpriseConfigDefaults.features.advancedAnalytics, false);
      assert.strictEqual(enterpriseConfigDefaults.features.aiAssistant, false);

      // Dependent configs suppressed (features are false, not true)
      assert.strictEqual(enterpriseConfigDefaults.uiSettings, undefined);
      assert.strictEqual(enterpriseConfigDefaults.analyticsConfig, undefined);
      assert.strictEqual(enterpriseConfigDefaults.aiConfig, undefined);

      // Test enterprise beta user with features explicitly enabled
      const enterpriseConfigEnabled = await configurator.configure({
        appName: 'app',
        argv: [
          '--experimental-features',
          '--beta-program',
          '--user-tier', 'enterprise',
          '--features-new-ui',
          '--features-advanced-analytics',
          '--features-ai-assistant'
        ],
        env: {},
        defaults: {}
      });

      // Features enabled
      assert.strictEqual(enterpriseConfigEnabled.features.newUI, true);
      assert.strictEqual(enterpriseConfigEnabled.features.advancedAnalytics, true);
      assert.strictEqual(enterpriseConfigEnabled.features.aiAssistant, true);

      // Dependent configs now included
      assert.ok(enterpriseConfigEnabled.uiSettings);
      assert.strictEqual(enterpriseConfigEnabled.uiSettings.theme, 'auto');

      assert.ok(enterpriseConfigEnabled.analyticsConfig);
      assert.strictEqual(enterpriseConfigEnabled.analyticsConfig.retention, 90);

      assert.ok(enterpriseConfigEnabled.aiConfig);
      assert.strictEqual(enterpriseConfigEnabled.aiConfig.model, 'gpt-4');

      // Test premium user (no beta)
      const premiumConfig = await configurator.configure({
        appName: 'app',
        argv: ['--user-tier', 'premium'],
        env: {},
        defaults: {}
      });

      assert.strictEqual(premiumConfig.userTier, 'premium');
      assert.strictEqual(premiumConfig.experimentalFeatures, false);
      assert.strictEqual(premiumConfig.betaProgram, false);

      // Limited features
      assert.strictEqual(premiumConfig.features.newUI, undefined); // experimental not enabled
      assert.strictEqual(premiumConfig.features.advancedAnalytics, false); // premium tier, default false
      assert.strictEqual(premiumConfig.features.aiAssistant, undefined); // beta not enabled

      // Dependent configs (all suppressed because features are either unavailable or false)
      assert.strictEqual(premiumConfig.uiSettings, undefined); // newUI suppressed
      assert.strictEqual(premiumConfig.analyticsConfig, undefined); // analytics available but false
      assert.strictEqual(premiumConfig.aiConfig, undefined); // aiAssistant suppressed
    });
  });
});
