
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $values', function() {
  /** @type {SchemaResolver} */
  let resolver;
  /** @type {import('../src/schema/compiled-schema.js').CompiledSchema} */
  let schema;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    schema = await resolver.compile(new Schema('any').transformer('$values'));
  });

  it('should return the enumerable own values of a plain object', async function() {
    assert.deepStrictEqual(await schema.transformValue({apple: 1, banana: 2, cherry: 3}), [1, 2, 3]);
    assert.deepStrictEqual(await schema.transformValue({}), []);
  });

  it('should throw for non-object inputs', async function() {
    await assert.rejects(() => schema.transformValue([1, 2, 3]), TransformError);
    await assert.rejects(() => schema.transformValue('apple'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
  });
});
