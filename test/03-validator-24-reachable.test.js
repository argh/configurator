
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: reachable', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept localhost', async function() {
    const schema = new Schema('string').validator('$reachable');
    const compiled = await resolver.compile(schema);

    const result = await compiled._validateValue('localhost');
    assert.strictEqual(result, 'localhost');
  });

  it('should accept well-known domain', async function() {
    this.timeout(5000); // DNS lookup may take time
    const schema = new Schema('string').validator('$reachable');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('google.com');
  });

  it('should reject non-existent domain', async function() {
    this.timeout(5000);
    const schema = new Schema('string').validator('$reachable');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue('this-domain-definitely-does-not-exist-12345.com'),
      ValidationError
    );
  });

  it('should reject invalid hostname', async function() {
    const schema = new Schema('string').validator('$reachable');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue('!!!invalid!!!'),
      ValidationError
    );
  });
});