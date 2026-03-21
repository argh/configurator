
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ValidationError } from '../src/schema/schema-errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Processor: $file-size', function() {
  /** @type {SchemaResolver} */
  let resolver;
  let testFile;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    testFile = path.join(__dirname, 'test-filesize.tmp');
    // Create a 100-byte test file
    await fs.writeFile(testFile, 'x'.repeat(100));
  });

  afterEach(async function() {
    try {
      await fs.unlink(testFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should accept file within size range', async function() {
    const schema = new Schema('string').validator({'$file-size': {min: 50, max: 150}});
    const compiled = await resolver.compile(schema);

    await compiled.validateValue(testFile);
  });

  it('should accept file at min boundary', async function() {
    const schema = new Schema('string').validator({'$file-size': {min: 100, max: 150}});
    const compiled = await resolver.compile(schema);

    await compiled.validateValue(testFile);
  });

  it('should accept file at max boundary', async function() {
    const schema = new Schema('string').validator({'$file-size': {min: 50, max: 100}});
    const compiled = await resolver.compile(schema);

    await compiled.validateValue(testFile);
  });

  it('should reject file too small', async function() {
    const schema = new Schema('string').validator({'$file-size': {min: 200}});
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue(testFile), ValidationError);
  });

  it('should reject file too large', async function() {
    const schema = new Schema('string').validator({'$file-size': {max: 50}});
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue(testFile), ValidationError);
  });

  it('should accept file with min only', async function() {
    const schema = new Schema('string').validator({'$file-size': {min: 50}});
    const compiled = await resolver.compile(schema);

    await compiled.validateValue(testFile);
  });

  it('should accept file with max only', async function() {
    const schema = new Schema('string').validator({'$file-size': {max: 150}});
    const compiled = await resolver.compile(schema);

    await compiled.validateValue(testFile);
  });

  it('should reject non-existent file', async function() {
    const schema = new Schema('string').validator({'$file-size': {min: 0, max: 1000}});
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validateValue('/nonexistent/file.txt'),
      ValidationError
    );
  });

  it('should generate description for both bounds', async function() {
    const schema = new Schema('string').validator({'$file-size': {min: 100, max: 1000}});
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[100-1000B]');
  });

  it('should generate description for min only', async function() {
    const schema = new Schema('string').validator({'$file-size': {min: 100}});
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[≥100B]');
  });

  it('should generate description for max only', async function() {
    const schema = new Schema('string').validator({'$file-size': {max: 1000}});
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[≤1000B]');
  });
});
