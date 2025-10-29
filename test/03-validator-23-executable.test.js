
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Validator: executable', function() {
  let resolver;
  let testFile;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    testFile = path.join(__dirname, 'test-executable-validator.sh');
    await fs.writeFile(testFile, '#!/bin/bash\necho test');
    await fs.chmod(testFile, 0o755); // Make executable
  });

  afterEach(async function() {
    try {
      await fs.unlink(testFile);
    } catch (err) {
      // Ignore
    }
  });

  it('should accept executable file', async function() {
    const schema = new Schema('string').validator('$executable');
    const compiled = resolver.compile(schema);

    const result = await compiled.validate(testFile, {}, '');
    assert.strictEqual(result, testFile);
  });

  it('should reject non-executable file', async function() {
    const nonExec = path.join(__dirname, 'test-non-exec.txt');
    await fs.writeFile(nonExec, 'test');
    await fs.chmod(nonExec, 0o644); // Not executable

    const schema = new Schema('string').validator('$executable');
    const compiled = resolver.compile(schema);

    try {
      await assert.rejects(
        () => compiled.validate(nonExec, {}, ''),
        ValidationError
      );
    } finally {
      await fs.unlink(nonExec);
    }
  });

  it('should reject non-existent file', async function() {
    const schema = new Schema('string').validator('$executable');
    const compiled = resolver.compile(schema);

    await assert.rejects(
      () => compiled.validate('/nonexistent/file', {}, ''),
      ValidationError
    );
  });

  it('should have path description', function() {
    const schema = new Schema('string').validator('$executable');
    const compiled = resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[path]');
  });
});