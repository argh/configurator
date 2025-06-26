import { STATUS_CODES } from "node:http"

export class ModuleError extends Error {

  constructor(message, data, preserveStack = false) {
    super(message);
    this.data = data;
    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }

    //    const preserveStack = data && data.preserveStack;
    if (!preserveStack) {
      delete this .stack;
    }
  }
  get name() {
    return this.constructor.name;
  }
  get stack() {
    return "";
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  set stack(str) {}
  get cause() {
    return this.data ?? this.data.cause;
  }

  get code() {
    return (
      (this.data && this.data.code) ??
      (this.cause && this.cause instanceof ModuleError && this.cause.code) ??
      500
    );
  }

  toString() {
    if (this.message) {
      return `${this.name}: ${this.message}`;
    } else if (this.cause && this.cause.message) {
      return `${this.name}: ${this.cause.message}`;
    } else {
      return this.name;
    }
  }
}

export class FrameworkHttpError extends ModuleError {
  constructor(message, data) {
    super(message, data);
  }
}

export class InternalError extends ModuleError {
  constructor(message, data) {
    const d = Object.assign({ code: 500 }, data);
    super(message ?? STATUS_CODES[500], d, true);
  }
}

export class NotImplementedError extends InternalError {
  constructor() {
    super("not implemented");
  }
}

export class NotFoundError extends FrameworkHttpError {
  constructor(message = STATUS_CODES[404], data) {
    const d = Object.assign({ code: 404 }, data);
    super(message, d);
  }
}

export class TimeoutError extends ModuleError {
  constructor(message, data) {
    super(message, data);
  }
}

export class BadRequestError extends FrameworkHttpError {
  constructor(message = STATUS_CODES[400], data) {
    const d = Object.assign({ code: 400 }, data);
    super(message, d);
  }
}
