import { strict as assert } from 'assert';
import { ModuleManager } from '../src/module-manager.js';

describe('ModuleManager - Lifecycle Methods', function() {
  let moduleManager;

  beforeEach(function() {
    moduleManager = new ModuleManager();
  });

  describe('Module Lifecycle', function() {
    it('should call lifecycle methods in the correct order', async function() {
      const events = [];

      class LifecycleModule {
        static moduleName = 'lifecycle-test';
        static moduleIsMain = true;

        async init(config) {
          events.push('init');
        }

        async start() {
          events.push('start');
        }

        async main() {
          events.push('main');
        }

        async stop() {
          events.push('stop');
        }

        async terminate() {
          events.push('terminate');
        }
      }

      moduleManager.register(LifecycleModule);
      await moduleManager.run({argv: [], env: []});

      assert.deepEqual(events, ['init', 'start', 'main', 'stop', 'terminate']);
    });

    it('should call init with the module configuration', async function() {
      let initConfig;

      class ConfigModule {
        static moduleInfo = {
          name: 'config-module',
          configurables: [
            { field: 'apiKey', type: 'string', default: 'default-key' },
            { field: 'timeout', type: 'number', default: 1000 }
          ],
          isMain: true
        };

        async init(config) {
          initConfig = config;
        }
      }

      moduleManager.register(ConfigModule);
      await moduleManager.run({argv: []});

      assert.equal(initConfig.apiKey, 'default-key');
      assert.equal(initConfig.timeout, 1000);
    });

    it('should use overridden configuration values', async function() {
      let initConfig;

      class ConfigModule {
        static moduleInfo = {
          configurables: [
            { field: 'apiKey', type: 'string', default: 'default-key' },
            { field: 'timeout', type: 'number', default: 1000 }
          ],
          isMain: true
        };

        async init(config) {
          initConfig = config;
        }
      }

      moduleManager.register(ConfigModule);
      await moduleManager.run({
        argv: [],
        overrides: {
          configModule: {
            apiKey: 'custom-key',
            timeout: 2000
          }
        }
      });

      assert.equal(initConfig.apiKey, 'custom-key');
      assert.equal(initConfig.timeout, 2000);
    });

    it('should inject configuration properties when inject is true', async function() {
      class InjectModule {
        static moduleInfo = {
          configurables: [
            { field: 'apiKey', type: 'string', default: 'default-key' },
            { field: 'timeout', type: 'number', default: 1000 }
          ],
          inject: true,
          isMain: true
        };

        async init(config) {
          // Config should be injected directly into the instance
        }
      }

      moduleManager.register(InjectModule);
      await moduleManager.run({argv: []});

      const instance = moduleManager.resolve('inject-module');
      assert.equal(instance.apiKey, 'default-key');
      assert.equal(instance.timeout, 1000);
    });
  });
});
