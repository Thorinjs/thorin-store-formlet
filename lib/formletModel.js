'use strict';
/**
 * The formlet model wrapper to include logging.
 */
const TYPES = require('./dataType'),
  decamelize = require('decamelize');
const NAME_SEPARATOR = '_';
module.exports = (thorin, opt) => {

  const logger = thorin.logger(opt.logger);

  function debug(operation, config) {
    if (config === true) return true;
    if (config === false) return false;
    if (typeof config === 'object' && config) {
      if (config[operation] === false) return false;
    }
    return true;
  }

  function dump(res, ts) {
    if (thorin.env !== 'development') return '';
    delete res.payload.namespace;
    if (res.payload.formlet === '_all') {
      delete res.payload.formlet;
    }
    let tmp = `: ` + JSON.stringify(res.payload);
    if (ts) {
      let took = Date.now() - ts;
      tmp = `(${took}ms)` + tmp;
    }
    return tmp;
  }


  const fields = Symbol(),
    relations = Symbol(),
    uniques = Symbol(),
    namespace = Symbol(),
    namespaceOpt = Symbol(),
    measure = Symbol(),
    api = Symbol(),
    parent = Symbol(),
    data = Symbol();

  class FormletModel {

    constructor(name, fObj, config) {
      this.name = name;
      this[fields] = {};
      this[relations] = [];
      this[uniques] = [];
      this[namespace] = null;
      this[parent] = null;
      this[measure] = (debug('measure', config));
      this[data] = {};
    }

    get fields() {
      return this[fields]
    }

    set fields(v) {
    }

    getSyncData() {
      let d = thorin.util.extend(this[data]);
      d.code = this.name;
      d.namespace = this[namespace];
      if (this[parent]) {
        d.code = this[parent] + '/' + d.code;
      }
      return d;
    }

    getNamespace(onlyCode) {
      if (onlyCode === true) return this[namespace];
      let opt = this[namespaceOpt] || {};
      opt.code = this[namespace];
      return opt;
    }

    getFields() {
      let res = [];
      Object.keys(this[fields]).forEach((name) => {
        let d = thorin.util.extend(this[fields][name]);
        d.code = name;
        res.push(d);
      });
      return res;
    }

    getRelations() {
      let res = [];
      for (let i = 0, len = this[relations].length; i < len; i++) {
        res.push(thorin.util.extend(this[relations][i]));
      }
      return res;
    }

    getUniques() {
      let res = [];
      for (let i = 0, len = this[uniques].length; i < len; i++) {
        res.push(this[uniques][i].concat([]));
      }
      return res;
    }

    namespace(ns, _opt) {
      if (typeof this[namespace] !== 'string') this[namespace] = ns;
      if (typeof _opt === 'object' && _opt) {
        this[namespaceOpt] = opt;
      }
      return this;
    }

    /**
     * PRE-INITIALIZATION METHODS, USED FOR DEFINING THE FORMLET MODEL
     * */
    name(name) {
      if (typeof name === 'string') {
        this[data].name = name;
      }
      return this;
    }

    parent(name) {
      if (typeof name === 'string') {
        this[parent] = decamelize(name, NAME_SEPARATOR);
      }
      return this;
    }

    customId() {
      this[data].has_custom_id = true;
      return this;
    }

    canDelete(val) {
      if (typeof val === 'boolean') {
        this[data].can_delete = val;
      }
      return this;
    }

    canErase(val) {
      if (typeof val === 'boolean') {
        this[data].can_erase = val;
      }
      return this;
    }

    canUpdate(val) {
      if (typeof val === 'boolean') {
        this[data].can_update = val;
      }
      return this;
    }

    hasHistory(val) {
      if (typeof val === 'boolean') {
        this[data].has_history = val;
      }
      return this;
    }

    max(val) {
      if (typeof val === 'number') {
        this[data].max_entries = val;
      }
      return this;
    }

    /**
     * ATTACH a new field to the formlet
     * */
    field(code, type, opt) {
      if (typeof code !== 'string' || !code) {
        logger.warn(`Formlet ${this.name} encountered invalid field: ${code}`);
        return this;
      }
      if (typeof this[fields][code] !== 'undefined') {
        logger.warn(`Formlet ${this.name} field: ${code} already defined`);
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
      if (typeof opt.name === 'string') field.name = opt.name;
      if (typeof opt.reset === 'boolean') field.reset_value = opt.reset;
      if (typeof opt.required === 'boolean') field.is_required = opt.required;
      if (typeof opt.error === 'object' && opt.error) {
        if (typeof opt.error.required === 'string') field.error_required = opt.error.required;
        if (typeof opt.error.invalid === 'string') field.error_invalid = opt.error.invalid;
      } else if (typeof opt.error === 'string') {
        field.error_required = opt.error;
      }
      if (typeof opt.required === 'string') {
        field.is_required = true;
        field.error_required = opt.required;
      }
      if (typeof opt.invalid === 'string') {
        field.error_invalid = opt.invalid;
      }
      if (opt.values instanceof Array) field.values = opt.values;
      if (typeof opt.validations === 'object' && opt.validations) field.validations = opt.validations;
      if (typeof field.type !== 'string') {
        logger.warn(`Formlet ${this.name} field: ${code} has invalid type provided`);
        return this;
      }
      this[fields][code] = field;
      return this;
    }

    /**
     * Attach an encrypted field to the formlet.
     * */
    encryptedField(code, opt, _opt) {
      let TYPE;
      if (Array.prototype.slice.call(arguments).length === 3) {
        // we have code,type,opt
        TYPE = opt;
        opt = _opt;
      } else {
        TYPE = TYPES.STRING;
      }
      if (typeof opt !== 'object' || !opt) opt = {};
      opt.is_encrypted = true;
      this.field(code, TYPE, opt);
      return this;
    }

    /**
     * Mark a field as an index
     * */
    index(code, opt) {
      // We have single index definition, with no unique
      if (typeof code === 'string' && code && (typeof opt !== 'object' || !opt)) {
        if (typeof this[fields][code] !== 'object' || !this[fields][code]) {
          logger.warn(`Formlet ${this.name} does not have field: ${code} for index()`);
          return this;
        }
        this[fields][code].is_index = true;
        return this;
      }
      if (!(code instanceof Array)) code = [code];
      if (typeof opt !== 'object' || !opt || !opt.unique) {
        for (let i = 0, len = code.length; i < len; i++) {
          if (typeof code[i] !== 'string') continue;
          this.index(code[i]);
        }
        return this;
      }
      let uniqueFields = [];
      for (let i = 0, len = code.length; i < len; i++) {
        if (typeof code[i] === 'string') uniqueFields.push(code[i]);
      }
      this[uniques].push(uniqueFields);
      return this;
    }

    /**
     * FIELD relations
     * */
    belongsTo(target, opt) {
      if (typeof target !== 'string' || !target) {
        logger.warn(`Formlet ${this.name} belongsTo() requires a target`);
        return this;
      }
      let rel = {
        formlet: this.name,
        relation: 'belongs_to',
        target: target
      };
      if (typeof opt !== 'object' || !opt) opt = {};
      if (opt.alias) {
        rel.alias = opt.alias;
      } else if (opt.as) rel.alias = opt.as;
      if (opt.foreignKey) rel.foreign_key = opt.foreignKey;
      this[relations].push(rel);
      return this;
    }

    hasOne(target) {
      if (typeof target !== 'string' || !target) {
        logger.warn(`Formlet ${this.name} hasOne() requires a target`);
        return this;
      }
      let rel = {
        formlet: this.name,
        relation: 'has_one',
        target: target
      };
      if (typeof opt !== 'object' || !opt) opt = {};
      if (opt.alias) rel.alias = opt.alias;
      if (opt.foreignKey) rel.foreign_key = opt.foreignKey;
      this[relations].push(rel);
      return this;
    }

    /*
     * Checks if we're valid.
     * */
    isValid() {
      if (!this.name || !this[namespace]) return false;
      if (Object.keys(this[fields]).length === 0 && this[relations].length === 0) return false;
      return true;
    }


    /**
     * PRIVATE FUNCTIONALITY
     * */
    __init(apiObj, config) {
      this[api] = apiObj.formlet(this.name, true);
      let self = this,
        $api = this[api];
      // IF debug is not enabled, do not wrap needlessly.
      let _createFn = apiObj.create.bind($api),
        _readFn = apiObj.read.bind($api),
        _findFn = apiObj.find.bind($api),
        _updateFn = apiObj.update.bind($api),
        _deleteFn = apiObj.delete.bind($api);
      if (debug('create', config)) {
        this.create = function () {
          return _createFn.apply($api, arguments).then((res) => {
            let req = res.request;
            logger.trace(`CREATE: ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            delete res.request;
            return res;
          }).catch((e) => {
            let req = e.request;
            logger.trace(`CREATE FAIL: [${e.code}] ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            return Promise.reject(e);
          });
        }
      } else {
        this.create = _createFn;
      }
      if (debug('read', config)) {
        this.read = function () {
          return _readFn.apply($api, arguments).then((res) => {
            let req = res.request;
            logger.trace(`READ: ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            delete res.request;
            return res;
          }).catch((e) => {
            let req = e.request;
            logger.trace(`READ FAIL: [${e.code}] ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            return Promise.reject(e);
          });
        }
        this.findOne = this.read;
      } else {
        this.read = _readFn;
        this.findOne = _readFn;
      }
      if (debug('find', config)) {
        this.find = function () {
          return _findFn.apply($api, arguments).then((res) => {
            let req = res.request;
            logger.trace(`FIND: ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            delete res.request;
            return res;
          }).catch((e) => {
            let req = e.request;
            logger.trace(`FIND FAIL: [${e.code}] ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            return Promise.reject(e);
          });
        }
      } else {
        this.findAll = _findFn;
        this.find = this.findAll;
      }
      if (debug('update', config)) {
        this.update = function () {
          return _updateFn.apply($api, arguments).then((res) => {
            let req = res.request;
            logger.trace(`UPDATE: ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            delete res.request;
            return res;
          }).catch((e) => {
            let req = e.request;
            logger.trace(`UPDATE FAIL: [${e.code}] ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            return Promise.reject(e);
          });
        }
      } else {
        this.update = _updateFn;
      }
      if (debug('delete', config)) {
        this.destroy = function () {
          return _deleteFn.apply($api, arguments).then((res) => {
            let req = res.request;
            logger.trace(`DELETE: ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            delete res.request;
            return res;
          }).catch((e) => {
            let req = e.request;
            logger.trace(`DELETE FAIL: [${e.code}] ${this.name} -> ${JSON.stringify(req.filter || {})} = ${JSON.stringify(req.payload)}`);
            return Promise.reject(e);
          });
        };
        this.delete = this.destroy;
      } else {
        this.destroy = _deleteFn;
        this.delete = _deleteFn;
      }
    }
  }

  return FormletModel;
};