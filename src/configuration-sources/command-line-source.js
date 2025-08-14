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

  /** @typedef {ExtendedFieldOptions} CommandLineOption
   * @property {string} longOption - Long option name (e.g. --help)
   * @property {string} flag - Short option name (e.g. -h)
   * @property {string} alias - Alias for the option (e.g. -h)
   * @property {boolean} isTopLevel
   */

  /** generate command line options, including flags and aliases
   * @param {Configurator} configurator
   * @param {string} [prefix] - prefix to trim; must not end in dot.  start with toCamelCase(appName) to start
   * @returns {{options:Map<string,CommandLineOption>, aliases: Map<string, CommandLineOption>, flags: Map<string, CommandLineOption>}}
   * @private
   */
  _xgenerateOptions(configurator, prefix) {

    /** @type {Map<string, CommandLineOption>} */
    const options = new Map();

    for (const [fieldPath, fieldDescriptor] of configurator.schema.getAllFieldPaths({hidden: false})) {

      let type = configurator.types.getType(fieldDescriptor.type);
      if (!type || type.typeOptions.hidden) {
        continue;
      }

//      if (allowedTypes.indexOf(fieldOptions.type) === -1) {
//        continue;
//      }

      if (fieldDescriptor.general) {
        continue;
      }

      let longOption;
      let isTopLevel = fieldPath.indexOf('.') === -1;
      if (prefix && fieldPath.indexOf(`${prefix}.`) === 0) {
        longOption = toKebabCase(fieldPath.substring(fieldPath.indexOf('.') + 1));
        isTopLevel = true;
      }
      else {
        longOption = toKebabCase(fieldPath);
      }

      options.set(longOption, {...fieldDescriptor, typeName: fieldDescriptor.type, type, longOption, isTopLevel })
    }

    const flags = new Map();
    const aliases = new Map();

    for (let [longOption, optionData] of options) {
      if (optionData.flagHint && !flags.has(optionData.flagHint)) {
        optionData.flag = optionData.flagHint;
        flags.set(optionData.flagHint, optionData);
      }
    }
    for (let [longOption, optionData] of options) {
      if (optionData.advanced || optionData.hidden || optionData.flag) {
        continue;
      }

      if (optionData.isTopLevel) {
        let flag = longOption.charAt(0).toLowerCase();

        if (flags.has(flag)) {
          flag = flag.toUpperCase();
        }
        if (flags.has(flag)) {
          flag = undefined;
        }

        if (flag) {
          optionData.flag = flag;
          flags.set(flag, optionData);
        }
      }
      else {
        let alias = longOption.split('-').map(part => part.charAt(0).toLowerCase()).join('');

        if (!aliases.has(alias)) {
          optionData.alias = alias;
          aliases.set(alias, optionData);
        }
      }
    }

    const generalField = configurator.schema.getTaggedField('general');

    const generalFieldType = generalField?.type? configurator.types.getType(generalField.type) : undefined;

    const general = generalFieldType? {...generalField, typeName: generalField.type, type: generalFieldType } : undefined;

    return {options, aliases, flags, general}
  }


  _newGenerateOptions(configurator, appName) {

    /** @typedef CommandContext
     * @property {CommandContext|null} parent
     * @property {FieldOptions} commandField
     * @property {Map<string, CommandContext>} commandContextMap
     * @property {Map<string, FieldOptions>} options
     * @property {Map<string, FieldOptions>} aliases
     * @property {Map<string, FieldOptions>} flags
     * @property {FieldOptions} general
     */


    /**
     * @param {ConfigurationSchema} schema
     * @param {CommandContext} ctx
     * @param {string} [prefix]
     */
    function walk(schema, ctx, prefix) {
      // The schema hierarchy defines a tree of objects containing configurable fields, but in some cases, the
      // activation of those objects is controlled by an implicit hierarchy of commands, where the application itself
      // acts as the "root command" that owns the first-level schema.  For command-line processing, we make that
      // command hierarchy explicit.

      for (let [fieldName, fieldDescriptor] of schema.fields) {

        let type = configurator.types.getType(fieldDescriptor.type ?? 'string');
        if (!type || type.typeOptions.hidden) {
          continue;
        }
        if (fieldDescriptor.command) {
          if (ctx.commandField) {
            throw new CommandLineError(`Command "${fieldDescriptor.path}" conflicts with existing command "${ctx.commandField.path}"`)
          }
          else if (ctx.general) {
            throw new CommandLineError(`Command "${fieldDescriptor.path}" conflicts with general field "${ctx.general.path}"`)
          }
          ctx.commandField = {...fieldDescriptor, type, typeName: type.typeName};
          continue;
        }
        else if (fieldDescriptor.general) {
          if (ctx.commandField) {
            throw new CommandLineError(`General field "${fieldDescriptor.path}" conflicts with command "${ctx.commandField.path}"`)
          }
          else if (ctx.general) {
            throw new CommandLineError(`General field "${fieldDescriptor.path}" conflicts with existing general field "${ctx.general.path}"`)
          }

          ctx.general = {...fieldDescriptor, type, typeName: type.typeName};
          continue;
        }

        let path = schema.path ? `${schema.path}.${fieldName}` : fieldName;

        if (prefix && path.indexOf(`${prefix}.`) === 0) {
          path = path.substring(prefix.length + 1);
        }
        else if (path.indexOf(`${appName}.`) === 0) {
          path = path.substring(appName.length + 1);
        }
        const isTopLevel = path.indexOf('.') === -1;
        const longOption = toKebabCase(path);

        ctx.options.set(longOption, {...fieldDescriptor, typeName: fieldDescriptor.type, type, longOption, isTopLevel})
      }

      for (let [childName, childSchema] of schema.children) {
        if (childSchema.linkedParentFieldName) {
          if (childSchema.linkedParentFieldName !== ctx.commandField?.name) {
            throw new Error(`Invalid linkedParentFieldName: ${childSchema.linkedParentFieldName} for ${childName} in ${schema.path?schema.path:'root schema'}`);
          }
          /** @type {CommandContext} */
          let childCommandContext = {
            parent: ctx,
            commandField: undefined,
            commandContextMap: new Map(),

            options: new Map(),
            aliases: new Map(),
            flags: new Map()
          }

          let commandValue = childSchema.linkedParentFieldValue ?? childName;

          ctx.commandContextMap.set(commandValue, walk(childSchema, childCommandContext, prefix? `${prefix}.${childName}` : childName));
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
        if (optionData.advanced || optionData.hidden || optionData.flag) {
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

    /** @type {CommandContext} */
    let initialCommandContext = {
      parent: null,
      commandField: undefined,
      commandContextMap: new Map(),

      options: new Map(),
      aliases: new Map(),
      flags: new Map()
    }

    return walk(configurator.schema, initialCommandContext);










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

    let ctx = this._newGenerateOptions(configurator, prefix);

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
        let ret = (i < args.length && `${args[i]}`.charAt(0) !== '-') ? args[i] : null;
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

        /*
        if (this.configOption && arg === `--${this.configOption}`) {
          let configPath;

          if (hasInlineValue) {
            configPath = inlineValue;
          }
          else {
            configPath = getArgument();
          }
          if (!configPath) {
            throw new CommandLineError(`Missing path for --${this.configOption}`);
          }
          if (configPath.startsWith('-')) {
            throw new CommandLineError(`Invalid path for --${this.configOption}: "${configPath}"`);
          }
          context[this.configContextFieldName] = configPath;   // setting config path in context for use in downstream source(s)
          continue;
        }
*/

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

        if (false && optionData.config) {
          let configPath;

          if (hasInlineValue) {
            configPath = inlineValue;
          }
          else {
            configPath = getArgument();
          }
          if (!configPath) {
            throw new CommandLineError(`Missing path for --${kebabName}`);
          }
          if (configPath.startsWith('-')) {
            throw new CommandLineError(`Invalid path for --${kebabName}: "${configPath}"`);
          }
          context[this.configContextFieldName] = configPath;   // setting config path in context for use in downstream source(s)
          continue;
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

        // we sometimes want to pass a value downstream to other configuration sources:
        if (optionData.context) {
          if (typeof optionData.context === 'string') {
            context[optionData.context] = value;
          }
          else {
            context[optionData.name] = value;
          }
        }

//          deepAssign(config, optionData.path, value);

      } else if (arg.startsWith('-') && arg.length > 1) {
        const [shortOptions, ...valueParts] = arg.slice(1).split('=');
        const hasInlineValue = valueParts.length > 0;
        const inlineValue = valueParts.join('=');

        // todo - support inline options?
        // Short option(s): -o or -abc
//        const shortOptions = arg.slice(1);

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
          if (optionData.context) {
            if (typeof optionData.context === 'string') {
              context[optionData.context] = value;
            }
            else {
              context[optionData.name] = value;
            }
          }
        }
      }
      else {
        // Non-option argument - either a command or a general value
        if (ctx.commandField) {
          if (ctx.commandContextMap.has(arg)) {
            fieldAssignments.set(ctx.commandField.path, arg);
            ctx = ctx.commandContextMap.get(arg);
          }
          else {
            throw new CommandLineError(`Unknown command: "${arg}"`);
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

  _help(configurator, context, showAdvanced = false) {
    const appName = context.appName ?? 'command';
    const prefix = toCamelCase(appName);

    const ctx = this._newGenerateOptions(configurator, prefix);

    const formatContext = (ctx, command = null, indent = 0) => {
      let s = '';

      if (!command) {
        s += `Usage: ${appName}`;
      }
      else {
        s += `${command}`
      }
      if (ctx.options.size) {
        s += ` [options]`;
      }
      if (ctx.commandField) {
        const commands = Array.from(ctx.commandContextMap.keys()).join('|')

        s += (ctx.commandField.required)? ` <${commands}` : ` [${commands}`;

        for (let [, commandContext] of ctx.commandContextMap) {
          if (commandContext.options.size) {
            s += ' [command-options]';
            break;
          }
        }
        s += (ctx.commandField.required)? '>' : ']';
      }
      else if (ctx.general) {
        s += ` ${this._formatArgumentType(ctx.general)}`;
      }
      s += '\n';

      if (ctx.options.size) {
//        s += `\n  Options:\n`;

        let foundAdvanced = false;
        for (const option of ctx.options.values()) {
          // Skip hidden options and handle advanced options based on showAdvanced flag
          if (option.hidden) continue;
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

          optionSyntax += ` ${this._formatArgumentType(option)}`;

          // Pad the syntax column to align descriptions
          optionSyntax = optionSyntax.padEnd(60 - indent);

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
            markers.push(`default: ${option.default}`);
          }

          // Add advanced marker if needed
          const markersText = markers.length ? `(${markers.join(', ')})` : ''

          const d = [description, markersText].filter(item => !!item).join(' ');

          s += `${optionSyntax} - ${d}\n`;
        }
      }
      if (ctx.commandField) {
        if (command) {
//          s += '\n  Subcommands:\n\n';
        }
        else {
//          s += '\n  Commands:\n\n';
        }
        s += '\n';
        for (const [commandName, commandContext] of ctx.commandContextMap) {
          s += formatContext(commandContext, commandName, 2);
        }
      }
      let margin = indent? ' '.repeat(indent) : '';

      return s.split('\n').map(line => margin + line).join('\n') + '\n';

    }

    return formatContext(ctx);
  }

  /**
   * Generate help text based on configurator schema
   * @param {Configurator} configurator
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {boolean} showAdvanced - Whether to show advanced options
   * @returns {string} Formatted help text
   */
  /*
  _xhelp(configurator, context, showAdvanced = false) {

    const appName = context.appName ?? 'command';
    const prefix = toCamelCase(appName);
    const {options, aliases, flags, general} = this._generateOptions(configurator, prefix);
    const generalField = configurator.schema.getTaggedField('general');
    const generalValues = [];

    let help = `Usage: ${appName} [options]`;

    if (general) {
      help += ` ${this._formatArgumentType(general)}`;
    }

    help += '\n\nOptions:\n';

    let foundAdvanced = false;

    // Convert options to array and sort them
    const sortedOptions = Array.from(options.values()).sort((a, b) => {
      // Sort by top level first
      if (a.isTopLevel !== b.isTopLevel) {
        return b.isTopLevel - a.isTopLevel;
      }

      if (a.schema.category !== b.schema.category) {
        if (a.schema.category === undefined) {
          return -1;
        }
        else if (b.schema.category === undefined) {
          return 1;
        }
        else {
          return a.schema.category.localeCompare(b.schema.category);
        }
      }

      // Then alphabetically by long option name
      return a.longOption.localeCompare(b.longOption);
    });


    let lastCategory = undefined;
    let lastSchema = undefined;

    // Process each option

    for (const option of sortedOptions) {
      // Skip hidden options and handle advanced options based on showAdvanced flag
      if (option.hidden) continue;
      if (option.advanced) {
        foundAdvanced = true;
        if (!showAdvanced) continue;
      }

      if (option.schema.category !== lastCategory) {
        help += `\n\nCategory: ${toHeadline(option.schema.category)}\n`
        lastCategory = option.schema.category;
        lastSchema = option.schema.id;
      }
      else if (lastSchema !== option.schema.id) {
        lastSchema = option.schema.id;
        help += '\n';
      }


      let optionSyntax = `  --${option.longOption}`;

      if (option.flag) {
        optionSyntax += ` (-${option.flag})`;
      }
      if (option.alias) {
        optionSyntax += ` (--${option.alias})`;
      }

      // Add any flags

      optionSyntax += ` ${this._formatArgumentType(option, option.type)}`;

      // Pad the syntax column to align descriptions
      optionSyntax = optionSyntax.padEnd(60);

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
        markers.push(`default: ${option.default}`);
      }

      // Add advanced marker if needed
      const markersText = markers.length ? `(${markers.join(', ')})` : ''

      const d = [description, markersText].filter(item => !!item).join(' ');

      help += `${optionSyntax} - ${d}\n`;
    }

    return help;
  }

   */

  _formatArgumentType(option) {
    // yuck.  validators should self-format!
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
          argumentTypeString = `number ${option.validator['$range'].min}-${option.validator['$range'].max}`;
        }
        else if (option.validator['$range'].min) {
          argumentTypeString = `number (${option.validator['$range'].min}+)`;
        }
        else if (option.validator['$range'].max) {
          argumentTypeString = `number <=${option.validator['$range'].max}`;
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
}

export class CommandLineError extends ConfiguratorError {
  constructor(message, data) {
    super(message, data);
  }
}