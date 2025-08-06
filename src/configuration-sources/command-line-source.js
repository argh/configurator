import { deepAssign, toCamelCase, toConstantCase, toHeadline, toKebabCase } from '../utils.js';
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
   * @param {object} context
   * @returns {{options:Map<string,CommandLineOption>, aliases: Map<string, CommandLineOption>, flags: Map<string, CommandLineOption>}}
   * @private
   */
  _generateOptions(configurator, context) {

    /** @type {Map<string, CommandLineOption>} */
    const options = new Map();

    const appName = context?.appName;

    for (const [fieldPath, fieldDescriptor] of configurator.schema.getAllFieldPaths({hidden: false})) {

      let type = configurator.types.getType(fieldDescriptor.type);
      if (!type || type.options?.hidden) {
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
      if (appName && fieldPath.indexOf(`${toCamelCase(appName)}.`) === 0) {
        longOption = toKebabCase(fieldPath.substring(fieldPath.indexOf('.') + 1));
        isTopLevel = true;
      }
      else {
        longOption = toKebabCase(fieldPath);
      }

      options.set(longOption, {...fieldDescriptor, longOption, isTopLevel})
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

    return {options, aliases, flags}
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

    const generalField = configurator.schema.getTaggedField('general');
    const generalValues = [];

    const {options, aliases, flags} = this._generateOptions(configurator, context);

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
        if (generalField) {
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

        if (options.has(kebabName)) {
          optionData = options.get(kebabName);
        }
        else if (aliases.has(kebabName)) {
          optionData = aliases.get(kebabName);
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

        if (optionData.type === 'boolean') {
          if (hasInlineValue) {
            value = inlineValue;
          }
          else if (peekArgumentValue()){
            value = getArgument();
          }
          else {
            value = true;
          }
        }
        else if (optionData.type === 'array' || (optionData.type.startsWith('[') && optionData.type.endsWith(']'))) {
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
        // todo - support inline options?
        // Short option(s): -o or -abc
        const shortOptions = arg.slice(1);

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

          if (flags.has(shortOptions[j])) {
            optionData = flags.get(shortOptions[j]);
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
          if (optionData.type === 'boolean') {
            if (isLastOption && peekArgumentValue()) {
              value = getArgument();
            }
            else {
              value = true;
            }
          }
          else if (optionData.type === 'array' || (optionData.type.startsWith('[') && optionData.type.endsWith(']'))) {
            if (isLastOption) {
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
            if (isLastOption && peekArgumentValue()) {
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
        // Non-option argument - add to main field if it exists
        if (generalField) {
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
    if (generalField && generalValues.length > 0) {
      if (generalField.type === 'array' || (generalField.type.startsWith('[') && generalField.type.endsWith(']'))) {
        fieldAssignments.set(generalField.path, generalValues);
      }
      else if (generalValues.length === 1) {
        fieldAssignments.set(generalField.path, generalValues[0]);
      }
      else {
        throw new CommandLineError(`Too many arguments provided for ${generalField.name}: [${generalValues.join(', ')}]`)
      }

      const isArray = generalField.type === 'array' || (generalField.type.startsWith('[') && generalField.type.endsWith(']'));

      fieldAssignments.set(generalField.path, isArray? generalValues : generalValues[0]);
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

    const appName = context.appName ?? 'command';

    const {options, aliases, flags} = this._generateOptions(configurator, context);
    const generalField = configurator.schema.getTaggedField('general');
    const generalValues = [];

    let help = `Usage: ${appName} [options]`;

    if (generalField) {
      help += ` ${this._formatArgumentType(generalField, configurator.types.getType(generalField.type))}`;
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

      optionSyntax += ` ${this._formatArgumentType(option, configurator.types.getType(option.type))}`;

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

  _formatArgumentType(fieldData, type) {

    let argumentTypeString;

    if (fieldData.valueDescription) {
      argumentTypeString = typeof fieldData.valueDescription === 'function' ? fieldData.valueDescription() : fieldData.valueDescription;
    }
    else if (fieldData.type === 'string') {

      if (typeof fieldData.validator === 'string') {
        argumentTypeString = fieldData.validator.substring(1);
      }
      else if (typeof fieldData.validator === 'object'
               && Array.isArray(fieldData.validator['$oneof'])) {
        argumentTypeString = fieldData.validator['$oneof'].join('|')
      }
      else {
        argumentTypeString = 'string-value'
      }
    }
    else if (fieldData.type === 'number') {
      if (typeof fieldData.validator === 'string') {
        argumentTypeString = fieldData.validator.substring(1);
      }
      else {
        argumentTypeString = 'number'
      }
    }
    else if (fieldData.type === 'boolean') {
      argumentTypeString = 'true|false'
    }
    else if (fieldData.type.startsWith('[') && fieldData.type.endsWith(']')) {
      argumentTypeString = `${fieldData.type.substring(1, fieldData.type.length - 1) || 'string'}...`
    }
    else if (fieldData.type === 'array') {
      if (typeof fieldData.validator === 'string') {
        argumentTypeString = fieldData.validator.substring(1);  // implied $each for simple arrays
      }
      if (typeof fieldData.validator === 'object' && fieldData.validator['$each']) {
        if (typeof fieldData.validator['$each'] === 'string') {
          argumentTypeString = `${fieldData.validator['$each'].substring(1)}...`;
        }
        else {
          argumentTypeString = 'value...';
        }
      }
      else {
        argumentTypeString = 'value...';
      }
    }
    else if (type?.options?.valueDescription) {
      argumentTypeString = typeof type.options.valueDescription === 'function' ? type.options.valueDescription() : type.options.valueDescription;
    }
    else {
      argumentTypeString = 'value';
    }

    if (fieldData.type === 'boolean' || fieldData.empty) {
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