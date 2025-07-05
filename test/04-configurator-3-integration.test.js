import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { ObjectSource } from '../src/configuration-sources/object-source.js';
import { EnvironmentSource } from '../src/configuration-sources/environment-source.js';
import { CommandLineSource } from '../src/configuration-sources/command-line-source.js';
import { DefaultsSource } from '../src/configuration-sources/defaults-source.js';

describe('Configurator Integration Tests', function() {
  let configurator;
  let schema;

  beforeEach(function() {
    schema = new ConfigurationSchema();

    let condition = (field, value, configuration) => {
      if (field.path.includes('userLocalStorage')) {
        return (configuration.storage === 'local')? true : undefined;
      }
      else if (field.path.includes('userWebStorage')) {
        return (configuration.storage === 'web')? true : undefined;
      }
      else {
        return true;
      }
    }

    // Setup a schema with exclusive categories for storage options
    const localStorageSchema = schema.child('userLocalStorage', {condition});
    localStorageSchema.field('storagePath', { description: 'Local file system path' });
    localStorageSchema.field('quota', { type: 'number', description: 'Storage quota in MB' });

    const webStorageSchema = schema.child('userWebStorage', {condition});
    webStorageSchema.field('url', { description: 'Web storage server URL' });
    webStorageSchema.field('username');
    webStorageSchema.field('password');

    // Add some basic fields
    schema.field('storage', { default: 'local' });
    schema.field('cluster', { description: 'Cluster name' });
    schema.field('port', { type: 'number', default: 8080 });
    schema.field('debug', { type: 'boolean', default: false });

    // Create configurator with custom sources
    configurator = new Configurator({
      schema: schema,
      sources: [
        new DefaultsSource(),
        new ObjectSource(),
        new EnvironmentSource(),
        new CommandLineSource()
      ]
    });
  });

  describe('#configure() with multiple sources', function() {
    it('should load and merge configuration from multiple sources', async function() {
      const context = {
        appName: 'myapp',
        data: {
          appName: 'TestApp',
          port: 3000,
          userLocalStorage: {
            storagePath: '/var/data'
          }
        },
        env: {
          'MYAPP_DEBUG': 'true',
          'MYAPP_CLUSTER': 'dev'
        },
        argv: ['--port', '5000']
      };

      const config = await configurator.configure(context);

      // Command line has highest priority, should override port from object source
      assert.equal(config.port, 5000);

      // Environment variables have medium priority
      assert.equal(config.debug, true);
      assert.equal(config.cluster, 'dev');

      // Object source has lowest priority but still sets values not defined elsewhere
      assert.equal(config.userLocalStorage.storagePath, '/var/data');
    });

    it('should handle source value overrides in different sources', async function() {
      const context = {
        appName: 'myapp',
        data: {
          port: 3000,
          debug: false,
          cluster: 'local'
        },
        env: {
          'MYAPP_PORT': '4000',
          'MYAPP_DEBUG': 'true'
        },
        argv: ['--port', '5000']
      };

      const config = await configurator.configure(context);

      // Each source overrides the previous ones
      assert.equal(config.port, 5000);    // Command line (highest priority)
      assert.equal(config.debug, true);   // Environment (overrides object source)
      assert.equal(config.cluster, 'local'); // Only in object source
    });






    it('should handle a full configuration example with all sources', async function() {
      const context = {
        appName: 'myapp',
        // Low priority source
        data: {
          appName: 'BaseApp',
          cluster: 'default',
          port: 3000,
          debug: false,
          userLocalStorage: {
            storagePath: '/var/data',
            quota: 1000
          }
        },
        // Medium priority source
        env: {
          'MYAPP_APP_NAME': 'EnvApp',
          'MYAPP_CLUSTER': 'production',
          'MYAPP_PORT': '4000',
          // Override storage mechanism
          'MYAPP_USER_WEB_STORAGE_URL': 'https://storage.example.com',
          'MYAPP_USER_WEB_STORAGE_USERNAME': 'admin'
        },
        // High priority source
        argv: [
          '--port', '5000',
          '--debug',
          // Complete password from web storage config
          '--user-web-storage-password', 'secure-password',
          '--storage=web'
        ]
      };

      const config = await configurator.configure(context);

      // Check final configuration values
      assert.equal(config.cluster, 'production');  // From ENV (not overridden by CLI)
      assert.equal(config.port, 5000);            // From CLI (overrides ENV and data)
      assert.equal(config.debug, true);           // From CLI (overrides data)

      // Storage settings should be from web storage (exclusive category)
      assert.equal(config.userWebStorage.url, 'https://storage.example.com');  // From ENV
      assert.equal(config.userWebStorage.username, 'admin');                 // From ENV
      assert.equal(config.userWebStorage.password, 'secure-password');       // From CLI

      // Local storage should be excluded (due to exclusive category conflict)
      assert.equal(config.userLocalStorage, undefined);
    });
  });
});
