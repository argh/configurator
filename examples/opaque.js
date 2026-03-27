import { Schema, SchemaResolver } from '../src/index.js';
import { SchemaPolicy } from '../src/schema/schema.js';

import assert from 'node:assert/strict';
import { NormalizeError, SchemaError } from '../src/schema/schema-errors.js';

// Opaque Schemas
//
// The "opaque" option is used when the schema defines a value that should not
// have any internals inspected after it has been transformed.  This is only
// relevant for schemas defining children, as primitives are always opaque.
//
// The most common reason for needing to mark a schema as opaque is when the
// transformed value is so different that it would violate the schema definition.
//
// One very important consequence (or useful behavior) of opaque schemas is that
// internal values are not assigned incrementally, all child properties are collected
// and passed as the input to the transform.
//
// If only some properties become inaccessible post-transform, consider using
// the "implicit" option instead.

const resolver = new SchemaResolver();

// Let's make a variant of the number schema that accepts integers and two-digit hex strings.
// Note that we need to prepend our normalizer in front of the regular number schema normalizer
// to enforce our rules early.
const hexByteSchema = resolver.resolve(new Schema('number'))
                              .normalizers([
                                  {$any: ['$integer', '$hex']},
                                  (input => (typeof input === 'string')? parseInt(input, 16) : input)
                                ],
                                SchemaPolicy.PREPEND
                              )
                              .validator({$all: ['$integer', {$range: {min:0, max:255}}]})

// And then mangle that into a schema that transforms to the hex string.
// (Yes, we could have combined these rules into a single schema up front!)
// Because this is a primitive (schema has no child properties) it already
// behaves as if it were opaque, so changing from number to string isn't
// a problem.
const colorComponentSchema = new Schema(hexByteSchema)
  .default(0)
  .transformer(value => Number(value).toString(16).padStart(2, '0'))
  .validators([{$matches: /[0-9a-f]{2}/i}, '$lowercase'], SchemaPolicy.OVERWRITE)

// This schema is where it gets interesting; we're changing from a container (with properties)
// to a primitive, so we need to mark it as opaque so that we don't try to assign the colors
// incrementally.

const colorObjectSchema = await resolver.compile(
  new Schema('any')
    .property('red', colorComponentSchema)
    .property('green', colorComponentSchema)
    .property('blue', colorComponentSchema)
    .transformer(input => {
      if (input?.red === undefined || input?.green === undefined || input?.blue === undefined) {
        // This will never happen if opaque is set.
        throw new Error('Cannot transform a partial color!');
      }
      return `#${input.red}${input.green}${input.blue}`;
    })
    .validator({$matches: /^#[a-f0-9]{6}$/i})
    .opaque()  // if you comment this line out, the above transform will throw!
);

const yellow = {red: 255, green: 255}

const yellowHexString = await colorObjectSchema.process(yellow)
assert(yellowHexString === '#ffff00');

try {
  // unfortunately, the above schema can't digest its own output!  Observe...
  await colorObjectSchema.process(yellowHexString);
}
catch (error) {
  // expected at this point.
  assert(error instanceof NormalizeError);
}

// So let's make a schema that accepts both.
//
// Instead of marking red/green/blue as implicit, we can leave the color object
// as opaque, but create a union that can accept either format:

const hybridColorSchema = await resolver.compile(
  new Schema('any')
    .unionSchema('color-object', colorObjectSchema)
    .unionSchema('color-string',
      new Schema('string').validator({$matches: /^#[a-f0-9]{6}$/i})
    )
    .unionDiscriminator((value, target, location) =>
      location.schema.getUnionSchema(`color-${typeof value}`)
    )
)

assert(await hybridColorSchema.process(yellow) === yellowHexString);
assert(await hybridColorSchema.process(yellowHexString) === yellowHexString);

try {
  const result = await hybridColorSchema.process(123);
  assert(false, 'Oops, should have thrown a union resolution error!')
}
catch (error) {
  assert(error instanceof SchemaError);
  // expected.
}
console.log('lgtm!');
