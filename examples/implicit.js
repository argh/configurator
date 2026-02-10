import assert from 'node:assert';
import { Schema, SchemaResolver } from '../src/index.js';
import { AssertionError } from 'node:assert/strict';
import { ValidationError } from '../src/errors.js';

const resolver = new SchemaResolver();

// Implicit Schemas
//
// The "implicit" option is useful when the value defined by the schema should be
// assumed to already exist in the output.  This is commonly needed for computed
// properties and properties with getters but no setters.
//
// (Contrast with the more draconian "opaque" option.)

// Here is a demo class with three properties that shouldn't be assigned directly:

class Thing {
  constructor() {
    // let's define a read-only type field the hard way:
    Object.defineProperty(this, 'type', {
      value: 'thing',
      writable: false,
      enumerable: true
    })
  }

  // here's a computed getter:
  get name() {
    return `${this.stuff.firstName ?? "Unknown"} ${this.stuff.lastName ?? "Unknown"}`
  }

  /** @type {{[key:string]: string}} */
  #stuff = {}
  // here's a getter for that private field
  get stuff() {
    return this.#stuff;
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
  testThing.name = 'Fred Johnson';
  assert(false, 'Assigning to name is supposed to throw an exception!')
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
      // Requiring assignment values to exactly match the existing value cause them to be skipped.
      .normalizer('$lowercase')
      .validator('thing')
    )
    .property('name', new Schema('string')
      // We can ignore attempts to assign "name" by explicitly pruning it
      .normalizer(null))
    .property('stuff',
      // Here's where it will fall apart...
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

// Whereas an incorrect type value is correctly caught by the validator.
// (This works but is kind of verbose.)
try {
  await inadequateThingSchema.process({type: 'not-a-thing'});
  assert(false, 'Should have thrown an error!')
}
catch (error) {
  assert(error instanceof ValidationError);
}

// An attempted assignment to "name" is ignored:
const ignored = await inadequateThingSchema.process({type: 'thing', name: 'John Doe'});
assert(ignored.name === 'Unknown Unknown');

// But here's the problem... (this is a little more subtle):
try {
  await inadequateThingSchema.process({stuff: {x: 10, y: 20}})
  assert(false, 'Should not be here, demo should have thrown an error!');
}
catch (error) {
  // The issue: the schema is actually trying to assign stuff = {}!
  // We can't use the "nullify assignment" trick because we actually need a normalized value
  // to hold pending child assignments.
  if (!(error instanceof TypeError)) { throw error }
}

// This also means we can't even handle an actual Thing instance:

try {
  const testThing = new Thing();
  testThing.stuff.x = 10;
  testThing.stuff.y = 20;
  await inadequateThingSchema.process(testThing)
  assert(false, 'Should should have thrown an error!');
}
catch (error) {
  // expected...
  if (!(error instanceof TypeError)) { throw error }
}



// Let's fix all these issues.
// 1. Mark "type" as literal to simplify value checking.
// 2. Mark "name" as implicit so we don't need to nullify the assignment.
// 3. Mark "stuff" implicit to use the object in Thing but still allow the child assignments.

const betterThingSchema = await resolver.compile(new Schema('object')
  .transformer(value => {
    // we could short-circuit if it's already a Thing, but for this example, let's always make a new one.
    // return (value instanceof Thing)? value : new Thing();
    return new Thing();
  })
  // literals enforce their input, but we will also ensure it isn't reassigned!
  .property('type', Schema.literal('thing'))
  .property('name', new Schema('string').implicit())
  .property('stuff',
    new Schema('object')
      .implicit()
      .property('*', new Schema('string'))
  )
);

for (const goodInput of [
  {},
  { type: 'thing' },
  { name: 'ignored'},
  { stuff: {} },
  { stuff: { info } },
  { stuff: { firstName: 'Camina', lastName: 'Drummer' }},
  { stuff: undefined },
  { stuff: null },
  { type: 'thing', stuff: { x: 123, y: 456, firstName: 'James', lastName: 'Holden' }}
]) {
  const goodThing = await betterThingSchema.process(goodInput);

  assert(goodThing instanceof Thing);
  assert(goodThing.type === 'thing');

  for (const [k,v] of Object.entries(goodInput.stuff ?? {})) {
    assert(goodThing.stuff[k] === `${v}`);

  }
  if (goodThing.stuff.firstName && goodThing.stuff.lastName) {
    assert(goodThing.name === `${goodThing.stuff.firstName} ${goodThing.stuff.lastName}`);
  }

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

