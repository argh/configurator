
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

import { ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: not', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept value that fails inner validator', async function() {
    const schema = new Schema('string').validator({
      $assert: {$not: /^test/}
    });
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('other');
    await compiled.validateValue('something');
  });

  it('should reject value that passes inner validator', async function() {
    const schema = new Schema('string').validator({
      $assert: {$not: /^test/}
    });
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validateValue('test123'),
      ValidationError
    );
  });

  it('should invert numeric validator', async function() {
    const schema = new Schema('string').validator({
      $assert: {$not: '$numeric'}
    });
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('abc');
    await assert.rejects(() => compiled.validateValue('123'), ValidationError);
  });

  it('should generate negated description', async function() {
    const schema = new Schema('string').validator({
      $assert: {$not: /^test/}
    });
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.validatorDescription, '!/^test/');
  });

  it('should add parentheses for complex descriptions', async function() {
    const schema = new Schema('string').validator({
      $assert:{$not: {$and: [/^a/, /b$/]}}
    });
    const compiled = await resolver.compile(schema);

    assert.ok(compiled.metadata.validatorDescription.startsWith('!('));
  });
});