"use strict";
import { EventEmitter } from 'node:events';

import { Logger } from '@v0.net/argh-logger';
import { setTimeout } from 'node:timers/promises';

/**
 * @module AppModule
 * Provides application-level services, including a Bunyan logger and a shutdown signal.
 */

export class AppModule extends EventEmitter
{
  static get moduleInfo() {
    return {
      name: 'app',
      configurables: [
        {field: 'devMode', type: 'boolean', hidden: true},
        {field: 'logger', type: 'Logger'},
        {field: 'moduleManager', type: 'ModuleManager'},
        {field: 'tickRate', type: 'number', default: 30000, hidden: true},
      ],
      inject: true
    }
  }
  static get moduleIsMain() {
    return true;
  }
  tickRate = 30000;
  devMode = false;
  running = false;

  abortController = new AbortController();

  /** @type { (unknown) => void } */
  _shutdown;

  /** @type { Logger } */
  logger;

  constructor(appName) {
    super({captureRejections: true});
    this.appName = appName;

    this._shutdownPromise = new Promise(resolve => {
      this._shutdown = resolve;
    });

    this.on('error', err => {
      if (this.logger) {
        this.logger.error(err);  // todo - move event setup to init?
      }
    })
  }

  async init(config) {
    this.updateHooks();
    this.config = config;
  }

  async _tick() {
    // if you don't want to implement main, you can override this to have it called periodically
  }

  async main() {
    this.running = true;
    if (!this.runningPromise) {
      this.runningPromise = new Promise((resolve, reject) => {
        this._resolve = resolve;
        this._reject = reject;
      }).finally(() => {
        this.running = false;
      });
    }
    let loop = () => {
      this._tick().catch(err => {
        if (this._reject) {
          this._reject(err);
        }
      })

      Promise.race([setTimeout(this.tickRate, this.runningPromise)])
             .finally(() => {
               if (this.running) {
                 //this.heartbeat();
                 loop();
               }
             })
    }
    loop();

    return Promise.resolve();
  }

  /**
   * Signal application shutdown.
   */
  stop() {
    if (this.running) {
      this.running = false;
      this._shutdown();
    }
  }

  /**
   * Lifecycle terminate hook.
   */
  async terminate() {
    this.logger.info('Application terminated');
  }




  /**
   * Await application shutdown signal.
   */
  async waitForStop() {
    await this._shutdownPromise;
  }



  done(code) {
    this.abortController.abort();
    this.exitCode = code || 0;
    if (this._resolve) {
      this._resolve();
    }
  }

  /**
   *
   * @param {Error} err
   * @param {number} [code]
   */
  fatal(err, code) {
    this.abortController.abort();
    this.exitCode = code || 1;
    if (this._reject) {
      this._reject(err);
    }
  }
  async _ste(code) {
    // ? if (this.runningPromise) {}
    try {
      await this.stop();
    } catch (err) {
      this.logger.warn(err);
    }
    try {
      await this.terminate();
    } catch (err) {
      this.logger.warn(err);
    }
    process.exit(code);
  }

  _handleUncaughtException(err) {
    this.logger.fatal({err}, 'uncaught exception');

    if (err && !(err instanceof Error)) {
      err = new Error(err.toString());
    }
    this.fatal(err, 1);

    //        this._ste(1);
  }

  _handleUnhandledRejection(err, promise) {
    this.logger.fatal('unhandled rejection', err, promise);
    this.fatal(new Error('unhandled rejection'), 1);

    //        this._ste(1);
  }

  _handleSIGINT() {
    this.logger.info('[SIGINT]');
    this.done(0);
    //        this._ste(0);
  }

  _handleSIGTERM() {
    this.logger.info('[SIGTERM]');
    this.done(0);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    void this._ste(0);
  }

  _handleSIGQUIT() {
    this.logger.info('[SIGQUIT]');
    this.done(0);
    void this._ste(0);
  }

  _handleSIGUSR2() {
    this.logger.info('[SIGUSR2]');

    // FIXME / TODO

    /*
    let level;

    if (this.savedLogLevel) {
      level = formatLogLevel(this.savedLogLevel);
      delete this.savedLogLevel;
    } else {
      level = formatLogLevel(LogLevel.TRACE);
      this.savedLogLevel = this.log.level;
    }

    this.initModules({logLevel: level.toLowerCase()})
        .then(() => {
          this.log.info('set log level to ' + level);
        })
        .catch((err) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          this.log.error({err: err}, 'error reinitializing with new log level ' + level);
        });

     */
  }

  _handleSIGHUP() {
    this.logger.info('[SIGHUP]');

    // FIXME: initModules isn't on this class, it's on modulemanager
    this.initModules()
        .then(() => {
          this.logger.info('re-initialization succeeded');
        })
        .catch((err) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          this.logger.error({err: err}, 're-initialization failed');
        });
  }

  updateHooks() {
    if (this._unhandledRejectionHandler) {
      process.removeListener('unhandledRejection', this._unhandledRejectionHandler);
      delete this._unhandledRejectionHandler;
    }
    if (this._uncaughtExceptionHandler) {
      process.removeListener('uncaughtException', this._uncaughtExceptionHandler);
      delete this._uncaughtExceptionHandler;
    }
    if (this._sigintHandler) {
      process.removeListener('SIGINT', this._sigintHandler);
      delete this._sigintHandler;
    }
    if (this._sigtermHandler) {
      process.removeListener('SIGTERM', this._sigtermHandler);
      delete this._sigtermHandler;
    }
    if (this._sigquitHandler) {
      process.removeListener('SIGQUIT', this._sigquitHandler);
      delete this._sigquitHandler;
    }
    if (this._sigusr2Handler) {
      process.removeListener('SIGUSR2', this._sigusr2Handler);
      delete this._sigusr2Handler;
    }
    if (this._sighupHandler) {
      process.removeListener('SIGHUP', this._sighupHandler);
      delete this._sighupHandler;
    }

    if (!this.devMode) {
      /*
      this._uncaughtExceptionHandler = this._handleUncaughtException.bind(this);
      process.on('uncaughtException', this._uncaughtExceptionHandler);

      this._unhandledRejectionHandler = this._handleUnhandledRejection.bind(this);
      process.on('unhandledRejection', this._unhandledRejectionHandler);
*/
      this._sigintHandler = this._handleSIGINT.bind(this);
      process.on('SIGINT', this._sigintHandler);

      this._sigtermHandler = this._handleSIGTERM.bind(this);
      process.on('SIGTERM', this._sigtermHandler);

      this._sigquitHandler = this._handleSIGQUIT.bind(this);
      process.on('SIGQUIT', this._sigquitHandler);

      this._sigusr2Handler = this._handleSIGUSR2.bind(this);
      process.on('SIGUSR2', this._sigusr2Handler);

      this._sighupHandler = this._handleSIGHUP.bind(this);
      process.on('SIGHUP', this._sighupHandler);
    }
  }
}
