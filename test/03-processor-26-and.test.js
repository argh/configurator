
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

import { ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: and', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept value matching all conditions', async function() {
    const schema = new Schema('string').validator({
      $and: [{$matches: /^test/}, {$matches: /test$/}]
    });
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('test');
    await compiled.validateValue('testest');
  });

  it('should return original value if everything passes and not chain value', async function() {
    const schema = new Schema('string').validator({
      $and: [
        (v) => v.toLowerCase(),
        {$matches: /^hello$/i}
      ]
    });
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue('HELLO');
    assert.strictEqual(result, 'HELLO');
  });

  it('should reject when first condition fails', async function() {
    const schema = new Schema('string').validator({
      $all: [{$matches: /^test/}, {$matches: /end$/}]
    });
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validateValue('other'),
      ValidationError
    );
  });

  it('should reject when second condition fails', async function() {
    const schema = new Schema('string').validator({
      $and: [{$matches: /^test/}, {$matches: /end$/}]
    });
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validateValue('test'),
      ValidationError
    );
  });

  it('should combine multiple validators', async function() {
    const schema = new Schema('string').validator({
      $and: ['$alpha', {$matches: /^[a-z]+$/}, {$length: {min: 3}}]
    });
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('abc');
    await assert.rejects(() => compiled.validateValue('ab'), ValidationError);
    await assert.rejects(() => compiled.validateValue('ABC'), ValidationError);
  });

  it('should generate combined description', async function() {
    const schema = new Schema('string').validator({
      $and: [{$matches: /^test/}, {$matches: /end$/}]
    });
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[/^test/ & /end$/]');
  });
});