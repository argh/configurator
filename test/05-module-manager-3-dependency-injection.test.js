import { strict as assert } from 'assert';
import { ModuleManager } from '../src/module-manager.js';

describe('ModuleManager - Dependency Injection', function() {
  let moduleManager;

  beforeEach(function() {
    moduleManager = new ModuleManager();
  });

  describe('Module Dependencies', function() {
    it('should inject module dependencies based on type field', async function() {
      class Logger {
        static moduleName = 'logger';
        log(message) { return message; }
      }

      class Service {
        static moduleInfo = {
          configurables: [
            { field: 'logger', type: 'logger', required: true }
          ],
          isMain: true
        };

        init(config) {
          this.logger = config.logger;
        }
      }

      moduleManager.register(Logger);
      moduleManager.register(Service);

      await moduleManager.run({argv:[]});

      const service = moduleManager.resolve('service');
      const logger = moduleManager.resolve('logger');

      assert(service.logger);
      assert.strictEqual(service.logger, logger);
    });

    it('should inject dependencies using class reference as type', async function() {
      class Logger {
        static moduleName = 'logger';
        log(message) { return message; }
      }

      class ServiceWithClassRef {
        static moduleInfo = {
          configurables: [
            { field: 'logger', type: Logger, required: true }
          ],
          isMain: true
        };

        init(config) {
          this.logger = config.logger;
        }
      }

      moduleManager.register(Logger);
      moduleManager.register(ServiceWithClassRef);

      await moduleManager.run({argv:[]});

      const service = moduleManager.resolve('service-with-class-ref');
      const logger = moduleManager.resolve('logger');

      assert(service.logger);
      assert.strictEqual(service.logger, logger);
    });

    it('should track dependencies correctly', async function() {
      class A { static moduleName = 'a'; }
      class B {
        static moduleInfo = {
          configurables: [{ field: 'a', type: 'a' }]
        };
        init(config) { this.a = config.a; }
      }
      class C {
        static moduleInfo = {
          configurables: [{ field: 'b', type: 'b' }],
          isMain: true
        };
        init(config) { this.b = config.b; }
      }

      moduleManager.register(A);
      moduleManager.register(B);
      moduleManager.register(C);

      await moduleManager.run({argv:[]});

      const moduleC = moduleManager._modules.get('c');
      assert(moduleC.dependencies.has('b'));

      const moduleB = moduleManager._modules.get('b');
      assert(moduleB.dependencies.has('a'));
    });
  });

  describe('Module Resolution', function() {
    it('should resolve module by name', function() {
      class TestModule {
        hello() { return 'world'; }
      }

      moduleManager.register(TestModule);
      const instance = moduleManager.resolve('test-module');

      assert(instance instanceof TestModule);
      assert.equal(instance.hello(), 'world');
    });

    it('should resolve module by class reference', function() {
      class TestModule {
        hello() { return 'world'; }
      }

      moduleManager.register(TestModule);
      const instance = moduleManager.resolve(TestModule);

      assert(instance instanceof TestModule);
    });

    it('should resolve module by instance', function() {
      class TestModule {}
      const original = new TestModule();

      moduleManager.registerInstance(original);
      const resolved = moduleManager.resolve(original);

      assert.strictEqual(resolved, original);
    });

    it('should return undefined for unknown modules', function() {
      const result = moduleManager.resolve('non-existent');
      assert.strictEqual(result, undefined);
    });
  });
});
