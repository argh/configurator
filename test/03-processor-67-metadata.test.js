
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

describe('Processor: $metadata', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject missing required "name" parameter at compile time', async function() {
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer('$metadata')),
      SchemaError
    );
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$metadata: {schema: 'irrelevant'}})),
      SchemaError
    );
  });

  it('should extract named metadata from the current schema', async function() {
    const schema = await resolver.compile(
      new Schema('string')
        .meta('flavor', 'grape')
        .transformer({$metadata: 'flavor'})
    );
    // The transformer ignores the input and returns the schema metadata
    assert.strictEqual(await schema.transformValue('anything'), 'grape');
  });

  it('should return undefined for metadata keys that do not exist', async function() {
    const schema = await resolver.compile(
      new Schema('string').transformer({$metadata: 'no-such-key'})
    );
    assert.strictEqual(await schema.transformValue('anything'), undefined);
  });

  it('should throw when an explicit schema arg is not a CompiledSchema', async function() {
    const schema = await resolver.compile(
      new Schema('string').transformer({$metadata: {name: 'flavor', schema: '$input'}})
    );
    // $input returns the string input value — not a CompiledSchema — so $metadata should throw
    await assert.rejects(() => schema.transformValue('not-a-schema'), SchemaError);
  });

  it('should extract metadata from a sibling schema via $find-schema', async function() {
    // A child property uses [$find-schema, $metadata] to read metadata defined on a sibling.
    const schema = await resolver.compile(
      new Schema('object')
        .property('fruit', new Schema('string').meta('color', 'red'))
        .property('fruit-color', new Schema('any')
          .transformer([{'$find-schema': '^.fruit'}, {'$metadata': {name: 'color', schema: '$input'}}])
        )
    );
    const result = await schema.process({fruit: 'apple', 'fruit-color': 'placeholder'});
    assert.strictEqual(result['fruit-color'], 'red');
  });
});
