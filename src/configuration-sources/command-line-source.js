import { deepAssign, toCamelCase, toConstantCase, toHeadline, toKebabCase, toPascalCase } from '../utils.js';
import { ConfigurationSource } from './configuration-source.js';
import { ConfiguratorError } from '../configurator-error.js';

/**
 * Command line argument parser strategy
 */
export class CommandLineSource extends ConfigurationSource
{
  /**
   * @typedef {Object} CommandLineSourceOptions
   * @property {number} [sequence] - Sequence number of the source.  Defaults to ARGUMENTS (currently 500).
   * @property {string} [contextFieldName] - Name of the field (default:"argv") in the context object that contains the command line arguments
   * @property {boolean} [helpEnabled] - Enable/disable the help options.  Defaults to true.
   * @property {string} [helpOption] - Name of the option that shows help (--help)
   * @property {string} [helpFlag] - Short name of the flag that shows help (-h)
   * @property {string} [helpDescription] - Override description of the help option
   * @property {string} [helpValueDescription] - Override description of the help option value
   */

  /**
   * @param {CommandLineSourceOptions} [options]
   */
  constructor(options = {}) {
    super({...options, name: 'command-line-source', sequence: options.sequence || ConfigurationSource.DefaultSequence.ARGUMENTS});

    this.contextFieldName = options.contextFieldName ?? 'argv'

    this.helpEnabled = options.helpEnabled ?? true;
    this.helpOption = options.helpOption ?? 'help';
    this.helpFlag = options.helpFlag ?? 'h';
    this.helpDescription = options.helpDescription ?? `display help text and exit`;
    this.helpValueDescription = options.helpValueDescription ?? 'basic|required|advanced'
  }

  /** generate command line options, including flags and aliases
   * @param {Configurator} configurator
   * @param {string} [appName] - name of the app
   * @returns {ParsingContext}
   * @private
   */
  _generateOptions(configurator, appName) {

    /** @typedef ParsingContext
     * @property {ParsingContext|null} parent
     * @property {FieldDefinition} [selector]
     * @property {Map<string, ParsingContext>} selectionContextMap
     * @property {Map<string, FieldOptions>} options
     * @property {Map<string, FieldOptions>} aliases
     * @property {Map<string, FieldOptions>} flags
     * @property {FieldOptions} [general]
     */

    /**
     * @param {ConfigurationSchema} schema
     * @param {ParsingContext} ctx
     * @param {string} [prefix]
     * @returns {ParsingContext}
     */
    function walk(schema, ctx, prefix) {
      // The schema hierarchy defines a tree of objects containing configurable fields, but in some cases, the
      // activation of those objects is controlled by an implicit hierarchy of commands, where the application itself
      // acts as the "root command" that owns the first-level schema.  For command-line processing, we make that
      // command hierarchy explicit.

      for (let [fieldName, fieldDefinition] of schema.fields) {

        if (fieldDefinition.inherit) {
          continue;
        }

        let type = configurator.types.getType(fieldDefinition.type ?? 'string');
        if (!type) {
          continue;
        }

        if (fieldDefinition.selector) {
          if (ctx.selector) {
            throw new CommandLineError(`Selector "${fieldDefinition.path}" conflicts with existing selector "${ctx.selector.path}"`)
          }
          else if (ctx.general) {
            throw new CommandLineError(`Selector "${fieldDefinition.path}" conflicts with general field "${ctx.general.path}"`)
          }
          ctx.selector = {...fieldDefinition, type, typeName: type.typeName};
          continue;
        }
        else if (fieldDefinition.general) {
          if (ctx.selector) {
            throw new CommandLineError(`General field "${fieldDefinition.path}" conflicts with selector "${ctx.selector.path}"`)
          }
          else if (ctx.general) {
            throw new CommandLineError(`General field "${fieldDefinition.path}" conflicts with existing general field "${ctx.general.path}"`)
          }

          ctx.general = {...fieldDefinition, type, typeName: type.typeName};
          continue;
        }

        let path = schema.path ? `${schema.path}.${fieldName}` : fieldName;

        if (path.indexOf(`${appName}.`) === 0) {
          path = path.substring(appName.length + 1);
        }

        if (prefix && path.indexOf(`${prefix}.`) === 0) {
          path = path.substring(prefix.length + 1);
        }
//        else if (path.indexOf(`${appName}.`) === 0) {
//          path = path.substring(appName.length + 1);
//        }
        const isTopLevel = path.indexOf('.') === -1;
        const longOption = toKebabCase(path);

        ctx.options.set(longOption, {...fieldDefinition, typeName: fieldDefinition.type, type, longOption, isTopLevel})
      }

      for (let [childName, childSchema] of schema.children) {
        if (childSchema.selector) {
          if (childSchema.selector !== ctx.selector?.name) {
            throw new CommandLineError(`Invalid selector: ${childSchema.selector} for ${childName} in ${schema.path ? schema.path : 'root schema'}`);
          }
          /** @type {ParsingContext} */
          let selectionContext = {
            parent: ctx,
            selector: undefined,
            selectionContextMap: new Map(),

            options: new Map(),
            aliases: new Map(),
            flags: new Map()
          }

          let selection = childSchema.selection ?? childName;

          ctx.selectionContextMap.set(selection, walk(childSchema, selectionContext, prefix ? `${prefix}.${childName}` : childName));
        }
        else {
          walk(childSchema, ctx, prefix);
        }
      }

      for (let [longOption, optionData] of ctx.options) {
        if (optionData.flagHint && !ctx.flags.has(optionData.flagHint)) {
          optionData.flag = optionData.flagHint;
          ctx.flags.set(optionData.flagHint, optionData);
        }
      }
      for (let [longOption, optionData] of ctx.options) {
        if (optionData.internal || optionData.system || optionData.advanced || optionData.hidden || optionData.flag) {
          continue;
        }

        if (optionData.isTopLevel) {
          let flag = longOption.charAt(0).toLowerCase();

          if (ctx.flags.has(flag)) {
            flag = flag.toUpperCase();
          }
          if (ctx.flags.has(flag)) {
            flag = undefined;
          }

          if (flag) {
            optionData.flag = flag;
            ctx.flags.set(flag, optionData);
          }
        }
        else {
          let alias = longOption.split('-').map(part => part.charAt(0).toLowerCase()).join('');

          if (!ctx.aliases.has(alias)) {
            optionData.alias = alias;
            ctx.aliases.set(alias, optionData);
          }
        }
      }

      return ctx;
    }

    /** @type {ParsingContext} */
    let initialParsingContext = {
      parent: null,
      selector: undefined,
      selectionContextMap: new Map(),

      options: new Map(),
      aliases: new Map(),
      flags: new Map()
    }

    return walk(configurator.schema, initialParsingContext);

  }


  /**
   * @param {Configurator} configurator
   * @param {Object} context
   * @param {{strict: [boolean]}} [loadOptions]
   * @returns {Promise<Map<string, any>>}
   * @private
   */
  async _load(configurator, context, loadOptions) {
    const appName = context?.appName;
    
    const argv = context[this.contextFieldName] ?? process.argv;

// Skip 'node' and script name if this looks like process.argv
    const args = argv.length >= 2 && argv[0].includes('node') ? argv.slice(2) : argv;

//    const config = {};

    const fieldAssignments = new Map();

    const generalValues = [];

    const prefix = toCamelCase(appName);
    //const {options, aliases, flags, general} = this._generateOptions(configurator, prefix);

    let ctx = this._generateOptions(configurator, prefix);

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
        let ret = (i < args.length && (args[i] === '-' || `${args[i]}`.charAt(0) !== '-')) ? args[i] : null;
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

    while (i < args.length) {
      const arg = getArgument();

      if (arg === '--') {
        // Everything after -- goes to general field
        if (ctx.general) {
          generalValues.push(...args.slice(i));
        }
        break;
      }

      if (arg.startsWith('--')) {
        // Long option: --option or --option=value
        const [optionPart, ...valueParts] = arg.slice(2).split('=');
        const kebabName = optionPart;
        const hasInlineValue = valueParts.length > 0;
        const inlineValue = valueParts.join('=');

        // Handle help flags specially
        if (this.helpEnabled && arg === `--${this.helpOption}`) {
          let showAdvanced = false;
          if (hasInlineValue && inlineValue === 'advanced') {
            showAdvanced = true;
          }
          else if (peekArgumentValue(true) === 'advanced') {
            showAdvanced = true;
          }
          console.log(this._help(configurator, context, showAdvanced));
          process.exit(0);
        }

        let value;

        let optionData;

        if (ctx.options.has(kebabName)) {
          optionData = ctx.options.get(kebabName);
        }
        else if (ctx.aliases.has(kebabName)) {
          optionData = ctx.aliases.get(kebabName);
        }

        if (!optionData) {
          if (loadOptions?.strict) {
            throw new CommandLineError(`Unknown option: --${kebabName}`);
          }
          else {
            continue;
          }
        }

        if (optionData.typeName === 'boolean') {
          if (hasInlineValue) {
            value = inlineValue;
          }
          else if (peekArgumentValue() === 'true' || peekArgumentValue() === 'false') {
            value = getArgument();
          }
          else {
            value = true;
          }
        }
        else if (optionData.typeName === 'array' || optionData.type?.typeOptions.isListType || (optionData.typeName.startsWith('[') && optionData.typeName.endsWith(']'))) {
          value = [];
          if (hasInlineValue) {
            value = inlineValue.split(',').filter(item => item.length);
          }
          else {
            while (peekArgumentValue()) {
              let a = getArgument();
              value = value.concat(a.split(','));
            }
          }
          if (value.length === 0 && !optionData.allowEmpty) { // should this be a validator?
            throw new CommandLineError(`Option --${kebabName} requires one or more values`);
          }
        }
        else {
          if (hasInlineValue) {
            value = inlineValue;
          }
          else if (peekArgumentValue()) {
            value = getArgument();
          }
          else if (optionData.allowEmpty) {
            value = '';
          }
          else {
            throw new CommandLineError(`Option --${kebabName} requires a value`)
          }
        }
        fieldAssignments.set(optionData.path, value);

      } else if (arg.startsWith('-') && arg.length > 1) {
        const [shortOptions, ...valueParts] = arg.slice(1).split('=');
        const hasInlineValue = valueParts.length > 0;
        const inlineValue = valueParts.join('=');

        for (let j = 0; j < shortOptions.length; j++) {
          const shortOption = shortOptions[j];
          const isLastOption = (j === shortOptions.length - 1);

          let optionData;

          if (this.helpFlag && shortOption === this.helpFlag) {
            const showAdvanced = (isLastOption && peekArgumentValue(true) === 'advanced');

            console.log(this._help(configurator, context, showAdvanced));
            process.exit(0);
          }

          if (this.configFlag && shortOption === this.configFlag) {
            const configPath = isLastOption ? peekArgumentValue(true) : null;

            if (!configPath) {
              throw new CommandLineError(`Missing path for -${this.configFlag}`);
            }

            context[this.configContextFieldName] = configPath;   // setting config path in context for use in downstream source(s)
            continue;
          }

          if (ctx.flags.has(shortOptions[j])) {
            optionData = ctx.flags.get(shortOptions[j]);
          }

          if (!optionData) {
            if (loadOptions?.strict) {
              throw new CommandLineError(`Unknown option -${shortOption}`);
            }
            else {
              continue;
            }
          }

          let value;
          if (optionData.typeName === 'boolean') {
            if (isLastOption && hasInlineValue) {
              value = inlineValue;
            }
            else if (isLastOption && (peekArgumentValue() === 'true' || peekArgumentValue() === 'false')) {
              // this case can be ambiguous, so only absorb if explicitly true/false
              value = getArgument();
            }
            else {
              value = true;
            }
          }
          else if (optionData.typeName === 'array' || optionData.type?.typeOptions.isListType || (optionData.typeName.startsWith('[') && optionData.typeName.endsWith(']'))) {
            if (isLastOption && hasInlineValue) {
              value = inlineValue.split(',').filter(item => item.length);
            }
            else if (isLastOption) {
              value = [];
              while (peekArgumentValue()) {
                value.push(getArgument());
              }
            }
            else {
              throw new CommandLineError(`Option -${shortOption} requires a list of values`)
            }
          }
          else {
            if (isLastOption && hasInlineValue) {
              value = inlineValue;
            }
            else if (isLastOption && peekArgumentValue()) {
              value = getArgument();
            }
            else {
              value = true;
            }
          }
          fieldAssignments.set(optionData.path, value);
        }
      }
      else {
        // Non-option argument - either a command or a general value
        if (ctx.selector) {
          const selector = toKebabCase(arg);
          if (ctx.selectionContextMap.has(selector)) {
            fieldAssignments.set(ctx.selector.path, selector);
            ctx = ctx.selectionContextMap.get(selector);
          }
          else if (ctx.selector.values?.find?.(v => (v === selector || v.value === selector))) {
            // defined value without a context
            fieldAssignments.set(ctx.selector.path, selector);
          }
          else {
            throw new CommandLineError(`Unknown selector: "${arg}"`);
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

    // Assign main values to main field
    if (ctx.general && generalValues.length > 0) {
      if (ctx.general.typeName === 'array' || ctx.general.type?.typeOptions.isListType || (ctx.general.typeName.startsWith('[') && ctx.general.typeName.endsWith(']'))) {
        fieldAssignments.set(ctx.general.path, generalValues);
      }
      else if (generalValues.length === 1) {
        fieldAssignments.set(ctx.general.path, generalValues[0]);
      }
      else {
        throw new CommandLineError(`Too many arguments provided for ${ctx.general.name}: [${generalValues.join(', ')}]`)
      }
    }

    // Validate the complete configuration
    return fieldAssignments;
  }

  /**
   * Generate help text based on configurator schema
   * @param {Configurator} configurator
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {boolean} showAdvanced - Whether to show advanced options
   * @returns {string} Formatted help text
   */
  _help(configurator, context, showAdvanced = false) {
    const terminalWidth = process.stdout.columns || 80;

    const appName = context.appName ?? 'command';
    const prefix = toCamelCase(appName);

    const ctx = this._generateOptions(configurator, prefix);

    /** @type {Array<Array<string>>} */

    function formatContext(ctx, command = null, indent = 0, entries = []) {
      let cl = [];

      if (entries.length) {
        cl.push([]);
      }
      let usageLine = command? `${command}` : `Usage: ${appName}`;

      if (ctx.options.size) {
        usageLine += ` [options]`;
      }
      if (ctx.selector) {
        const selections = Array.from(ctx.selectionContextMap.keys()).join('|')

        usageLine += (ctx.selector.required)? ` <${selections}` : ` [${selections}`;

        for (let [, selectionContext] of ctx.selectionContextMap) {
          if (selectionContext.options.size) {
            usageLine += ' [options]';
            break;
          }
        }
        usageLine += (ctx.selector.required)? '>' : ']';
      }
      else if (ctx.general) {
        usageLine += ` ${_formatArgumentType(ctx.general)}`;
      }

      cl.push([usageLine]);


      if (ctx.options.size) {
        let foundAdvanced = false;
        for (const option of ctx.options.values()) {
          // Skip hidden options and handle advanced options based on showAdvanced flag
          if (option.internal || option.system || option.hidden || option.inherit) continue;
          if (option.advanced) {
            foundAdvanced = true;
            if (!showAdvanced) continue;
          }

          let optionSyntax = `  --${option.longOption}`;

          if (option.flag) {
            optionSyntax += ` (-${option.flag})`;
          }
          if (option.alias) {
            optionSyntax += ` (--${option.alias})`;
          }

          optionSyntax += ` ${_formatArgumentType(option)}`;

          // Add the option description
          const description = (option.description || '').trim();

          let markers = [];
          if (option.advanced) {
            markers.push('advanced');
          }
          if (option.required) {
            markers.push('required');
          }
          if (option.default) {
            // todo - format default values via the type formatter
            markers.push(`default:${option.default}`);
          }

          // Add advanced marker if needed
          const markersText = markers.length ? `(${markers.join(', ')})` : ''

          let columns = [optionSyntax]
          const d = [description, markersText].filter(item => !!item).join(' ').trim();

          if (d.length) {
            columns.push(d);
          }
          cl.push(columns);
        }
      }
      let margin = indent? ' '.repeat(indent) : '';


      if (ctx.selector) {
        for (const [selection, selectionContext] of ctx.selectionContextMap) {
          formatContext(selectionContext, selection, 2, cl);
        }
      }
      entries.push(...cl.map(columns => columns?.length? [margin + columns[0], columns[1]] : []))

      return entries;
    }

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
      let c1parts = (c2 || c1.length >= terminalWidth)? c1.split('|') : [c1];
      let commandOffset = 10;

      if (c1parts.length > 0) {
        for (commandOffset = c1parts[0].length; commandOffset > 0; commandOffset--) {
          let c = c1parts[0].charAt(commandOffset - 1);
          if (!c.match(/[a-z-]/i)) {
            break;
          }
        }
      }

      const c1lines = [];

      let current = '';

      for (let part of c1parts) {
        let check = current? `${current}|${part}` : part;
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

      let c2parts = c2.split(' ');
      const c2lines = [];
      current = '';

      for (let part of c2parts) {
        let check = current? `${current} ${part}` : part;
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
      let parts = [];
      if (line) {
        let c1 = line[0] || '';
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

export class CommandLineError extends ConfiguratorError {
  constructor(message, data) {
    super(message, data);
  }
}

function _formatArgumentType(option) {
  // yuck.  types and validators should self-format!

  let argumentTypeString;

  if (option.valueDescription) {
    argumentTypeString = typeof option.valueDescription === 'function' ? option.valueDescription() : option.valueDescription;
  }
  else if (option.typeName === 'string') {

    if (typeof option.validator === 'string') {
      argumentTypeString = option.validator.substring(1);
    }
    else if (typeof option.validator === 'object'
             && Array.isArray(option.validator['$in'])) {
      argumentTypeString = option.validator['$in'].join('|')
    }
    else {
      argumentTypeString = 'string-value'
    }
  }
  else if (option.typeName === 'number') {
    if (typeof option.validator === 'string') {
      argumentTypeString = option.validator.substring(1);
    }
    else if (typeof option.validator === 'object'
             && Array.isArray(option.validator['$in'])) {
      argumentTypeString = option.validator['$in'].join('|')
    }
    else if (typeof option.validator === 'object' && option.validator['$range']) {
      if (option.validator['$range'].min && option.validator['$range'].max) {
        argumentTypeString = `number:${option.validator['$range'].min}-${option.validator['$range'].max}`;
      }
      else if (option.validator['$range'].min) {
        argumentTypeString = `number:(${option.validator['$range'].min}+)`;
      }
      else if (option.validator['$range'].max) {
        argumentTypeString = `number:<=${option.validator['$range'].max}`;
      }
      else {
        argumentTypeString = 'number';
      }
    }
    else {
      argumentTypeString = 'number'
    }
  }
  else if (option.typeName === 'boolean') {
    argumentTypeString = 'true|false'
  }
  else if (option.typeName.startsWith('[') && option.typeName.endsWith(']')) {
    argumentTypeString = `${option.typeName.substring(1, option.typeName.length - 1) || 'string'}...`
  }
  else if (option.typeName === 'array') {
    if (typeof option.validator === 'string') {
      argumentTypeString = option.validator.substring(1);  // implied $each for simple arrays
    }
    if (typeof option.validator === 'object' && option.validator['$each']) {
      if (typeof option.validator['$each'] === 'string') {
        argumentTypeString = `${option.validator['$each'].substring(1)}...`;
      }
      else {
        argumentTypeString = 'value...';
      }
    }
    else {
      argumentTypeString = 'value...';
    }
  }
  else if (option.type.typeOptions.isListType) {
    argumentTypeString = `${option.type.typeOptions.itemType?.name || 'string'}...`
  }
  else if (option.type.typeOptions.valueDescription) {
    argumentTypeString = typeof option.type.typeOptions.valueDescription === 'function' ? option.type.typeOptions.valueDescription() : option.type.typeOptions.valueDescription;
  }
  else {
    argumentTypeString = 'value';
  }

  if (option.typeName === 'boolean' || option.allowEmpty) {
    return `[${argumentTypeString}]`;
  }
  else {
    return `<${argumentTypeString}>`;
  }
}