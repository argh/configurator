import { toCamelCase, toKebabCase } from '../utils.js';
import { ConfigurationSource } from './configuration-source.js';
import { ConfiguratorError } from '../errors.js';
import { CompiledSchema } from '../schema/compiled-schema.js';

/**
 * CommandLineSource - parse configuration assignments from the command line
 *
 * This source converts the schema into a set of kebab-cased options, aliases, and flags.
 * If an appName is provided in the context, and it matches a top-level property name, this is truncated for
 * aesthetics.
 *
 * Options and aliases are specified with double hyphen (`--option` or `--xy`) and flags with a single hyphen (`-F`).
 * Values may be defined after the option or flag (`--option value` or `-F value`) or inline with an equals sign
 * (`--option=value` or `-F=value`).  Boolean schemas make the "true" value optional (`--debug true`, `--debug=true`, and `--debug`
 * all do the same thing, as with `-D true`, `-D=true`, or `-D`).  Flags may be consolidated, `-x -y` is the same as `-xy` for
 * boolean flags.  If you specify an inline value for the consolidated flags, they all share the value; `--xy=false`
 * is the same as `-x false -y false`.  If a flag requires an argument, it needs to be the last flag in the sequence.
 *
 * Flag and alias allocation is on an opportunistic basis for "non-advanced" options based on the sequence of definition.
 *
 * A schema can define "flagHint" metadata to request a specific flag.  Otherwise, options at the "top level"
 * (either at the schema top level or within the appName child) are allocated a single character flag, first
 * checking for the availability of the lower-case flag, then the upper-case version.
 *
 * Schemas at deeper hierarchy levels get allocated an alias based on the leading characters of their kebab-cased option.
 *
 * This source pays special attention to schema selectors and selections; whenever a selector is defined, it establishes
 * independent parsing contexts for each possible selection.  Selections do not require a leading hyphen, and thus
 * look like "commands".
 *
 * Additional Metadata
 *
 * - advanced          - only list with --help advanced
 * - hidden            - option exists, but does not show up in --help or --help advanced
 * - general           - mark as a bare option without hyphen; typically used for gathering array values
 * - internal          - do not generate a command-line option at all
 * - description       - help description of the property
 * - valueDescription  - help description of the value and its constraints
 */
export class CommandLineSource extends ConfigurationSource
{
  /**
   * @typedef {Object} CommandLineSourceOptions
   * @property {number} [sequence] - Sequence number of the source.  Defaults to ARGUMENTS (currently 500).
   * @property {string} [contextName] - Name of the property (default:"argv") in the context object that contains the command line arguments
   */

  /**
   * @param {CommandLineSourceOptions} [options]
   */
  constructor(options = {}) {
    super({...options, name: 'command-line-source', sequence: options.sequence || ConfigurationSource.DefaultSequence.ARGUMENTS});

    this.contextName = options.contextName ?? 'argv'
  }

  /** generate command line options, including flags and aliases
   * @param {CompiledSchema} schema
   * @param {string} [appName] - name of the app
   * @returns {ParsingContext}
   * @private
   */
  _generateOptions(schema, appName) {
    const walked = new Set();
    /**
     * @param {CompiledSchema} schema
     * @param {string} path
     * @param {ParsingContext} ctx
     */
    function walk(schema, path, ctx) {
      if (walked.has(schema)) {
        return ctx;
      }
      walked.add(schema);
      // The schema hierarchy defines a tree of objects containing configurable properties, but in some cases, the
      // activation of those objects is controlled by an implicit hierarchy of commands, where the application itself
      // acts as the "root command" that owns the first-level schema.  For command-line processing, we make that
      // command hierarchy explicit.

      if (schema.hasChildren && !schema.isArray) {
        for (const propertyName in schema.properties) {
          const childSchema = schema.properties[propertyName];
          if (propertyName === '*') {
            continue;  // shouldn't happen; array elements are handled as an aggregated parsed value
          }
          if (childSchema.isInherited || childSchema.metadata.internal) {
            continue;
          }

          const childPath = path ? `${path}.${propertyName}` : `${propertyName}`;

          if (childSchema.isSelection) {
            // todo - think about how to not duplicate this logic from the selection condition internals
            const selection = (childSchema.selection === true)? propertyName : childSchema.selection;

            const childSelectionContext = new ParsingContext(appName, ctx, childPath);
            walk(childSchema, childPath, childSelectionContext);
            ctx.selectionContextMap.set(selection, childSelectionContext);
          }
          else {
            walk(childSchema, childPath, ctx);
          }
        }
        ctx.updateShortOptions();
      }
      else {
        if (schema.options.selector) {
          ctx.setSelector(path, schema);
        }
        else if (schema.metadata.general) {
          ctx.setGeneral(path, schema);
        }
        else {
          ctx.addLongOption(path, schema);
        }
      }
      return ctx;
    }
    const initialParsingContext = new ParsingContext(appName);

    return walk(schema, '', initialParsingContext);
  }


  /**
   * @param {CompiledSchema} schema
   * @param {Object} context
   * @param {{strict: [boolean]}} [loadOptions]
   * @returns {Promise<Map<string, any>>}
   */
  async load(schema, context, loadOptions) {
    const appName = context?.appName;
    
    const argv = context[this.contextName] ?? process.argv;

// Skip 'node' and script name if this looks like process.argv
    const args = argv.length >= 2 && argv[0].includes('node') ? argv.slice(2) : argv;

    const propertyAssignments = new Map();
    const generalValues = [];

    const prefix = toCamelCase(appName);

    let ctx = this._generateOptions(schema, prefix);

    let i = 0;

    const getArgument = () => {
      if (i < args.length) {
        const ret = args[i];
        i++;
        return ret;
      }
      /* c8 ignore next 3: should never happen */
      else {
        return null;
      }
    }
    const peekArgumentValue = (incrementIfFound = false) => {
      try {
        const ret = (i < args.length && (args[i] === '-' || `${args[i]}`.charAt(0) !== '-')) ? args[i] : null;
        if (ret && incrementIfFound) {
          i++;
        }
        return ret;
      }
      /* c8 ignore next 3 */
      catch (err) {
        return null;
      }
    }

    const searchContextTree = (option) => {
      function walkContext(currentCtx) {
        if (currentCtx.clOptions.has(option) || currentCtx.clAliases.has(option) || currentCtx.clFlags.has(option)) {
          return true;
        }
        for (const [selection, selectionContext] of currentCtx.selectionContextMap) {
          if (selection === option) {
            return true;
          }
          if (walkContext(selectionContext)) {
            return true;
          }
        }
      }
      return walkContext(ctx);
    }

    const handleOptionValue = (option, optionData, inlineValue, checkArguments, ctx) => {
      let value;

      if (optionData.isHelp) {
        let showAdvanced = false;
        if (inlineValue === 'advanced') {
          showAdvanced = true;
        }
        else if (checkArguments && peekArgumentValue(true) === 'advanced') {
          showAdvanced = true;
        }
        console.log(this._help(schema, context, showAdvanced));
        process.exit(0);
      }

//      else if (optionData.isConfig) {
//        const configPath = inlineValue ?? (checkArguments? peekArgumentValue(true) : undefined);

//        if (!configPath) {
//          throw new CommandLineError(`Missing path for ${option}`);
//        }
// this is handled in configurator now
//        context[optionData.schema.options.context] = configPath;   // setting config path in context for use in downstream source(s)
//        return;
//      }

      if (optionData.typeHint === 'boolean') {
        if (inlineValue !== undefined) {
          value = inlineValue;
        }
        else if (checkArguments && (peekArgumentValue() === 'true' || peekArgumentValue() === 'false')) {
          value = getArgument();
        }
        else {
          value = true;
        }
      }
      else if (optionData.typeHint === 'array' || optionData.schema.isArray) {
        if (inlineValue !== undefined) {
          value = inlineValue.split(',').filter(item => item.length);
        }
        else if (checkArguments) {
          value = [];
          while (peekArgumentValue()) {
            value.push(getArgument());
          }
        }
        else if (optionData.allowEmpty) {
          value = [];
        }
        else {
          throw new CommandLineError(`Option ${option} requires a list of values`)
        }
      }
      else {
        if (inlineValue !== undefined) {
          value = inlineValue;
        }
        else if (checkArguments && peekArgumentValue()) {
          value = getArgument();
        }
        else if (optionData.allowEmpty) {
          value = '';
        }
        else {
          throw new CommandLineError(`Option ${option} requires a value`)
        }
      }

      if (optionData.isSetPropertyValue) {

        if (value.length !== 2) {
          throw new CommandLineError(`Option ${option} requires a path and a value`);
        }
        let propertyPath = value[0]
        if (propertyPath.startsWith('.')) {
          propertyPath = `${ctx.prefix}${propertyPath}`;
        }
        if (!schema.find(propertyPath)) {
          throw new CommandLineError(`Option ${option} specified unknown property path "${propertyPath}"`);
        }

        propertyAssignments.set(propertyPath, value[1]);
      }
      else {
        propertyAssignments.set(optionData.path, value);
      }
    }

    while (i < args.length) {
      const arg = getArgument();

      if (arg === '--') {
        // Everything after -- goes to general property
        if (ctx.general) {
          generalValues.push(...args.slice(i));
          break;
        }
        else if (ctx.parent) {
          ctx = ctx.parent;
        }
        continue;
      }

      if (arg.startsWith('--')) {
        // Long option: --option or --option=value
        const [optionPart, ...valueParts] = arg.slice(2).split('=');
        const kebabName = optionPart;
        const hasInlineValue = valueParts.length > 0;
        const inlineValue = hasInlineValue ? valueParts.join('=') : undefined;

        let optionData;

        let searchCtx = ctx;

        while (!optionData) {
          optionData = searchCtx.clOptions.get(kebabName) ?? searchCtx.clAliases.get(kebabName);

          if (!optionData) {
            if (searchCtx.parent) {
              searchCtx = searchCtx.parent;
            }
            else {
              break;
            }
          }
        }
        if (optionData) {
//          ctx = searchCtx;
          handleOptionValue(`--${optionData.longOption}`, optionData, inlineValue, true, ctx);
        }
        else {
          if (loadOptions?.strict) {
            if (searchContextTree(kebabName)) {
              throw new CommandLineError(`Unexpected option: --${kebabName}`);
            }
            else {
              throw new CommandLineError(`Unknown option: --${kebabName}`);
            }
          }
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        const [shortOptions, ...valueParts] = arg.slice(1).split('=');
        const hasInlineValue = valueParts.length > 0;
        const inlineValue = hasInlineValue? valueParts.join('=') : undefined;

        for (let j = 0; j < shortOptions.length; j++) {
          const shortOption = shortOptions[j];
          const isLastOption = (j === shortOptions.length - 1);

          let optionData;
          let searchCtx = ctx;
          while (!optionData) {
            if (searchCtx.clFlags.has(shortOptions[j])) {
              optionData = searchCtx.clFlags.get(shortOptions[j]);
            }

            if (!optionData) {
              if (searchCtx.parent) {
                searchCtx = searchCtx.parent;
              }
              else {
                break;
              }
            }
          }

          if (optionData) {
//            ctx = searchCtx;
            handleOptionValue(`-${optionData.flag}`, optionData, inlineValue, isLastOption, ctx);
          }
          else {
            if (loadOptions?.strict) {
              if (searchContextTree(shortOption)) {
                throw new CommandLineError(`Unexpected option: --${shortOption}`);
              }
              else {
                throw new CommandLineError(`Unknown option -${shortOption}`);
              }
            }
          }
        }
      }
      else {
        // Non-option argument - either a command or a general value
        if (ctx.selector) {
          const selector = toKebabCase(arg);
          if (ctx.selectionContextMap.has(selector)) {
            propertyAssignments.set(ctx.selector.path, selector);
            ctx = ctx.selectionContextMap.get(selector);
          }
          else if (ctx.selector.values?.find?.(v => (v === selector || v.value === selector))) {
            // defined value without a context
            propertyAssignments.set(ctx.selector.path, selector);
          }
          else {
            if (searchContextTree(arg)) {
              throw new CommandLineError(`Unexpected selector: "${arg}"`);
            }
            else {
              throw new CommandLineError(`Unknown selector: "${arg}"`);
            }
          }
        }
        else if (ctx.general) {
          generalValues.push(arg);
        } else {
          if (loadOptions?.strict) {
            throw new CommandLineError(`Unexpected argument: "${arg}"`);
          }
          // else ignore it
        }
      }
    }

    // Assign main values to main property
    if (ctx.general) {
      if (ctx.general.typeHint === 'array' || ctx.general.schema.isArray) {
        propertyAssignments.set(ctx.general.path, generalValues);
      }
      else if (generalValues.length === 1) {
        propertyAssignments.set(ctx.general.path, generalValues[0]);
      }
      else if (generalValues.length > 1) {
        throw new CommandLineError(`Too many arguments provided for ${ctx.general.path}: [${generalValues.join(', ')}]`)
      }
    }

    // Validate the complete configuration
    return propertyAssignments;
  }

  /**
   * Generate help text based on configurator schema
   * @param {CompiledSchema} schema
   * @param {object} context - collection of source-specific properties (argv, env, etc.)
   * @param {boolean} showAdvanced - Whether to show advanced options
   * @returns {string} Formatted help text
   */
  _help(schema, context, showAdvanced = false) {
    const terminalWidth = process.stdout.columns || 80;

    const appName = context.appName ?? 'command';
    const prefix = toCamelCase(appName);

    const ctx = this._generateOptions(schema, prefix);

    function formatContext(ctx, command = null, indent = 0, entries = []) {
      const cl = [];

      if (entries.length) {
        cl.push([]);
      }
      let usageLine = command? `${command}` : `Usage: ${appName}`;

      if (ctx.clOptions.size) {
        usageLine += ` [options]`;
      }
      if (ctx.selector) {
        const selections = ctx.selector.schema.values.join('|');

        //const selections = Array.from(ctx.selectionContextMap.keys()).join('|')

        usageLine += (ctx.selector.schema.required) ? ` <${selections}` : ` [${selections}`;

        for (const [, selectionContext] of ctx.selectionContextMap) {
          if (selectionContext.clOptions.size) {
            usageLine += ' [options]';
            break;
          }
        }
        usageLine += (ctx.selector.schema.required) ? '>' : ']';
      }
      else if (ctx.general) {
        usageLine += ` ${ctx.general.valueDescription}`;
      }

      cl.push([usageLine]);

      if (ctx.clOptions.size) {

        const sortedOptions = Array.from(ctx.clOptions.values()).sort((a, b) => {
          if (a.flag && !b.flag) { return -1 }
          if (b.flag && !a.flag) { return 1 }
          return a.longOption.localeCompare(b.longOption, undefined, {numeric: true});
        });


        let foundAdvanced = false;
        for (const clOptionData of sortedOptions) {
          // Skip hidden options and handle advanced options based on showAdvanced flag
          const m = clOptionData.schema.metadata;
          const o = clOptionData.schema.options;
          if (m.internal || m.system || m.hidden || o.isInherited) continue;
          if (m.advanced) {
            foundAdvanced = true;
            if (!showAdvanced) continue;
          }

          let optionSyntax = `  --${clOptionData.longOption}`;

          if (clOptionData.flag) {
            optionSyntax += ` (-${clOptionData.flag})`;
          }
          if (clOptionData.alias) {
            optionSyntax += ` (--${clOptionData.alias})`;
          }

          optionSyntax += ` ${clOptionData.valueDescription}`;

          // Add the option description
          const description = (clOptionData.description || '').trim();

          const markers = [];
          if (clOptionData.schema.metadata.advanced) {
            markers.push('advanced');
          }
          if (clOptionData.schema.options.required) {
            markers.push('required');
          }
          if (clOptionData.schema.options.default !== undefined) {
            // todo - format default values via the type formatter
            markers.push(`default:${clOptionData.schema.options.default}`);
          }

          // Add advanced marker if needed
          const markersText = markers.length ? `(${markers.join(', ')})` : ''

          const columns = [optionSyntax]
          const d = [description, markersText].filter(item => !!item).join(' ').trim();

          if (d.length) {
            columns.push(d);
          }
          cl.push(columns);
        }
      }
      const margin = indent? ' '.repeat(indent) : '';


      if (ctx.selector) {
        for (const [selection, selectionContext] of ctx.selectionContextMap) {
          formatContext(selectionContext, selection, 2, cl);
        }
      }
      entries.push(...cl.map(columns => columns?.length? [margin + columns[0], columns[1]] : []))

      return entries;
    }

    /** @type {Array<Array<string>>} */
    const entries = formatContext(ctx);
    const columnWidth = (terminalWidth / 2) - 1;
    const lines = [];

    for (let [c1='', c2=''] of entries) {
      if (!c1 && !c2) {
        lines.push([]);
        continue;
      }

      // Chop down on alternatives if first column is long, or there's a description column.
      // It's pretty ugly either way.  :-(
      // (Tried falling back to splitting on spaces, but the leading indentation makes this
      // annoying to implement, and it doesn't really look better anyway.)
      const c1parts = (c2 || c1.length >= terminalWidth)? c1.split('|') : [c1];
      let commandOffset = 10;

      if (c1parts.length > 0) {
        for (commandOffset = c1parts[0].length; commandOffset > 0; commandOffset--) {
          const c = c1parts[0].charAt(commandOffset - 1);
          if (!c.match(/[a-z-]/i)) {
            break;
          }
        }
      }

      const c1lines = [];

      let current = '';

      for (const part of c1parts) {
        const check = current? `${current}|${part}` : part;
        if (check.length < columnWidth) {
          current = check;
        }
        else {
          if (current) {
            c1lines.push(current);
            current = ' '.repeat(commandOffset) + '|' + part;
          }
          else {
            c1lines.push(part);
            current = ' '.repeat(commandOffset);
          }
        }
      }
      if (current.trim().length || c1lines.length === 0) {
        c1lines.push(current);
      }

      if (c2.trim()) {
        c2 = `- ${c2}`;
      }

      const c2parts = c2.split(' ');
      const c2lines = [];
      current = '';

      for (const part of c2parts) {
        const check = current? `${current} ${part}` : part;
        if (check.length < columnWidth) {
          current = check;
        }
        else {
          if (current) {
            c2lines.push(current);
            current = '  ' + part;
          }
          else {
            c2lines.push(part);
            current = '  ';
          }
        }
      }
      if (current.trim().length || c2lines.length === 0) {
        c2lines.push(current);
      }

      let cl1 = 0, cl2 = 0;

      while (cl1 < c1lines.length || cl2 < c2lines.length) {
        const col1 = cl1 < c1lines.length ? c1lines[cl1] : '';
        const col2 = cl2 < c2lines.length ? c2lines[cl2] : '';
        if (col1.length > columnWidth) {
          lines.push([col1, '']);
          cl1++;
        }
        else {
          lines.push([col1, col2]);
          cl1++;
          cl2++;
        }
      }
    }

    // technically, we should run a first pass on the first column in order to determine
    // where to wrap the second column, but this is good enough for now.

    const firstColumnLength = lines.reduce((max, line) => {
      if (line && line[0]) {
        if (line[0].length <= columnWidth) {
          return Math.max(max, line[0].length);
        }
        else {
          return max;
        }
      }
      return max;
    }, 0);

    const helpText = lines.map(line => {
      const parts = [];
      if (line) {
        const c1 = line[0] || '';
        parts.push(c1.padEnd(firstColumnLength));
        if (line[1] && line[1].length) {
          parts.push(line[1]);
        }
      }
      return parts.join(' ');
    }).join('\n')

    return helpText;
  }

}

export class CommandLineError extends ConfiguratorError {}

class ParsingContext {
  constructor(appName, parent, prefix) {
    this.appName = appName ?? '';
    this.prefix = prefix;
    this.parent = parent;
    this.selector = undefined
    this.general = undefined;
    this.selectionContextMap = new Map();
    this.clOptions = new Map();
    this.clAliases = new Map();
    this.clFlags = new Map();
  }

  setSelector(path, schema) {
    if (this.selector) {
      throw new CommandLineError(
        `Selector "${path}" conflicts with existing selector`)  // fixme - allow multiple selectors in the future?
    }
    else if (this.general) {
      throw new CommandLineError(
        `Selector "${path}" conflicts with general property`)
    }
    const typeHint = schema.metadata.parserTypeHint ?? 'any';
    const description = schema.metadata.description;
    const valueDescription = schema.metadata.valueDescription ?? (schema.isArray? 'values': 'value');

    this.selector = {schema, path, typeHint, description, valueDescription};
  }
  setGeneral(path, schema) {
    if (this.general) {
      throw new CommandLineError(
        `General property "${path}" conflicts with existing general property`)
    }
    if (this.selector) {
      throw new CommandLineError(
        `General property "${path}" conflicts with selector`)
    }
    const typeHint = schema.metadata.parserTypeHint ?? 'any';

    const description = schema.metadata.description;
    const valueDescription = schema.metadata.valueDescription ?? (schema.isArray? 'values': 'value');

    this.general = {schema, path, typeHint, description, valueDescription};
  }

  addLongOption(path, schema) {
    let optionPath = path;
    if (this.prefix && optionPath.indexOf(`${this.prefix}.`) === 0) {
      optionPath = optionPath.substring(this.prefix.length + 1);
    }
    else if (this.appName && optionPath.indexOf(`${this.appName}.`) === 0) {
      optionPath = optionPath.substring(this.appName.length + 1);
    }
    const isTopLevel = optionPath.indexOf('.') === -1;
    const longOption = toKebabCase(optionPath);
    const typeHint = schema.metadata.parserTypeHint ?? 'any';

    const description = schema.metadata.description;
    const valueDescription = schema.metadata.valueDescription ?? (schema.isArray? 'values': 'value');

    const configuratorSchemaMetadata = schema.metadata['configuratorSchema'];
    const isHelp = configuratorSchemaMetadata === 'help';
    const isConfig = configuratorSchemaMetadata === 'config';
    const isDump = configuratorSchemaMetadata === 'dump';
    const isSetPropertyValue = configuratorSchemaMetadata === 'setPropertyValue';

    const isAdvanced = !!schema.metadata['advanced']
    const isHidden = !!schema.metadata['hidden'];
    const isSystem = !!schema.metadata['system']
    const isInternal = !!schema.metadata['internal'];

    this.clOptions.set(longOption, {path, schema, typeHint, description, valueDescription, longOption, isTopLevel, isHelp, isConfig, isDump, isSetPropertyValue, isAdvanced, isHidden, isSystem, isInternal})

  }

  updateShortOptions() {
    for (const clOptionData of this.clOptions.values()) {
      const flagHint = clOptionData.schema.metadata.flagHint;
      if (flagHint && !this.clFlags.has(flagHint)) {
        clOptionData.flag = flagHint;
        this.clFlags.set(clOptionData.flag, clOptionData);
      }
    }
    for (const [longOption, clOptionData] of this.clOptions) {
      const m = clOptionData.schema.metadata;
      if (clOptionData.flag || m.internal || m.system || m.advanced || m.hidden) {
        continue;
      }

      if (clOptionData.isTopLevel) {
        let flag = longOption.charAt(0).toLowerCase();

        if (this.clFlags.has(flag)) {
          flag = flag.toUpperCase();
        }
        if (this.clFlags.has(flag)) {
          flag = undefined;
        }

        if (flag) {
          clOptionData.flag = flag;
          this.clFlags.set(flag, clOptionData);
        }
      }
      else {
//        let alias = longOption.split('-').map(part => part.charAt(0).toLowerCase()).join('');
//        let alias = longOption.replace(/^-+/, '').split(/(-?\d+)/).filter(Boolean).map(part => /^\d+$/.test(part) ? part : part.replace(/-/g, '').charAt(0).toLowerCase()).join('');
        const alias = longOption.replace(/^-+/, '').split(/(-?\d+|-)/g).filter(s => s && s !== '-').map(part => /^\d+$/.test(part) ? part : part.charAt(0).toLowerCase()).join('');


        if (!this.clAliases.has(alias)) {
          clOptionData.alias = alias;
          this.clAliases.set(alias, clOptionData);
        }
      }
    }
  }

}