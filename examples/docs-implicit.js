// example for docs

import { Schema, SchemaResolver } from '../src/index.js';

class Thing {
  #stuff = {}

  get stuff() {
    return this.#stuff;
  }
  set stuff(_) {
    throw new Error('assignment disallowed!')
  }
}

const srcSchema = new Schema('object')
  .transformer((_) => new Thing())
  .property('stuff',
    new Schema('object')
      .implicit()
      .property('*', new Schema())
  );

const resolver = new SchemaResolver();
const compiledSchema = await resolver.compile(srcSchema);

const input = {stuff: {a: 1, b: 2}};
const result = await compiledSchema.process(input);

if (result?.stuff?.a === input.stuff.a && result?.stuff?.b === input.stuff.b) {
  console.log('ok!');
}
else {
  console.error('oops!');
  throw new Error('something went wrong!')
}
