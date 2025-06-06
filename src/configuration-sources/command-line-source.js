import { deepAssign, toKebabCase } from '../utils.js';
import { ConfigurationSource } from './configuration-source.js';

/**
 * Command line argument parser strategy
 */
export class CommandLineSource extends ConfigurationSource
{
  constructor(options) {
    super('command-line-source', options?.sequence || ConfigurationSource.DefaultSequence.ARGUMENTS);

    this.contextFieldName = options?.contextFieldName ?? 'argv'
  }

  generateOptions(schema) {

    // generate long options;
    const options = new Map();

    for (const [fieldPath, fieldOptions] of schema.getAllFieldPaths()) {
      const longOption = toKebabCase(fieldPath);
      options.set(longOption, {...fieldOptions, longOption})
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
    const args = argv.length > 2 && argv[0].includes('node') ? argv.slice(2) : argv;

//    const config = {};

    const fieldValues = new Map();
    const mainField = schema.getMainField();
    const mainValues = [];

    const {options, aliases, flags} = this.generateOptions(schema);

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
    const peekArgumentValue = () => {
      try {
        return (i < args.length && `${args[i]}`.charAt(0) !== '-') ? args[i] : null
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
        // Handle help flags specially
        if (arg === '--help') {

          let showAdvanced = false;
          if (peekArgumentValue() === 'advanced') {
            i++;
            showAdvanced = true;
          }
          if (showAdvanced) {
            console.log(this.help('command', true));
          } else {
            console.log(this.help('command', false));
          }
          process.exit(0);
        }

        // Long option: --option or --option=value
        const [optionPart, ...valueParts] = arg.slice(2).split('=');
        const kebabName = optionPart;
        const hasInlineValue = valueParts.length > 0;
        const inlineValue = valueParts.join('=');

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
   * @param {string} programName - Name of the program
   * @param {boolean} showAdvanced - Whether to show advanced options
   * @returns {string} Formatted help text
   */
  help(programName = 'command', showAdvanced = false) {
    const fields = this.schema.getFields();
    const allPaths = this.schema.getAllFieldPaths();
    const mainField = this.schema.getMainField();

    let help = `Usage: ${programName}`;

    // Add main field to usage if it exists
    if (mainField && !mainField.options.hidden &&
        (!mainField.options.advanced || showAdvanced)) {
      const mainName = mainField.name;
      help += mainField.options.required ? ` <${mainName}>` : ` [${mainName}]`;
      if (mainField.options.type === 'array') {
        help += '...';
      }
    }

    help += ' [options]\n\n';

    // Main field description
    if (mainField && !mainField.options.hidden &&
        (!mainField.options.advanced || showAdvanced)) {
      help += 'Arguments:\n';
      help += `  ${mainField.name.padEnd(30)} ${mainField.options.description}`;
      if (mainField.options.inherit) {
        help += ' [inherited]';
      }
      help += '\n\n';
    }

    // Options section
    help += 'Options:\n';

    // Root fields first
    for (const [fieldName, fieldOptions] of fields) {
      // Skip hidden fields
      if (fieldOptions.hidden) continue;
      // Skip advanced fields unless requested
      if (fieldOptions.advanced && !showAdvanced) continue;
      // Skip main field (already handled above)
      if (fieldOptions.main) continue;

      const kebabName = this._camelToKebab(fieldName);
      let optionLine = '  ';

      // Find the flag alias for this field
      const flagAlias = [...this.flagAliases.entries()]
        .find(([flag, name]) => name === fieldName)?.[0];

      if (flagAlias) {
        optionLine += `-${flagAlias}, `;
      } else {
        optionLine += '    ';
      }

      if (fieldOptions.type === 'boolean') {
        optionLine += `--${kebabName}`;
      } else {
        optionLine += `--${kebabName} <value>`;
      }

      optionLine = optionLine.padEnd(35);
      optionLine += fieldOptions.description;

      if (fieldOptions.default !== undefined) {
        optionLine += ` (default: ${fieldOptions.default})`;
      }

      if (fieldOptions.required) {
        optionLine += ' [required]';
      }

      if (fieldOptions.advanced) {
        optionLine += ' [advanced]';
      }

      help += optionLine + '\n';
    }

    // Child fields grouped by child name
    const childGroups = new Map();
    for (const [path, fieldOptions] of allPaths) {
      if (fieldOptions.childName) {
        // Skip hidden fields
        if (fieldOptions.hidden) continue;
        // Skip advanced fields unless requested
        if (fieldOptions.advanced && !showAdvanced) continue;

        if (!childGroups.has(fieldOptions.childName)) {
          childGroups.set(fieldOptions.childName, []);
        }
        childGroups.get(fieldOptions.childName).push({ path, fieldOptions });
      }
    }

    for (const [childName, childFields] of childGroups) {
      help += `\n${childName.charAt(0).toUpperCase() + childName.slice(1)} Options:\n`;

      for (const { path, fieldOptions } of childFields) {
        const kebabName = `${this._camelToKebab(fieldOptions.childName)}-${this._camelToKebab(fieldOptions.fieldName)}`;
        let optionLine = '  ';

        // Find child alias
        const childAlias = [...this.childAliases.entries()]
          .find(([alias, aliasPath]) => aliasPath === path)?.[0];

        if (childAlias) {
          optionLine += `-${childAlias}, `;
        } else {
          optionLine += '    ';
        }

        if (fieldOptions.type === 'boolean') {
          optionLine += `--${kebabName}`;
        } else {
          optionLine += `--${kebabName} <value>`;
        }

        optionLine = optionLine.padEnd(35);
        optionLine += fieldOptions.description;

        if (fieldOptions.default !== undefined) {
          optionLine += ` (default: ${fieldOptions.default})`;
        }

        if (fieldOptions.required) {
          optionLine += ' [required]';
        }

        if (fieldOptions.advanced) {
          optionLine += ' [advanced]';
        }

        if (fieldOptions.inherit) {
          optionLine += ' [inherited]';
        }

        if (fieldOptions.inheritable) {
          optionLine += ' [inheritable]';
        }

        help += optionLine + '\n';
      }
    }

    // Add footer for advanced options if not showing them
    if (!showAdvanced && this.schema.hasAdvancedFields()) {
      help += '\nUse --help --advanced to see additional options\n';
    }

    return help;
  }
}