
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { JsonFileSource } from '../src/configuration-sources/json-file-source.js';
import { ConfiguratorError } from '../src/errors.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Sources - JsonFileSource', function() {
  let resolver;
  let tempFiles = [];

  beforeEach(function() {
    resolver = new SchemaResolver();
    tempFiles = [];
  });

  afterEach(async function() {
    // Clean up temp files and directories
    for (const file of tempFiles) {
      try {
        const stats = await fs.stat(file);
        if (stats.isDirectory()) {
          await fs.rmdir(file);
        } else {
          await fs.unlink(file);
        }
      } catch (_) {
        // Ignore errors
      }
    }
  });

  async function createTempJsonFile(data) {
    const tempPath = path.join(__dirname, `temp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    await fs.writeFile(tempPath, JSON.stringify(data), 'utf8');
    tempFiles.push(tempPath);
    return tempPath;
  }

  describe('Basic file loading', function() {

    it('should load configuration from JSON file', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('port', new Schema('number'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const tempFile = await createTempJsonFile({
        name: 'myapp',
        port: 3000
      });

      const context = { config: tempFile };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('name'), 'myapp');
      assert.strictEqual(assignments.get('port'), 3000);
      // Context key should be deleted after successful load
      assert.strictEqual(context.config, undefined);
    });

    it('should load nested configuration from JSON file', async function() {
      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const tempFile = await createTempJsonFile({
        database: {
          host: 'localhost',
          port: 5432
        }
      });

      const context = { config: tempFile };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('database.host'), 'localhost');
      assert.strictEqual(assignments.get('database.port'), 5432);
    });

    it('should load arrays from JSON file', async function() {
      const schema = new Schema('object')
        .property('tags', new Schema('array')
          .property('*', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const tempFile = await createTempJsonFile({
        tags: ['node', 'javascript', 'testing']
      });

      const context = { config: tempFile };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('tags.0'), 'node');
      assert.strictEqual(assignments.get('tags.1'), 'javascript');
      assert.strictEqual(assignments.get('tags.2'), 'testing');
    });
  });

  describe('Context name configuration', function() {

    it('should use default context name "config"', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const tempFile = await createTempJsonFile({ value: 'test' });

      const context = { config: tempFile };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'test');
    });

    it('should use custom context name', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource({ contextName: 'customConfig' });

      const tempFile = await createTempJsonFile({ value: 'custom' });

      const context = { customConfig: tempFile };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'custom');
      assert.strictEqual(context.customConfig, undefined);
    });

    it('should return empty when context key missing', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const context = {};
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.size, 0);
    });

    it('should return empty when context value is not a string', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const context = { config: 123 };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.size, 0);
    });
  });

  describe('Sequence priority', function() {

    it('should have default sequence of CONFIGURATION', function() {
      const source = new JsonFileSource();
      assert.strictEqual(source.sequence, 900);
    });

    it('should allow custom sequence override', function() {
      const source = new JsonFileSource({ sequence: 1000 });
      assert.strictEqual(source.sequence, 1000);
    });
  });

  describe('File extension handling', function() {

    it('should accept .json extension', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const tempFile = await createTempJsonFile({ value: 'test' });

      const context = { config: tempFile };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'test');
    });

    it('should accept .JSON extension (case insensitive)', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const tempPath = path.join(__dirname, `temp-${Date.now()}.JSON`);
      await fs.writeFile(tempPath, JSON.stringify({ value: 'uppercase' }), 'utf8');
      tempFiles.push(tempPath);

      const context = { config: tempPath };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'uppercase');
    });

    it('should return empty for non-.json files', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const context = { config: 'config.txt' };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.size, 0);
    });
  });

  describe('Error handling', function() {

    it('should throw ConfiguratorError for non-existent file', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const context = { config: '/nonexistent/path/config.json' };

      await assert.rejects(
        () => source.load(compiled, context),
        {
          name: 'ConfiguratorError',
          message: /not found/
        }
      );
    });

    it('should throw ConfiguratorError for directory instead of file', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      // Create a directory with .json extension
      const dirPath = path.join(__dirname, `temp-dir-${Date.now()}.json`);
      await fs.mkdir(dirPath);
      tempFiles.push(dirPath);

      const context = { config: dirPath };

      await assert.rejects(
        () => source.load(compiled, context),
        {
          name: 'ConfiguratorError',
          message: /directory/
        }
      );
    });

    it('should throw ConfiguratorError for invalid JSON', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const tempPath = path.join(__dirname, `temp-invalid-${Date.now()}.json`);
      await fs.writeFile(tempPath, '{ invalid json }', 'utf8');
      tempFiles.push(tempPath);

      const context = { config: tempPath };

      await assert.rejects(
        () => source.load(compiled, context),
        {
          name: 'ConfiguratorError',
          message: /Error loading JSON/
        }
      );
    });
  });

  describe('Context key deletion', function() {

    it('should delete context key after successful load', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const tempFile = await createTempJsonFile({ value: 'test' });
      const context = { config: tempFile };

      await source.load(compiled, context);

      assert.strictEqual(context.config, undefined);
    });

    it('should not delete context key on error', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const context = { config: '/nonexistent/file.json' };

      try {
        await source.load(compiled, context);
      } catch (_) {
        // Expected to throw
      }

      // Context key should still be there since load failed
      assert.strictEqual(context.config, '/nonexistent/file.json');
    });
  });

  describe('Special file paths', function() {

    it('should handle stdin with "-" path', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('port', new Schema('number'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      // Mock process.stdin with a readable stream
      const originalStdin = process.stdin;
      const mockStdin = new Readable();
      mockStdin.push(JSON.stringify({ name: 'stdin-app', port: 8080 }));
      mockStdin.push(null); // Signal end of stream

      // Replace process.stdin temporarily
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true
      });

      try {
        const context = { config: '-' };
        const assignments = await source.load(compiled, context);

        assert.strictEqual(assignments.get('name'), 'stdin-app');
        assert.strictEqual(assignments.get('port'), 8080);
        assert.strictEqual(context.config, undefined);
      } finally {
        // Restore original stdin
        Object.defineProperty(process, 'stdin', {
          value: originalStdin,
          writable: true,
          configurable: true
        });
      }
    });

    it('should throw ConfiguratorError for invalid JSON from stdin', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      // Mock process.stdin with invalid JSON
      const originalStdin = process.stdin;
      const mockStdin = new Readable();
      mockStdin.push('{ invalid json }');
      mockStdin.push(null);

      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true
      });

      try {
        const context = { config: '-' };

        await assert.rejects(
          () => source.load(compiled, context),
          {
            name: 'ConfiguratorError',
            message: /Error loading JSON configuration from stdin/
          }
        );
      } finally {
        // Restore original stdin
        Object.defineProperty(process, 'stdin', {
          value: originalStdin,
          writable: true,
          configurable: true
        });
      }
    });

    it('should handle empty string as no file', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const context = { config: '' };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.size, 0);
    });

    it('should handle whitespace-only string as no file', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);
      const source = new JsonFileSource();

      const context = { config: '   ' };
      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.size, 0);
    });
  });
});