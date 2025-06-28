import { strict as assert } from 'assert';
import { ModuleManager } from '../src/module-manager.js';

describe('ModuleManager - Basic Functionality', function() {
  let moduleManager;

  beforeEach(function() {
    moduleManager = new ModuleManager();
  });

  describe('Module Registration', function() {
    it('should register a class module', function() {
      class TestModule {
        static moduleName = 'test-module';
      }

      const definition = moduleManager.register(TestModule);
      assert.equal(definition.name, 'test-module');
      assert(moduleManager._modules.has('test-module'));
    });

    it('should register a module with name from class name', function() {
      class UserManager {}

      const definition = moduleManager.register(UserManager);
      assert.equal(definition.name, 'user-manager');
      assert(moduleManager._modules.has('user-manager'));
    });

    it('should register a module with explicit name', function() {
      class SomeClass {}

      const definition = moduleManager.register(SomeClass, { name: 'explicit-name' });
      assert.equal(definition.name, 'explicit-name');
      assert(moduleManager._modules.has('explicit-name'));
    });

    it('should throw when registering a module without a name', function() {
      assert.throws(() => {
        moduleManager.register(function() {});
      }, /ModuleClass needs to be registered with a name/);
    });

    it('should throw when registering a duplicate module', function() {
      class DuplicateModule {}

      moduleManager.register(DuplicateModule);
      assert.throws(() => {
        moduleManager.register(DuplicateModule);
      }, /Module already registered/);
    });
  });

  describe('Instance Registration', function() {
    it('should register a pre-instantiated module', function() {
      class TestModule {}
      const instance = new TestModule();

      moduleManager.registerInstance(instance);
      assert(moduleManager._modules.has('test-module'));
      assert.strictEqual(moduleManager._modules.get('test-module').instance, instance);
    });

    it('should register an instance with explicit name', function() {
      class TestModule {}
      const instance = new TestModule();

      moduleManager.registerInstance(instance, { name: 'custom-instance' });
      assert(moduleManager._modules.has('custom-instance'));
    });
  });

  describe('Constant Registration', function() {
    it('should register a constant value', function() {
      moduleManager.registerConstant('CONFIG', { api: 'http://example.com' });
      assert(moduleManager._modules.has('config'));
      assert.deepEqual(moduleManager._modules.get('config').value, { api: 'http://example.com' });
    });

    it('should resolve a constant value', function() {
      const value = { api: 'http://example.com' };
      moduleManager.registerConstant('CONFIG', value);

      const resolved = moduleManager.resolve('config');
      assert.strictEqual(resolved, value);
    });
  });
});
