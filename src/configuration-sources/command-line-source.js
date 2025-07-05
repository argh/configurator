import { deepAssign, toCamelCase, toConstantCase, toHeadline, toKebabCase } from '../utils.js';
import { ConfigurationSource } from './configuration-source.js';

/**
 * Command line argument parser strategy
 */
export class CommandLineSource extends ConfigurationSource
{
  /**
   * @typedef {object} CommandLineSourceOptions
   * @property {string} [contextFieldName] - Name of the field (default:"argv") in the context object that contains the command line arguments
   * @property {boolean} [helpEnabled] - Enable/disable the help options.  Defaults to true.
   * @property {string} [helpOption] - Name of the option that shows help (--help)
   * @property {string} [helpFlag] - Short name of the flag that shows help (-h)
   * @property {string} [helpDescription] - Override description of the help option
   * @property {string} [helpValueDescription] - Override description of the help option value

   * @property {boolean} [configEnabled] - Enable/disable the config file option. Defaults to true.
   * @property {string} [configOption] - Name of the long option that specifies the configuration file path (--config)
   * @property {string} [configFlag] - Short name of the flag that specifies the configuration file path (-C)
   * @property {string} [configDescription] - Override description of the configuration file path option
   * @property {string} [configValueDescription] - Override description of the configuration file path option value
   * @property {string} [configContextFieldName] - Name of the field in the context object that will be set any the configuration file path
   */

  /**
   * @param {CommandLineSourceOptions?} options
   */
  constructor(options) {
    super('command-line-source', options?.sequence || ConfigurationSource.DefaultSequence.ARGUMENTS);

    this.contextFieldName = options?.contextFieldName ?? 'argv'

    this.helpEnabled = options?.helpEnabled ?? true;
    this.helpOption = options?.helpOption ?? 'help';
    this.helpFlag = options?.helpFlag ?? 'h';
    this.helpDescription = options?.helpDescription ?? `display help text and exit`;
    this.helpValueDescription = options?.helpValueDescription ?? 'basic|required|advanced'

    this.configEnabled = options?.configEnabled ?? true;
    this.configOption = options?.configOption ?? 'config';
    this.configFlag = options?.configFlag ?? 'C';
    this.configDescription = options?.configDescription ?? 'load additional configuration from a file';
    this.configValueDescription = options?.configValueDescription ?? 'config-path'
    this.configContextFieldName = options?.configContextFieldName ?? 'config';
  }

  /** @typedef {ExtendedFieldOptions} CommandLineOption
   * @property {string} longOption - Long option name (e.g. --help)
   * @property {string} flag - Short option name (e.g. -h)
   * @property {string} alias - Alias for the option (e.g. -h)
   * @property {boolean} isTopLevel
   */

  /** generate command line options, including flags and aliases
   * @param {ConfigurationSchema} schema
   * @param {object} context
   * @returns {{options:Map<string,CommandLineOption>, aliases: Map<string, CommandLineOption>, flags: Map<string, CommandLineOption>}}
   * @private
   */
  _generateOptions(schema, context) {

    /** @type {Map<string, CommandLineOption>} */
    const options = new Map();

    const appName = context?.appName;

    const allowedTypes = ['boolean', 'string', 'number', 'array'];

    for (const [fieldPath, fieldOptions] of schema.getAllFieldPaths({hidden: false})) {

      let type = schema.types.getType(fieldOptions.type);
      if (!type || type.options?.hidden) {
        continue;
      }

//      if (allowedTypes.indexOf(fieldOptions.type) === -1) {
//        continue;
//      }

      if (fieldOptions.general) {
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

      options.set(longOption, {...fieldOptions, longOption, isTopLevel})
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

      if (longOption.indexOf('-') === -1) {
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
   * @param {ConfigurationSchema} schema
   * @param {object} context
   * @returns {Promise<Map<string, any>>}
   * @private
   */
  async _load(schema, context, sourceOptions) {

    // hack the schema so that we can automatically get options / help for help and config, even though they
    // are magic options intercepted by the parser.
    schema = schema.copy(); // we make some destructive changes to the schema, so make a copy

    if (this.helpEnabled) {
      let helpField = {empty: true, description: this.helpDescription, flagHint: this.helpFlag, valueDescription: this.helpValueDescription};
      schema.field(this.helpOption, helpField);
    }
    if (this.configEnabled) {
      let configField = {description: this.configDescription, flagHint: this.configFlag, valueDescription: this.configValueDescription};
      schema.field(this.configOption, configField);
    }

    const appName = context?.appName;
    
    const argv = context[this.contextFieldName] ?? process.argv;

// Skip 'node' and script name if this looks like process.argv
    const args = argv.length >= 2 && argv[0].includes('node') ? argv.slice(2) : argv;

//    const config = {};

    const fieldValues = new Map();

    const generalField = schema.getTaggedField('general');
    const generalValues = [];

    const {options, aliases, flags} = this._generateOptions(schema, context);

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
          console.log(this._help(schema, context, showAdvanced));
          process.exit(0);
        }

        if (this.configOption && arg === `--${this.configOption}`) {
          let configPath;

          if (hasInlineValue) {
            configPath = inlineValue;
          }
          else {
            configPath = getArgument();
          }
          if (!configPath) {
            throw new Error(`missing path for ${this.configOption}`);
          }
          if (configPath.startsWith('-')) {
            throw new Error(`invalid path for --${this.configOption}: "${configPath}"`);
          }
          context[this.configContextFieldName] = configPath;   // setting config path in context for use in downstream source(s)
          continue;
        }


        let value;

        let optionData;

        if (options.has(kebabName)) {
          optionData = options.get(kebabName);
        }
        else if (aliases.has(kebabName)) {
          optionData = aliases.get(kebabName);
        }

        if (!optionData) {
          if (sourceOptions?.strict) {
            throw new Error(`Unknown option: --${kebabName}`);
          }
          else {
            continue;
          }
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
        else if (optionData.type === 'array') {
          if (hasInlineValue) {
            value = inlineValue.split(',');
          }
          else {
            value = [];
            while (peekArgumentValue()) {
              let a = getArgument();
              value = value.concat(a.split(','));
            }
            if (value.length === 0) {
              throw new Error(`Option ${kebabName} requires one or more values`);
            }
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
            throw new Error(`Option ${kebabName} requires a value`)
          }

        }

        fieldValues.set(optionData.path, value);

//          deepAssign(config, optionData.path, value);

      } else if (arg.startsWith('-') && arg.length > 1) {
        // Short option(s): -o or -abc
        const shortOptions = arg.slice(1);

        for (let j = 0; j < shortOptions.length; j++) {
          const shortOption = shortOptions[j];
          const isLastOption = (j === shortOptions.length - 1);

          let optionData;

          if (this.helpFlag && shortOption === this.helpFlag) {
            const showAdvanced = (isLastOption && peekArgumentValue(true) === 'advanced');

            console.log(this._help(schema, context, showAdvanced));
            process.exit(0);
          }

          if (this.configFlag && shortOption === this.configFlag) {
            const configPath = isLastOption ? peekArgumentValue(true) : null;

            if (!configPath) {
              throw new Error(`missing path for -${this.configFlag}`);
            }

            context[this.configContextFieldName] = configPath;   // setting config path in context for use in downstream source(s)
            continue;
          }

          if (flags.has(shortOptions[j])) {
            optionData = flags.get(shortOptions[j]);
          }

          if (!optionData) {
            if (sourceOptions?.strict) {
              throw new Error(`unknown option -${shortOption}`);
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
          else if (optionData.type === 'array') {
            if (isLastOption) {
              value = [];
              while (peekArgumentValue()) {
                value.push(getArgument());
              }
            }
            else {
              throw new Error(`Option -${shortOption} requires a list of values`)
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
          fieldValues.set(optionData.path, value);
        }
      }
      else {
        // Non-option argument - add to main field if it exists
        if (generalField) {
          generalValues.push(arg);
        } else {
          throw new Error(`Unexpected argument: ${arg}`);
        }
      }
    }

    // Assign main values to main field
    if (generalField && generalValues.length > 0) {
      if (generalField.type === 'array') {
        fieldValues.set(generalField.path, generalValues);
      }
      else if (generalValues.length === 1) {
        fieldValues.set(generalField.path, generalValues[0]);
      }
      else {
        throw new Error(`Too many arguments provided for ${generalField.name}: [${generalValues.join(', ')}]`)
      }

      fieldValues.set(generalField.path, generalField.type === 'array' ? generalValues : generalValues[0]);
    }

    // Validate the complete configuration
    return fieldValues;
  }



  /**
   * Generate help text based on schema
   * @param {ConfigurationSchema} schema - Schema to use for parsing
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {boolean} showAdvanced - Whether to show advanced options
   * @returns {string} Formatted help text
   */
  _help(schema, context, showAdvanced = false) {

    const appName = context?.appName;

    const {options, aliases, flags} = this._generateOptions(schema, context);
    const generalField = schema.getTaggedField('general');
    const generalValues = [];

    let help = `Usage: ${appName} [options]`;

    if (generalField) {
      help += ` ${this._formatArgumentType(generalField, schema.types.getType(generalField.type))}`;
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

      optionSyntax += ` ${this._formatArgumentType(option, schema.types.getType(option.type))}`;

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

