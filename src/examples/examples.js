import process from 'node:process';
import { ModuleManager } from '../module-manager.js';
import { AppModule } from '../app-module.js';
import { Logger } from '@v0.net/argh-logger';
import { setTimeout } from 'node:timers/promises';

class UserWebStorage {
  static moduleInfo = {
    configurables: [
      {field: 'logger', type: Logger},
      {field: 'url', validator: '$url', default: 'http://localhost:1234'},
      {field: 'username', validator: '$alphanum'},
      {field: 'password', validator: '$alphanum'}
    ],
    inject: true,
  }
  constructor() {
    this.enabled = true;
  }

  async init(config) {
    this.logger = config.logger;
  }
  async start() {
    this.logger.info('user web storage starting');
  }
}
class UserLocalStorage {
  static moduleInfo = {
    configurables: [
      {field: 'logger', type: 'Logger'},
      {field: 'path', validator: '$existingdir', default: '/tmp'},
      {field: 'quota', type: 'number', validator: '$integer', default: 100}
    ],
    provides: 'user-storage'
  }
  constructor() {
    this.enabled = true;
  }

  async init(config) {
    this.logger = config.logger;
  }
  async start() {
    this.logger.info('user local storage starting')
  }
}
class UserManager {
  static moduleInfo = {
    configurables: [
      {field: 'logger', type: 'Logger'},
      {field: 'userStorage', type: 'UserStorage', required: true}
    ]
  }
  async init(config) {
    this.logger = config.logger;
  }
}


class MyAppModule extends AppModule {
  static moduleInfo = {
    name: 'myapp',
    configurables: [
      { field: 'debug', type: 'boolean', default: false },
      { field: 'cluster', type: 'string', required: true },
      { field: 'etcd', type: 'string', validator: '$url' },
      { child: 'web', configurables: [
          { field: 'hostname', type: 'string', validator: {$and: ['$hostname', /.+example\.com$/]}, required: true },
          { field: 'port', type: 'number', validator: '$port', default: 443 }
        ]
      },
      { child: 'catalog', configurables: [
          { field: 'path', type: 'string', flagHint: 'P', validator: '$existingdir' },
          { field: 'rating', type: 'number', validator: '$integer' }
        ]
      },
      { field: 'userManager', type: 'user-manager' },
    ],
    inject: true
  }
  constructor() {
    super();
  }


  async main() {
    this.logger.info('app module main, waiting 1 sec');
    await setTimeout(1000);
  }
}


const moduleManager = new ModuleManager();
moduleManager.registerInstance(new Logger({name: 'myapp'}));  // todo - somehow inject the name as a constant?
moduleManager.register(UserWebStorage, {provides: 'user-storage'});
moduleManager.register(UserLocalStorage, {provides: 'user-storage'});
moduleManager.register(UserManager);
moduleManager.register(MyAppModule);
moduleManager.registerInstance({
  init: (config) => { config.logger.info('hello', config)}
}, {name: 'thingie', configurables: [{field: 'logger', type: 'logger'}]})


//moduleManager.configurator.types.defineType('user-storage', (value) => {

//}, {isModule: true})

await moduleManager.run({
  defaults: {
    userLocalStorage: {
      path: '/tmp/',
      quota: 5000
    }
  },
  env: {
    MYAPP_CLUSTER: 'live'
  },
  argv: [
    '--user-web-storage-url', 'http://192.168.1.1:2379/',
    '--user-web-storage-username', 'user123',
    '--user-web-storage-password', 'password123456',
    '--web-hostname', 'test.example.com',
    '--logger-format', 'json'
  ]
});


class Pet {
  static moduleConfigurables = [{field: 'logger', type: 'Logger', required: true}, {field: 'enabled', type: 'boolean'}];
  static moduleInject = true;
  static moduleProvides = 'Pet'

  /** type {Logger} */
  logger;
  speak() {
    this.logger.error('not implemented');
  }
}

class Cat extends Pet {
  speak() {
    this.logger.info('meow');
  }
}

class Dog extends Pet {
  speak() {
    this.logger.info('woof');
  }
}

class PetGreeter extends AppModule
{
  static moduleInfo = {
    configurables: [{field: 'pet', type: Pet, required: true}, {field: 'w', type: 'WOOT', required: true}],
    inject: true
  };

  /** type {Pet} */
  pet;

  main() {
    this.logger.info(`pet greeter main: ${this.w}`);
    if (this.pet) {
      this.pet.speak();
    }
    else {
      this.logger.info('no pet');
    }
  }
}


const mm2 = new ModuleManager();
mm2.register(Logger);
mm2.register(Cat, {exclusive: 'fren'});
mm2.register(Dog, {exclusive: 'fren'});
mm2.registerAlias('Pet', (alias, config, type) => {
  if (config.cat) {
    return 'cat';
  }
  else if (config.dog) {
    return 'dog';
  }
  else {
    return undefined;
  }
})
mm2.register(PetGreeter);
mm2.registerConstant('WOOT', 'yeah yeah yeah')

mm2.run({
  argv: [
    '--cat-enabled'
  ]
})


await moduleManager.run();

