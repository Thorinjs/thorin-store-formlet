'use strict';
/**
 * This is the formlet model definition abstractization.
 */
const TYPES = require('./dataType');
module.exports = (thorin, opt) => {

  const namespace = Symbol(),
    domain = Symbol(),
    formlets = Symbol(),
    logger = thorin.logger(opt.logger);

  class NamespaceModel {

    constructor(namespace) {
      this[namespace] = namespace;
      this[domain] = null;
      this[_name] = null;
      this[formlets] = {};
    }

    /*
     * Manually set the namespace name
     * */
    name(name) {
      if (typeof name === 'string' && name) {
        this[_name] = name;
      }
      return this;
    }

    /*
     * Manually set the domain name
     * */
    domain(name) {
      this[domain] = name;
      return this;
    }

    /*
     * Manually set the namespace
     * */
    namespace(name) {
      this[namespace] = name;
      return this;
    }

    /*
     * Add a new formlet inside the definition
     * */
    formlet(code, name) {
      if (this[formlets][code]) {
        logger.warn(`Namespace ${code} already exists in formlet model ${this[namespace]}`);
        return null;
      }
      let formletObj = new FormletModel(code, name);
      this[formlets][code] = formletObj;
      return formletObj;
    }

    /*
     * Converts the model to the namespace specs.
     * */
    __convert() {
      let res = {
        formlets: {}
      };
      if (this[domain]) res.domain = this[domain];
      if (this[_name]) res.name = this[_name];

      Object.keys(this[formlets]).forEach((code) => {
        let fObj = this[formlets][code];
        let fData = fObj.__convert();
        if (fData) {
          res.formlets[code] = fData;
        }
      });
      return res;
    }
  }

  const _code = Symbol(),
    _name = Symbol(),
    _active = Symbol(),
    _history = Symbol(),
    _encr = Symbol(),
    _del = Symbol(),
    _erase = Symbol(),
    _upd = Symbol(),
    _max = Symbol(),
    _primary = Symbol(),
    fields = Symbol();
  class FormletModel {

    constructor(code, name) {
      this[_code] = code;
      this[_name] = name;
      this[_active] = true;
      this[_history] = true;
      this[_encr] = false;
      this[_del] = true;
      this[_erase] = true;
      this[_upd] = true;
      this[_max] = null;
      this[_primary] = null;
      this[fields] = {};
    }

    /*
     * Define the primary keys for the formlet
     * */
    primary(keys) {
      if (arguments.length > 1) {
        keys = Array.prototype.slice.call(arguments);
      }
      if (typeof keys === 'string') {
        keys = keys.replace(/ /g, ',');
        keys = keys.split(',');
      }
      if (!(keys instanceof Array)) keys = [keys];
      this[_primary] = keys;
      return this;
    }

    /*
     * Set if formlet items can be deleted/updated
     * */
    canDelete(bVal) {
      if (typeof bVal === 'boolean') {
        this[_del] = bVal;
      }
      return this;
    }

    /*
     * Sets if the formlet's entries are completely erased or just have the _deleted= true fieldset on
     * */
    canErase(bVal) {
      if (typeof bVal === 'boolean') {
        this[_erase] = bVal;
      }
      return this;
    }

    canUpdate(bVal) {
      if (typeof bVal === 'boolean') {
        this[_upd] = bVal;
      }
      return this;
    }

    /*
     * Enables/disables history for items
     * */
    history(bVal) {
      if (typeof bVal === 'boolean') {
        this[_history] = bVal;
      }
      return this;
    }

    /*
     * Mark the entries as encrypted
     * */
    encrypt(bVal) {
      if (typeof bVal === 'boolean') {
        this[_encr] = bVal;
      }
      return this;
    }

    /*
     * Sets the max number of entries
     * */
    max(count) {
      if (typeof count === 'number' && count > 0) {
        this[_max] = count;
      }
      return this;
    }

    /*
     * Adds a field
     * */
    field(code, type, opt) {
      if (typeof code !== 'string' || !code) {
        logger.warn(`Formlet ${this[_code]} encountered invalid field: ${code}`);
        return this;
      }
      if (typeof this[fields][code] !== 'undefined') {
        logger.warn(`Formlet ${this[_code]} field: ${code} already defined`);
        return this;
      }
      let field = {};
      if (typeof type === 'object' && type) {
        opt = thorin.util.extend(opt, type);
      } else if (typeof type === 'function') {
        field.type = type.name;
      }
      if (typeof type === 'string') {
        if (typeof TYPES[type] === 'undefined') {
          logger.warn(`Formlet ${this[_code]} field: ${code} has unsupported type: ${type}`);
          return this;
        }
        field.type = type;
      }
      if (typeof opt !== 'object' || !opt) opt = {};
      if (typeof opt.type === 'string') field.type = opt.type;
      if (typeof opt.defaultValue !== 'undefined') field.default_value = opt.defaultValue;
      if (opt.name) field.name = opt.name;
      if (typeof opt.reset === 'boolean') field.reset_value = opt.reset;
      if (typeof opt.required !== 'boolean' && typeof opt.is_required !== 'boolean') opt.required = true;
      if (typeof opt.required === 'boolean') field.is_required = opt.required;
      if (typeof opt.error === 'string') field.error_message = opt.error;
      if (opt.values instanceof Array) field.values = opt.values;
      if (typeof opt.validations === 'object' && opt.validations) field.validations = opt.validations;
      if (typeof field.type !== 'string') {
        logger.warn(`Formlet ${this[_code]} field: ${code} has invalid type provided`);
        return this;
      }
      this[fields][code] = field;
      return this;
    }

    /*
     * Converts the model to the namespace specs.
     * */
    __convert() {
      let res = {};
      if (this[_name]) res.name = this[_name];
      if (typeof this[_active] !== 'undefined') {
        res.is_active = this[_active];
      }
      if (typeof this[_history] !== 'undefined') {
        res.has_history = this[_history];
      }
      if (typeof this[_encr] === 'booelan') {
        res.has_encryption = this[_encr];
      }
      if (typeof this[_erase] === 'boolean') {
        res.has_erase = this[_erase];
      }
      if (typeof this[_del] === 'boolean') {
        res.can_delete = this[_del];
      }
      if (typeof this[_upd] === 'boolean') {
        res.can_update = this[_upd];
      }
      if (this[_max] != null) {
        res.max_entries = this[_max];
      }
      if (this[_primary] != null) {
        res.primary_keys = this[_primary];
      } else {
        res.primary_keys = [];
      }
      res.fields = {};
      let fieldArr = Object.keys(this[fields]);
      if (fieldArr.length === 0) {
        logger.trace(`Formlet ${this[_code]} has no defined fields. Skipping`);
        return null;
      }
      fieldArr.forEach((code) => {
        let field = this[fields][code];
        res.fields[code] = field;
      });
      return res;
    }
  }


  return NamespaceModel;
};