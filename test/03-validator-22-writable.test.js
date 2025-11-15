
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Validator: writable', function() {
  let resolver;
  let testFile;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    testFile = path.join(__dirname, 'test-writable-validator.txt');
    await fs.writeFile(testFile, 'test content');
  });

  afterEach(async function() {
    try {
      await fs.unlink(testFile);
    } catch (err) {
      // Ignore
    }
  });

  it('should accept existing writable file', async function() {
    const schema = new Schema('string').validator('$writable');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate(testFile, {}, '');
    assert.strictEqual(result, testFile);
  });

  it('should accept non-existent file in writable directory', async function() {
    const schema = new Schema('string').validator('$writable');
    const compiled = await resolver.compile(schema);

    const nonExistent = path.join(__dirname, 'new-file-that-does-not-exist.txt');
    await compiled.validate(nonExistent, {}, '');
  });

  it('should reject file in non-existent directory', async function() {
    const schema = new Schema('string').validator('$writable');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validate('/nonexistent/directory/file.txt', {}, ''),
      ValidationError
    );
  });

  it('should have path description', async function() {
    const schema = new Schema('string').validator('$writable');
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[path]');
  });
});