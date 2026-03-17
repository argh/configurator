
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidationError } from '../src/schema/schema-errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Processor: readable', function() {
  /** @type {SchemaResolver} */
  let resolver;
  let testFile;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    testFile = path.join(__dirname, 'test-readable-validator.txt');
    await fs.writeFile(testFile, 'test content');
  });

  afterEach(async function() {
    try {
      await fs.unlink(testFile);
    } catch (err) {
      // Ignore
    }
  });

  it('should accept readable file', async function() {
    const schema = new Schema('string').validator('$readable');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue(testFile);
    assert.strictEqual(result, testFile);
  });

  it('should accept this test file', async function() {
    const schema = new Schema('string').validator('$readable');
    const compiled = await resolver.compile(schema);

    await compiled.validateValue(__filename);
  });

  it('should reject non-existent file', async function() {
    const schema = new Schema('string').validator('$readable');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validateValue('/nonexistent/file.txt'),
      ValidationError
    );
  });

  it('should have path description', async function() {
    const schema = new Schema('string').validator('$readable');
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[path]');
  });
});