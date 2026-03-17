
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: suffix', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // missing required match parameter
    await assert.rejects(() => resolver.compile(new Schema('any').validator('$suffix')), SchemaError);
    await assert.rejects(() => resolver.compile(new Schema('any').validator({$suffix: {}})), SchemaError);

    // unknown parameter
    await assert.rejects(
      () => resolver.compile(new Schema('any').validator({$suffix: {unexpected: 'foo'}})),
      SchemaError
    );
  });

  it('should pass through the input when it ends with the required suffix', async function() {
    const schema = await resolver.compile(new Schema('any').validator({$suffix: {match: '.json'}}));

    assert.strictEqual(await schema.validateValue('config.json'), 'config.json');
    assert.strictEqual(await schema.validateValue('path/to/config.json'), 'path/to/config.json');
    assert.strictEqual(await schema.validateValue('.json'), '.json'); // exact match is also valid

    // shorthand positional: {$suffix: 'foo'} treated as {$suffix: {match: 'foo'}}
    const shorthand = await resolver.compile(new Schema('any').validator({$suffix: '.json'}));
    assert.strictEqual(await shorthand.validateValue('config.json'), 'config.json');
  });

  it('should throw for values that do not end with the required suffix', async function() {
    const schema = await resolver.compile(new Schema('any').validator({$suffix: {match: '.json'}}));

    await assert.rejects(() => schema.validateValue('config.yaml'), ValidationError);
    await assert.rejects(() => schema.validateValue('config.JSON'), ValidationError); // case-sensitive
    await assert.rejects(() => schema.validateValue(''), ValidationError);
    await assert.rejects(() => schema.validateValue('json.config'), ValidationError); // prefix, not suffix
  });
});
