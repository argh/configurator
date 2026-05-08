// Copyright 2026 Version Zero | github.com/argh
// SPDX-License-Identifier: Apache-2.0

export { Configurator } from './configurator.js';
export { ConfigurationSource } from './configuration-sources/configuration-source.js';
export { ConfiguratorError } from './errors.js'

// Re-export from schema for backward compatibility
export { CompiledSchema, Schema, SchemaPolicy, SchemaError, SchemaResolver, SchemaLocation, EMPTY } from '@versionzero/schema';

export * as sources from './configuration-sources/index.js';

