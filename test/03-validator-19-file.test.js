
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Validator: file', function() {
  let resolver;
  let testFile;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    testFile = path.join(__dirname, 'test-file-validator.txt');
    await fs.writeFile(testFile, 'test content');
  });

  afterEach(async function() {
    try {
      await fs.unlink(testFile);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  it('should accept existing file', async function() {
    const schema = new Schema('string').validator('$file');
    const compiled = await resolver.compile(schema);

    const result = await compiled._validateValue(testFile);
    assert.strictEqual(result, testFile);
  });

  it('should accept this test file itself', async function() {
    const schema = new Schema('string').validator('$file');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue(__filename);
  });

  it('should reject non-existent file', async function() {
    const schema = new Schema('string').validator('$file');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue('/nonexistent/file.txt'),
      ValidationError
    );
  });

  it('should reject directory path', async function() {
    const schema = new Schema('string').validator('$file');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue(__dirname),
      ValidationError
    );
  });
});