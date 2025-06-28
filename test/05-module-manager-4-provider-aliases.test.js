import { strict as assert } from 'assert';
import { ModuleManager } from '../src/module-manager.js';

describe('ModuleManager - Provider Aliases', function() {
  let moduleManager;

  beforeEach(function() {
    moduleManager = new ModuleManager();
  });

  describe('Provides Mechanism', function() {
    it('should create provider aliases using provides option', async function() {
      class FileStorage {
        static moduleInfo = {
          configurables: [
            { field: 'path', type: 'string', default: '/tmp' }
          ],
          provides: 'storage'
        };
      }

      class S3Storage {
        static moduleInfo = {
          configurables: [
            { field: 'bucket', type: 'string', default: 'default-bucket' }
          ],
          provides: 'storage'
        };
      }

      class App {
        static moduleInfo = {
          configurables: [
            { field: 'storage', type: 'storage', required: true }
          ],
          isMain: true
        };

        init(config) {
          this.storage = config.storage;
        }
      }

      moduleManager.register(FileStorage);
      moduleManager.register(S3Storage);
      moduleManager.register(App);

      // Test with file storage
      await moduleManager.run({
        argv: [],
        defaults: {
          fileStorage: { path: '/custom/path' }
        }
      });

      let app = moduleManager.resolve('app');
      let fileStorage = moduleManager.resolve('file-storage');
      assert.strictEqual(app.storage, fileStorage);

      // Reset and test with S3 storage
      moduleManager = new ModuleManager();
      moduleManager.register(FileStorage);
      moduleManager.register(S3Storage);
      moduleManager.register(App);

      await moduleManager.run({
        argv: [],
        defaults: {
          s3Storage: { bucket: 'my-bucket' }
        }
      });

      app = moduleManager.resolve('app');
      let s3Storage = moduleManager.resolve('s3storage');
      assert.strictEqual(app.storage, s3Storage);
    });

    it('should maintain exclusivity between providers', async function() {
      class LocalCache {
        static moduleInfo = {
          configurables: [{ field: 'size', type: 'number', default: 100 }],
          provides: 'cache'
        };
      }

      class RedisCache {
        static moduleInfo = {
          configurables: [{ field: 'host', type: 'string', default: 'localhost' }],
          provides: 'cache'
        };
      }

      moduleManager.register(LocalCache);
      moduleManager.register(RedisCache);

      // Should not allow configuring both
      await assert.rejects(async () => {
        await moduleManager.configurator.configure({
          argv: [],
          defaults: {
            localCache: { size: 500 },
            redisCache: { host: 'redis.example.com' }
          }
        }, true);
      });

      // But configuring one should work
      const config = await moduleManager.configurator.configure({
        argv: [],
        defaults: {
          localCache: { size: 500 }
        }
      }, true);

      assert.equal(config.localCache.size, 500);
    });

    it('should register a custom provider alias resolver', async function() {
      class FileLogger {}
      class ConsoleLogger {}

      moduleManager.register(FileLogger);
      moduleManager.register(ConsoleLogger);

      moduleManager.registerAlias('logger', (alias, config) => {
        if (config.app?.useFileLogging === true) {
          return 'file-logger';
        } else if (config.app?.useFileLogging === false) {
          return 'console-logger';
        }
        else {
          return undefined;
        }
      });

      class App {
        static moduleInfo = {
          configurables: [{ field: 'logger', type: 'logger' }, {field: 'useFileLogging', type: 'boolean', default: false}],
          isMain: true
        };

        init(config) {
          this.logger = config.logger;
        }
      }

      moduleManager.register(App);

      // Test with file logger
      await moduleManager.run({
        argv: [],
        defaults: {
          app: {
            useFileLogging: true
          }
        }
      });

      let app = moduleManager.resolve('app');
      let fileLogger = moduleManager.resolve('file-logger');
      assert.strictEqual(app.logger, fileLogger);

      // Reset and test with console logger
      moduleManager = new ModuleManager();
      moduleManager.register(FileLogger);
      moduleManager.register(ConsoleLogger);
      moduleManager.registerAlias('logger', (alias, config) => {
        if (config.app?.useFileLogging === undefined) {
          return undefined;
        }
        if (config.app?.useFileLogging) {
          return 'file-logger';
        } else {
          return 'console-logger';
        }
      });
      moduleManager.register(App);

      await moduleManager.run({
        argv: [],
        defaults: {
          app: {
            useFileLogging: false
          }
        }
      });

      app = moduleManager.resolve('app');
      let consoleLogger = moduleManager.resolve('console-logger');
      assert.strictEqual(app.logger, consoleLogger);
    });
  });
});
