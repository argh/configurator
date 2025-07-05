import { strict as assert } from 'assert';
import { ModuleManager } from '../src/module-manager.js';

describe('ModuleManager - Advanced Patterns', function() {
  let moduleManager;

  beforeEach(function() {
    moduleManager = new ModuleManager();
  });

  describe('Module Metadata Inheritance', function() {
    it('should support inheritance of module configurables', async function() {
      class BaseService {
        static moduleConfigurables = [
          { field: 'baseOption', type: 'string', default: 'base-default' }
        ];
      }

      class ExtendedService extends BaseService {
        static moduleConfigurables = [
          { field: 'extendedOption', type: 'string', default: 'extended-default' }
        ];
        static moduleInject = true;
      }

      moduleManager.registerInstance(new ExtendedService());
      await moduleManager.run({argv:[]});

      const service = moduleManager.resolve('extended-service');
      assert.equal(service.baseOption, 'base-default');
      assert.equal(service.extendedOption, 'extended-default');
    });

    it('should support various module metadata patterns', async function() {
      // Using moduleInfo pattern
      class ServiceA {
        static moduleInfo = {
          name: 'service-alpha',
          configurables: [{ field: 'optionA', type: 'string', default: 'A' }],
          inject: true
        };
      }

      // Using individual module* properties
      class ServiceB {
        static moduleName = 'service-beta';
        static moduleConfigurables = [{ field: 'optionB', type: 'string', default: 'B' }];
        static moduleInject = true;
      }

      // Using options in register call
      class ServiceC {}

      moduleManager.register(ServiceA);
      moduleManager.register(ServiceB);
      moduleManager.register(ServiceC, {
        name: 'service-gamma',
        configurables: [{ field: 'optionC', type: 'string', default: 'C' }],
        inject: true
      });

      const serviceA = moduleManager.resolve('service-alpha');
      const serviceB = moduleManager.resolve('service-beta');
      const serviceC = moduleManager.resolve('service-gamma');

      await moduleManager.run({argv:[]});


      assert.equal(serviceA.optionA, 'A');
      assert.equal(serviceB.optionB, 'B');
      assert.equal(serviceC.optionC, 'C');
    });
  });

  describe('Complex Configuration Trees', function() {
    it('should handle nested configuration objects', async function() {
      class NestedConfigModule {
        static moduleInfo = {
          configurables: [
            { child: 'database', configurables: [
                { field: 'host', type: 'string', default: 'localhost' },
                { field: 'port', type: 'number', default: 5432 },
                { child: 'credentials', configurables: [
                    { field: 'username', type: 'string', default: 'admin' },
                    { field: 'password', type: 'string', default: 'password' }
                  ]}
              ]}
          ],
          inject: true
        };
      }

      moduleManager.registerInstance(new NestedConfigModule());

      await moduleManager.run({
        argv:[],
        defaults: {
          nestedConfigModule: {
            database: {
              host: 'db.example.com',
              credentials: {
                username: 'custom-user'
              }
            }
          }
        }
      });
      const module = moduleManager.resolve('nested-config-module');

      assert.equal(module.database.host, 'db.example.com');
      assert.equal(module.database.port, 5432);
      assert.equal(module.database.credentials.username, 'custom-user');
      assert.equal(module.database.credentials.password, 'password');
    });
  });

  describe('Dynamic Providers', function() {
    it('should support dynamic provider selection based on configuration', async function() {
      class FileStorage {
        static moduleInfo = {
          configurables: [{ field: 'path', type: 'string', default: '/tmp' }]
        };
        getType() { return 'file'; }
      }

      class S3Storage {
        static moduleInfo = {
          configurables: [{ field: 'bucket', type: 'string' }]
        };
        getType() { return 's3'; }
      }

      class App {
        static moduleInfo = {
          configurables: [
            { field: 'storageType', type: 'string', default: 'file', required: true },
            { field: 'storage', type: 'storage' }
          ],
          isMain: true,
          inject: true
        };
      }

      moduleManager.register(FileStorage);
      moduleManager.register(S3Storage);

      // Register a resolver to enable dynamic resolution
      moduleManager.registerResolver('storage', (alias, config) => {
        if (config.app?.storageType === undefined) {
          return undefined;
        }
        // Use the storageType field to determine which provider to use
        if (config.app?.storageType === 's3') {
          return 's3-storage';
        } else {
          return 'file-storage';
        }
      });

      moduleManager.register(App);

      // Test with file storage (default)
      await moduleManager.run({argv:[]});
      let app = moduleManager.resolve('app');
      assert.equal(app.storage.getType(), 'file');

      // Reset and test with S3 storage
      moduleManager = new ModuleManager();
      moduleManager.register(FileStorage);
      moduleManager.register(S3Storage);
      moduleManager.registerResolver('storage', (value, config) => {
        if (value !== 'storage') {
          return value;
        }
        if (config.app?.storageType === undefined) {
          return undefined;
        }
        if (config.app?.storageType === 's3') {
          return 's3storage';
        } else {
          return 'file-storage';
        }
      });
      moduleManager.register(App);

      await moduleManager.run({
        argv:[],
        defaults: {
          app: { storageType: 's3' },
          s3Storage: { bucket: 'my-bucket' }
        },
        overrides: {
        app: { storage: 's3-storage'}
        }
      });

      app = moduleManager.resolve('app');
      assert.equal(app.storage?.getType(), 's3');
    });
  });
});
