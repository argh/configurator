
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: and', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept value matching all conditions', async function() {
    const schema = new Schema('string').validator({
      and: [/^test/, /test$/]
    });
    const compiled = await resolver.compile(schema);

    await compiled.validate('test', {}, '');
    await compiled.validate('testest', {}, '');
  });

  it('should chain validators and pass value through', async function() {
    const schema = new Schema('string').validator({
      and: [
        (v) => v.toLowerCase(),
        /^hello$/
      ]
    });
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('HELLO', {}, '');
    assert.strictEqual(result, 'hello');
  });

  it('should reject when first condition fails', async function() {
    const schema = new Schema('string').validator({
      and: [/^test/, /end$/]
    });
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validate('other', {}, ''),
      ValidationError
    );
  });

  it('should reject when second condition fails', async function() {
    const schema = new Schema('string').validator({
      and: [/^test/, /end$/]
    });
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled.validate('test', {}, ''),
      ValidationError
    );
  });

  it('should combine multiple validators', async function() {
    const schema = new Schema('string').validator({
      and: ['$alpha', /^[a-z]+$/, {length: {min: 3}}]
    });
    const compiled = await resolver.compile(schema);

    await compiled.validate('abc', {}, '');
    await assert.rejects(() => compiled.validate('ab', {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate('ABC', {}, ''), ValidationError);
  });

  it('should generate combined description', async function() {
    const schema = new Schema('string').validator({
      and: [/^test/, /end$/]
    });
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[/^test/ & /end$/]');
  });
});