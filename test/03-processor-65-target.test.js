
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Processor: $target', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should return the top-level target, not the current value', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$target'));
    const target = {bird: 'heron'};
    assert.strictEqual(await schema.transformValue('decoy', target), target);
    assert.strictEqual(await schema.transformValue('decoy'), undefined);
  });

  it('should allow a condition to gate a property based on a sibling value', async function() {
    // 'sound' is only produced when the root target has 'active: true'.
    // The condition returns undefined until 'active' is resolved, then truthy/falsy.
    const schema = await resolver.compile(
      new Schema('object')
        .property('active', new Schema('boolean').default(false))
        .property('sound', new Schema('string')
          .condition(['$target', {$get: {path: 'active'}}])
        )
    );

    // active defaults to false → condition is falsy → sound pruned
    const silent = await schema.process({sound: 'chirp'});
    assert.equal(silent.sound, undefined);

    // active: true → condition passes → sound included
    const loud = await schema.process({active: true, sound: 'chirp'});
    assert.equal(loud.sound, 'chirp');
  });
});
