import { strict as assert } from 'assert';
import { Configurator } from '../src/configurator.js';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { ObjectSource } from '../src/configuration-sources/object-source.js';

describe('Configurator - Exclusive Categories', function() {
  let configurator;
  let schema;

  beforeEach(function() {
    schema = new ConfigurationSchema();

    // Create a schema with exclusive categories for storage types
    const localSchema = schema.child('fileStorage');
    localSchema.exclusive('storage');
    localSchema.field('path', { type: 'string' });
    localSchema.field('quota', { type: 'number' });

    const remoteSchema = schema.child('remoteStorage');
    remoteSchema.exclusive('storage');
    remoteSchema.field('url', { type: 'string' });
    remoteSchema.field('credentials', { type: 'string' });

    // Add a non-exclusive section
    schema.child('blah')
      .field('name', { type: 'string' })
      .field('debug', { type: 'boolean', default: false });

    configurator = new Configurator({
      schema: schema,
      sources: [
        new ObjectSource({contextFieldName: 'low'}),
        new ObjectSource({contextFieldName: 'medium'}),
        new ObjectSource({contextFieldName: 'high'})
      ]
    });
  });

  describe('#configure() with exclusive categories', function() {
    it('should handle exclusive categories within a single source', async function() {
      const context = {
        low: {
          blah: {
            name: 'Test App',
            debug: true
          },
          fileStorage: {
            path: '/var/data',
            quota: 1000
          }
          // No remoteStorage defined
        },
        medium: {},
        high: {}
      };

      const config = await configurator.configure(context);

      assert.equal(config.blah.name, 'Test App');
      assert.equal(config.blah.debug, true);
      assert.equal(config.fileStorage.path, '/var/data');
      assert.equal(config.fileStorage.quota, 1000);
      assert.equal(config.remoteStorage, undefined);
    });

    it('should override exclusive categories from different sources', async function() {
      const context = {

        low: {
          fileStorage: {
            path: '/var/data',
            quota: 1000
          }
        },
        medium: {
          remoteStorage: {
            url: 'https://storage.example.com',
            credentials: 'secret123'
          }
        },
        high: {}
      };

      const config = await configurator.configure(context);

      // Medium priority source defined remoteStorage, which should
      // override fileStorage from low priority source
      assert.equal(config.remoteStorage.url, 'https://storage.example.com');
      assert.equal(config.remoteStorage.credentials, 'secret123');
      assert.equal(config.fileStorage, undefined);
    });

    it('should handle multiple overrides of exclusive categories', async function() {
      const context = {

        low: {
          fileStorage: {
            path: '/var/data',
            quota: 1000
          }
        },
        medium: {
          remoteStorage: {
            url: 'https://storage.example.com',
            credentials: 'secret123'
          }
        },
        high: {
          // Override back to fileStorage
          fileStorage: {
            path: '/opt/highpriority',
            quota: 5000
          }
        }
      };

      const config = await configurator.configure(context);

      // High priority source should override all previous sources
      assert.equal(config.fileStorage.path, '/opt/highpriority');
      assert.equal(config.fileStorage.quota, 5000);
      assert.equal(config.remoteStorage, undefined);
    });

    it('should keep non-exclusive sections from all sources', async function() {
      const context = {

        low: {
          blah: {
            name: 'Low Priority'
          },
          fileStorage: {
            path: '/var/data',
            quota: 1000
          }
        },
        medium: {
          blah: {
            debug: true
          },
          remoteStorage: {
            url: 'https://storage.example.com',
            credentials: 'secret123'
          }
        },
        high: {}
      };

      const config = await configurator.configure(context);

      // Non-exclusive sections should merge normally
      assert.equal(config.blah.name, 'Low Priority'); // From low
      assert.equal(config.blah.debug, true); // From medium

      // But exclusive sections should override
      assert.equal(config.remoteStorage.url, 'https://storage.example.com');
      assert.equal(config.remoteStorage.credentials, 'secret123');
      assert.equal(config.fileStorage, undefined);
    });
  });
});
