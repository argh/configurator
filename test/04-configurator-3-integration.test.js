import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { ObjectSource } from '../src/configuration-sources/object-source.js';
import { EnvironmentSource } from '../src/configuration-sources/environment-source.js';
import { CommandLineSource } from '../src/configuration-sources/command-line-source.js';

describe('Configurator Integration Tests', function() {
  let configurator;
  let schema;

  beforeEach(function() {
    schema = new ConfigurationSchema();

    // Setup a schema with exclusive categories for storage options
    const localStorageSchema = schema.child('userLocalStorage');
    localStorageSchema.exclusive('storage');
    localStorageSchema.field('storagePath', { description: 'Local file system path' });
    localStorageSchema.field('quota', { type: 'number', description: 'Storage quota in MB' });

    const webStorageSchema = schema.child('userWebStorage');
    webStorageSchema.exclusive('storage');
    webStorageSchema.field('url', { description: 'Web storage server URL' });
    webStorageSchema.field('username');
    webStorageSchema.field('password');

    // Add some basic fields
    schema.field('appName', { default: 'MyApp' });
    schema.field('cluster', { description: 'Cluster name' });
    schema.field('port', { type: 'number', default: 8080 });
    schema.field('debug', { type: 'boolean', default: false });

    // Create configurator with custom sources
    configurator = new Configurator('MyApp', {
      schema: schema,
      sources: [
        new ObjectSource(),
        new EnvironmentSource('MyApp'),
        new CommandLineSource('MyApp')
      ]
    });
  });

  describe('#configure() with multiple sources', function() {
    it('should load and merge configuration from multiple sources', async function() {
      const context = {
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
      assert.equal(config.appName, 'TestApp');
      assert.equal(config.userLocalStorage.storagePath, '/var/data');
    });

    it('should handle source value overrides in different sources', async function() {
      const context = {
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

    it('should handle exclusive categories across different sources', async function() {
      // Object source sets local storage
      // Environment source sets web storage (should override local storage)
      const context = {
        data: {
          userLocalStorage: {
            storagePath: '/tmp/local-storage',
            quota: 1000
          }
        },
        env: {
          'MYAPP_USER_WEB_STORAGE_URL': 'https://storage.example.com',
          'MYAPP_USER_WEB_STORAGE_USERNAME': 'user1',
          'MYAPP_USER_WEB_STORAGE_PASSWORD': 'secret'
        },
        argv: []
      };

      const config = await configurator.configure(context);

      // Web storage settings should be present (from environment)
      assert.equal(config.userWebStorage.url, 'https://storage.example.com');
      assert.equal(config.userWebStorage.username, 'user1');
      assert.equal(config.userWebStorage.password, 'secret');

      // Local storage settings should be excluded (overridden by web storage)
      assert.equal(config.userLocalStorage, undefined);
    });

    it('should handle exclusive categories being overridden by later source', async function() {
      // Environment source sets web storage
      // Command line source sets local storage (should override web storage)
      const context = {
        data: {},
        env: {
          'MYAPP_USER_WEB_STORAGE_URL': 'https://storage.example.com',
          'MYAPP_USER_WEB_STORAGE_USERNAME': 'user1',
          'MYAPP_USER_WEB_STORAGE_PASSWORD': 'secret'
        },
        argv: [
          '--user-local-storage-storage-path', '/opt/local-data',
          '--user-local-storage-quota', '5000'
        ]
      };

      const config = await configurator.configure(context);

      // Local storage settings from command line should be present
      assert.equal(config.userLocalStorage.storagePath, '/opt/local-data');
      assert.equal(config.userLocalStorage.quota, 5000);

      // Web storage settings should be excluded (overridden by local storage)
      assert.equal(config.userWebStorage, undefined);
    });

    it('should throw error when conflicting exclusive categories exist within a single source', async function() {
      // Command line source contains settings from both schemas in the same exclusive category
      const context = {
        data: {},
        env: {},
        argv: [
          '--user-local-storage-storage-path', '/tmp/local',
          '--user-web-storage-url', 'https://storage.example.com'
        ]
      };

      // Should throw an error because the command line source has settings from
      // two different schemas in the same exclusive category
      await assert.rejects(
        async () => await configurator.configure(context),
        /incompatible with previous settings in storage category/
      );
    });

    it('should handle a full configuration example with all sources', async function() {
      const context = {
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
          '--app-name', 'CLIApp',
          '--port', '5000',
          '--debug',
          // Complete password from web storage config
          '--user-web-storage-password', 'secure-password'
        ]
      };

      const config = await configurator.configure(context);

      // Check final configuration values
      assert.equal(config.appName, 'CLIApp');      // From CLI (highest)
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
