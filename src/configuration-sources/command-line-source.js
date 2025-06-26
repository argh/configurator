import { deepAssign, toCamelCase, toKebabCase } from '../utils.js';
import { ConfigurationSource } from './configuration-source.js';

/**
 * Command line argument parser strategy
 */
export class CommandLineSource extends ConfigurationSource
{
  constructor(options) {
    super('command-line-source', options?.sequence || ConfigurationSource.DefaultSequence.ARGUMENTS);

    this.contextFieldName = options?.contextFieldName ?? 'argv'

    this.helpOption = options?.helpOption ?? 'help';
    this.helpFlag = options?.helpFlag ?? 'h';

    this.configOption = options?.configOption ?? 'config';
    this.configFlag = options?.configFlag ?? 'C';

    this.configContextFieldName = options?.configContextFieldName ?? 'config';
  }

  generateOptions(schema, context) {

    // generate long options;
    const options = new Map();

    const appName = context?.appName;

    const allowedTypes = ['boolean', 'string', 'number', 'array'];

    for (const [fieldPath, fieldOptions] of schema.getAllFieldPaths({hidden: false})) {
      if (allowedTypes.indexOf(fieldOptions.type) === -1) {
        continue;
      }

      let longOption;
      if (appName && fieldPath.indexOf(`${toCamelCase(appName)}.`) === 0) {
        longOption = toKebabCase(fieldPath.substring(fieldPath.indexOf('.') + 1));
      }
      else {
        longOption = toKebabCase(fieldPath);
      }

      options.set(longOption, {...fieldOptions, longOption, isTopLevel: fieldPath.indexOf('.') === -1})
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
      if (optionData.advanced || optionData.hidden) {
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
  async _load(schema, context) {

    const argv = context[this.contextFieldName] ?? process.argv;

// Skip 'node' and script name if this looks like process.argv
    const args = argv.length >= 2 && argv[0].includes('node') ? argv.slice(2) : argv;

//    const config = {};

    const fieldValues = new Map();
    const mainField = schema.getMainField();
    const mainValues = [];

    const {options, aliases, flags} = this.generateOptions(schema, context);

    let i = 0;

    const getArgument = () => {
      if (i < args.length) {
        const ret = args[i];
        i++;
        return ret;
      }
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
      catch (err) {
        return null;
      }
    }

    while (i < args.length) {
      const arg = getArgument();

      if (arg === '--') {
        // Everything after -- goes to main field
        if (mainField) {
          mainValues.push(...args.slice(i + 1));
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
        if (this.helpOption && arg === `--${this.helpOption}`) {
          let showAdvanced = false;
          if (hasInlineValue && inlineValue === 'advanced') {
            showAdvanced = true;
          }
          else if (peekArgumentValue(true) === 'advanced') {
            showAdvanced = true;
          }
          console.log(this.help(schema, context, showAdvanced));
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
          throw new Error(`Unknown option: --${kebabName}`);
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
            value = inlineValue;
          }
          else {
            value = [];
            while (peekArgumentValue()) {
              value.push(getArgument());
            }
            if (value.length === 0) {
              throw new Error(`Option ${kebabName} requires one or more values`);
            }
          }
        }
        else {
          if (!peekArgumentValue()) {
            throw new Error(`Option ${kebabName} requires a value`)
          }
          value = getArgument();
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

            console.log(this.help(schema, context, showAdvanced));
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
            throw new Error(`unknown option -${shortOption}`);
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
        if (mainField) {
          mainValues.push(arg);
        } else {
          throw new Error(`Unexpected argument: ${arg}`);
        }
      }
    }

    // Assign main values to main field
    if (mainField && mainValues.length > 0) {
      // FIXME ? mainField has no path
      fieldValues.set(mainField.name, mainField.options.type === 'array' ? mainValues : mainValues[0]);
    }

    // Validate the complete configuration
    return fieldValues;
  }



  /**
   * Generate help text based on schema
   * @param {ConfigurationSchema} schema - Schema to use for generating help text
   * @param {object} context - Context to use for generating help text
   * @param {boolean} showAdvanced - Whether to show advanced options
   * @returns {string} Formatted help text
   */
  help(schema, context, showAdvanced = false) {

    let help = '';

    // TODO

    // Add footer for advanced options if not showing them
    if (!showAdvanced && this.schema.hasAdvancedFields()) {
      help += '\nUse --help --advanced to see additional options\n';
    }

    return help;
  }
}