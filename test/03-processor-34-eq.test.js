
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, ValidationError } from '../src/schema/schema-errors.js';

/**
 * Canonical example of the "canary" test approach for parameterized processors:
 *
 * - One test per maintainer concern, with multiple assertions per scenario variation.
 * - Bad-config cases assert on resolver.compile() (SchemaError throws at compile time).
 * - Value tests use varied but non-exhaustive inputs — the deep equality algorithm
 *   itself is not under test here; we trust the shared deepEquals utility.
 * - Parameter form variety (primitive spec, keyword spec, named object, dynamic function)
 *   is exercised as a side effect of testing the constraint's behavior, not exhaustively.
 */
describe('Processor: eq', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // missing required value parameter
    await assert.rejects(() => resolver.compile(new Schema('any').validator('$eq')), SchemaError);
    await assert.rejects(() => resolver.compile(new Schema('any').validator({$eq: {}})), SchemaError);

    // unknown or excess parameters
    await assert.rejects(() => resolver.compile(new Schema('any').validator({$eq: {unexpected: 123}})), SchemaError);
    await assert.rejects(() => resolver.compile(new Schema('any').validator({$eq: [123, 456]})), SchemaError);
  });

  it('should pass through the input when it deep-equals the constraint value', async function() {
    // named object param: {$eq: {value: X}}
    const strSchema = await resolver.compile(new Schema('any').validator({$eq: {value: 'finch'}}));
    assert.strictEqual(await strSchema.validateValue('finch'), 'finch');

    // primitive spec shorthand: {$eq: true} — bundled as implicit first positional arg
    const boolSchema = await resolver.compile(new Schema('any').validator({$eq: true}));
    assert.strictEqual(await boolSchema.validateValue(true), true);

    // keyword spec: {$eq: {$literal: X}} — $literal wraps an otherwise-ambiguous constant
    const arrSchema = await resolver.compile(new Schema('any').validator({$eq: {$literal: ['robin', 'wren']}}));
    assert.deepStrictEqual(await arrSchema.validateValue(['robin', 'wren']), ['robin', 'wren']);

    // processor spec as value: the comparison target is computed by running the spec against the input.
    // {$eq: "$lowercase"} means "input must already equal its own lowercased form" (i.e. must be lowercase).
    const lcSchema = await resolver.compile(new Schema('string').validator({$eq: '$lowercase'}));
    assert.strictEqual(await lcSchema.validateValue('sparrow'), 'sparrow');

    // complex positional param with multiple nested processors
    const complexSchema = await resolver.compile(
      new Schema('object')
        .validator({$eq: [{one: 'finch', two: async () => 'sparrow', three: {$pipeline: ['THRUSH', '$lowercase']}}]})
        .property('one', new Schema('string').default('finch'))
        .property('two', new Schema('string'))
        .property('three', new Schema('string'))
    );
    assert.deepEqual(await complexSchema.validateValue({one: 'finch', two: 'sparrow', three: 'thrush'}), {one: 'finch', two: 'sparrow', three: 'thrush'});
  });

  it('should throw for values that do not deep-equal the constraint value', async function() {
    const schema = await resolver.compile(new Schema('any').validator({$eq: {value: 'finch'}}));

    await assert.rejects(() => schema.validateValue('sparrow'), ValidationError);
    await assert.rejects(() => schema.validateValue(42), ValidationError);
    await assert.rejects(() => schema.validateValue(['finch']), ValidationError); // array ≠ string

    // computed spec: input that does not already equal its lowercased form
    const lcSchema = await resolver.compile(new Schema('string').validator({$eq: '$lowercase'}));
    await assert.rejects(() => lcSchema.validateValue('Sparrow'), ValidationError);
  });
});
