
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Validator: directory', function() {
  let resolver;
  let testDir;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    testDir = path.join(__dirname, 'test-dir-validator');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async function() {
    try {
      await fs.rmdir(testDir);
    } catch (err) {
      // Ignore if directory doesn't exist
    }
  });

  it('should accept existing directory', async function() {
    const schema = new Schema('string').validator('$directory');
    const compiled = await resolver.compile(schema);

    const result = await compiled._validateValue(testDir);
    assert.strictEqual(result, testDir);
  });

  it('should accept test directory itself', async function() {
    const schema = new Schema('string').validator('$directory');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue(__dirname);
  });

  it('should reject non-existent directory', async function() {
    const schema = new Schema('string').validator('$directory');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue('/nonexistent/directory'),
      ValidationError
    );
  });

  it('should reject file path', async function() {
    const schema = new Schema('string').validator('$directory');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue(__filename),
      ValidationError
    );
  });
});