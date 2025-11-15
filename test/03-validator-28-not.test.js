
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: not', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept value that fails inner validator', async function() {
    const schema = new Schema('string').validator({
      not: /^test/
    });
    const compiled = await resolver.compile(schema);

    await compiled.validate('other', {}, '');
    await compiled.validate('something', {}, '');
  });

  it('should reject value that passes inner validator', async function() {
    const schema = new Schema('string').validator({
      not: /^test/
    });
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validate('test123', {}, ''),
      ValidationError
    );
  });

  it('should invert numeric validator', async function() {
    const schema = new Schema('string').validator({
      not: '$numeric'
    });
    const compiled = await resolver.compile(schema);

    await compiled.validate('abc', {}, '');
    await assert.rejects(() => compiled.validate('123', {}, ''), ValidationError);
  });

  it('should generate negated description', async function() {
    const schema = new Schema('string').validator({
      not: /^test/
    });
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[!/^test/]');
  });

  it('should add parentheses for complex descriptions', async function() {
    const schema = new Schema('string').validator({
      not: {and: [/^a/, /b$/]}
    });
    const compiled = await resolver.compile(schema);

    assert.ok(compiled.metadata.valueDescription.includes('!('));
  });
});