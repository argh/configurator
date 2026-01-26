import assert from 'node:assert';
import { Schema, SchemaResolver } from '../src/index.js';
import { AssertionError } from 'node:assert/strict';

const resolver = new SchemaResolver();

// Implicit Schemas
//
// The "implicit" option is useful when the value defined by the schema should be
// assumed to already exist in the output.  This is commonly needed for computed
// properties and properties with getters but no setters.
//
// (Contrast with the more draconian "opaque" option.)

// Here is a demo class with two properties that shouldn't be assigned directly:

class Thing {
  /** @type {Object.<string,string>} */
  #stuff = {}

  constructor() {
    // let's define a read-only type field the hard way:
    Object.defineProperty(this, 'type', {
      value: 'thing',
      writable: false,
      enumerable: true
    })
  }

  // here's a computed getter:
  get integers() {
    return integerStringList(Object.values(this.stuff));
  }


  // here's a getter for that
  get stuff() {
    return this.#stuff;
  }
  toJSON() {
    return {
      type: 'thing',
      stuff: this.stuff
    }
  }
}

// Ensure we throw exceptions with Thing's illegal assignments:

const testThing = new Thing();
try {
  testThing.stuff = {};
  assert(false, 'Assigning to stuff is supposed to throw an exception!')
}
catch (error) {
  if (! (error instanceof TypeError)) {
    throw error;
  }
}
try {
  testThing.type = 'not-a-thing';
  assert(false, 'Assigning to type is supposed to throw an exception!')
}
catch (error) {
  if (! (error instanceof TypeError)) {
    throw error;
  }
}
try {
  testThing.integers = '123';
  assert(false, 'Assigning to integers is supposed to throw an exception!')
}
catch (error) {
  if (! (error instanceof TypeError)) {
    throw error;
  }
}

const info = 'this should work, of course';
testThing.stuff.info = info;

assert(testThing.stuff.info === info);

testThing.stuff.data = 12345;  // allowed, but yields a type warning

// First attempt: here's a simple schema to convert raw data into a Thing.
// This gets us part of the way there.

const inadequateThingSchema = await resolver.compile(
  new Schema('object')
    .transformer(_ => new Thing())
    .property('type', new Schema('string')
      // We can block attempts to assign "type" to anything that doesn't match the value already returned from Thing.
      .normalizer(input => {
        if (typeof input === 'string') {
          return input.toLowerCase();
        }
        throw new Error('unknown type');
      })
      .validator(value => {
        if (value !== 'thing') {
          throw new Error('not a thing!');
        }
        return value;
      })
    )
    .property('integers', new Schema('string')
      // We can ignore attempts to assign "integers" by ignoring the value provided, always using the value from Thing.
      .normalizer(_ => undefined))
    .property('stuff',
      // Here's where it gets tricky:
      new Schema('object')
        .property('*', new Schema('string')))
);

const harmless = await inadequateThingSchema.process({});
assert(harmless instanceof Thing);
assert(harmless.type === 'thing');

// It's obvious that "test" exists in this input, but it has the same contents after normalization, so isn't reassigned.
const alsoHarmless = await inadequateThingSchema.process({type: 'THING'});
assert (alsoHarmless instanceof Thing);
assert(alsoHarmless.type === 'thing');

// Whereas an incorrect type value is correct caught by the validator.
// (This works, but is kind of verbose.)
try {
  await inadequateThingSchema.process({type: 'not-a-thing'});
  assert(false, 'Should have thrown an error!')
}
catch (error) {
  assert(error?.cause?.message === 'not a thing!');
}

// An attempted assignment to "integers" is ignored:
const ignored = await inadequateThingSchema.process({type: 'thing', integers: 'this makes no sense'});
assert(ignored.integers === '');

// But here's the problem... (this is a little more subtle):

try {
  await inadequateThingSchema.process({stuff: {x: 10, y: 20}})
  assert(false, 'Should not be here, demo should have thrown an error!');
}
catch (error) {
  // So here's the issue: the schema is actually trying to assign stuff = {}!
  if (!(error instanceof TypeError)) { throw error }
}

// We can't even handle an actual Thing:

try {
  const testThing = new Thing();
  testThing.stuff.x = 10;
  testThing.stuff.y = 20;
  await inadequateThingSchema.process(testThing)
  assert(false, 'Should should have thrown an error!');
}
catch (error) {
  if (!(error instanceof TypeError)) { throw error }
}



// Let's fix all these issues.
// 1. Mark "type" as literal to simplify value checking.
// 2. Mark "integers" as implicit so we don't need to throw away the assignment ourselves.
// 3. Mark "stuff" implicit to use the object in Thing but still allow the child assignments.

const betterThingSchema = await resolver.compile(new Schema('object')
  .transformer(value => {
    // we could short-circuit if it's already a Thing, but for this example, let's always make a new one.
    // return (value instanceof Thing)? value : new Thing();
    return new Thing();
  })
  // literals enforce their input, but we will also ensure it isn't reassigned!
  .property('type', Schema.literal('thing'))
  .property('integers', new Schema('string').implicit())
  .property('stuff',
    new Schema('object')
      .implicit()
      .property('*', new Schema('string'))
  )
);

for (const goodInput of [
  {},
  { type: 'thing' },
  { integers: 'ignored'},
  { stuff: {} },
  { stuff: { info } },
  { stuff: undefined },
  { stuff: null },
  { type: 'thing', stuff: { x: 123, y: 456 }}
]) {
  const goodThing = await betterThingSchema.process(goodInput);

  assert(goodThing instanceof Thing);
  assert(goodThing.type === 'thing');

  for (const [k,v] of Object.entries(goodInput.stuff ?? {})) {
    assert(goodThing.stuff[k] === `${v}`);

  }
  assert(goodThing.integers === integerStringList(Object.values(goodThing.stuff)))

  const dogfood = await betterThingSchema.process(goodThing);

  assert.deepStrictEqual(goodThing, dogfood);
}

for (const badInput of [
  { type: 'not-a-thing' },
  { unknown: 'whatever' },
  { type: 'not-a-thing', stuff: {} },
  { stuff: 'nope'}
]) {
  try {
    await betterThingSchema.process(badInput);
    assert(false, 'Should have thrown an exception!');
  }
  catch (error) {
    if (error instanceof AssertionError) {
      throw error;
    }
    // correctly caught, fall through...
  }
}

console.log('lgtm!');

function integerStringList(values = []) {
  return values.filter(v => Number.isInteger(Number(v))).map(v => `${v}`).join(',');

}