
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: or', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept value matching first condition', async function() {
    const schema = new Schema('string').validator({
      $or: [/^test/, /^other/]
    });
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('test123');
  });

  it('should accept value matching second condition', async function() {
    const schema = new Schema('string').validator({
      $or: [/^test/, /^other/]
    });
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('other123');
  });

  it('should accept value matching any condition', async function() {
    const schema = new Schema('string').validator({
      $or: ['$numeric', '$alpha']
    });
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('123');
    await compiled.validateValue('abc');
  });

  it('should reject when no condition matches', async function() {
    const schema = new Schema('string').validator({
      $or: [/^test/, /^other/]
    });
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validateValue('invalid'),
      ValidationError
    );
  });

  it('should return first successful result', async function() {
    const schema = new Schema('string').validator({
      $or: [
        (v) => v.toUpperCase(),
        (v) => v.toLowerCase()
      ]
    });
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue('test');
    assert.strictEqual(result, 'TEST'); // First validator wins
  });

  it('should generate combined description', async function() {
    const schema = new Schema('string').validator({
      $or: [/^test/, /^other/]
    });
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[/^test/|/^other/]');
  });
});