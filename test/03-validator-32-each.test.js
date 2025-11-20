
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: each', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should validate each array element', async function() {
    const schema = new Schema('array').validator({$each: /^\d+$/});
    const compiled = await resolver.compile(schema);

    await compiled.validate(['123', '456', '789'], {}, '');
  });

  it('should reject if any element fails', async function() {
    const schema = new Schema('array').validator({$each: /^\d+$/});
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validate(['123', 'abc', '789'], {}, ''),
      ValidationError
    );
  });

  it('should work with validator keywords', async function() {
    const schema = new Schema('array').validator({$each: '$numeric'});
    const compiled = await resolver.compile(schema);

    await compiled.validate(['123', '456'], {}, '');
    await assert.rejects(() => compiled.validate(['123', 'abc'], {}, ''), ValidationError);
  });

  it('should work with nested validators', async function() {
    const schema = new Schema('array').validator({
      $each: {$and: [/^test/, {$length: {min: 5}}]}
    });
    const compiled = await resolver.compile(schema);

    await compiled.validate(['test1', 'test2'], {}, '');
    await assert.rejects(() => compiled.validate(['test', 'test2'], {}, ''), ValidationError);
  });

  it('should transform each element', async function() {
    const schema = new Schema('array').validator({
      $each: (v) => v.toUpperCase()
    });
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate(['a', 'b', 'c'], {}, '');
    assert.deepStrictEqual(result, ['A', 'B', 'C']);
  });

  it('should accept empty array', async function() {
    const schema = new Schema('array').validator({$each: '$numeric'});
    const compiled = await resolver.compile(schema);

    await compiled.validate([], {}, '');
  });

  it('should reject non-array values', async function() {
    const schema = new Schema('string').validator({$each: '$numeric'});
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('not-array', {}, ''), ValidationError);
  });

  it('should generate description', async function() {
    const schema = new Schema('array').validator({$each: /^\d+$/});
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[[/^\\d+$/]...]');
  });
});
