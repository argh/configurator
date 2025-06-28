import { strict as assert } from 'assert';
import { ModuleManager } from '../src/module-manager.js';
import { ConfigurationSource } from '../src/configuration-sources/configuration-source.js';

describe('ModuleManager - Configuration Sources Integration', function() {
  let moduleManager;

  beforeEach(function() {
    moduleManager = new ModuleManager();
  });

  describe('Configuration Loading', function() {
    it('should load configuration from multiple sources', async function() {
      class TestModule {
        static moduleInfo = {
          configurables: [
            { field: 'option1', type: 'string', default: 'default1' },
            { field: 'option2', type: 'string' },
            { field: 'option3', type: 'string' }
          ],
          inject: true,
          isMain: true
        };
      }

      // Create a custom configuration source
      class CustomSource extends ConfigurationSource {
        constructor() {
          super('custom', 450); // Between environment and arguments
        }

        async _load(schema) {
          const values = new Map();
          values.set('testModule.option2', 'custom-value');
          return values;
        }
      }

      moduleManager.register(TestModule);
      moduleManager.configurator.registerConfigurationSource(new CustomSource());

      await moduleManager.run({

        defaults: {
          testModule: {
            option1: 'from-defaults'
          }
        },
        env: {
          TEST_MODULE_OPTION2: 'from-env' // Should be overridden by CustomSource
        },
        argv: [
          '--option3', 'from-args' // Highest priority; appname is testmodule so we only need the suffix
        ]
      });

      const module = moduleManager.resolve('test-module');
      assert.equal(module.option1, 'from-defaults');
      assert.equal(module.option2, 'custom-value'); // From CustomSource
      assert.equal(module.option3, 'from-args');
    });

    it('should convert configuration values to the correct types', async function() {
      class TypedModule {
        static moduleInfo = {
          configurables: [
            { field: 'stringVal', type: 'string' },
            { field: 'numberVal', type: 'number' },
            { field: 'boolVal', type: 'boolean' },
            { field: 'arrayVal', type: 'array' }
          ],
          inject: true
        };
      }

      moduleManager.registerInstance(new TypedModule());

      await moduleManager.run({
        argv: [
          '--typed-module-string-val', '42',
          '--typed-module-number-val', '42',
          '--typed-module-bool-val', 'true',
          '--typed-module-array-val', 'a,b,c'
        ]
      });

      const module = moduleManager.resolve('typed-module');
      assert.strictEqual(typeof module.stringVal, 'string');
      assert.strictEqual(module.stringVal, '42');

      assert.strictEqual(typeof module.numberVal, 'number');
      assert.strictEqual(module.numberVal, 42);

      assert.strictEqual(typeof module.boolVal, 'boolean');
      assert.strictEqual(module.boolVal, true);

      assert.strictEqual(Array.isArray(module.arrayVal), true);
      assert.deepEqual(module.arrayVal, ['a', 'b', 'c']);
    });
  });

  describe('ModuleManager as ConfigurationSource', function() {
    it('should provide module instances as configuration values', async function() {
      class ServiceA {
        getValue() { return 'A'; }
      }

      class ServiceB {
        static moduleInfo = {
          configurables: [{ field: 'serviceA', type: 'service-a' }]
        };

        init(config) {
          this.serviceA = config.serviceA;
        }

        getValue() { 
          return this.serviceA.getValue() + 'B'; 
        }
      }

      moduleManager.register(ServiceA);
      moduleManager.registerInstance(new ServiceB());

      await moduleManager.run({argv:[]});

      const serviceB = moduleManager.resolve('service-b');
      assert.equal(serviceB.getValue(), 'AB');
    });

    it('should handle circular dependencies gracefully', async function() {
      class CircularA {
        static moduleInfo = {
          configurables: [{ field: 'refB', type: 'circular-b' }],
          inject: true
        };
      }

      class CircularB {
        static moduleInfo = {
          configurables: [{ field: 'refA', type: 'circular-a' }],
          inject: true
        };
      }

      moduleManager.register(CircularA);
      moduleManager.register(CircularB);

      // This should handle the circular reference without crashing
      await assert.doesNotReject(async () => {
        await moduleManager.run({argv:[]});
      });
    });
  });
});
