'use strict';
/**
 * The namespace model wrapper to include logging.
 */

module.exports = (thorin, opt) => {

  const logger = thorin.logger(opt.logger),
    api = Symbol(),
    measure = Symbol(),
    formlets = Symbol();

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

  class FormletNamespace {

    constructor(name, fObj, config) {
      this.name = name;
      this[formlets] = {};
      this[api] = fObj.namespace(name, true);
      // IF debug is not enabled, do not wrap needlessly.
      if (!debug('create', config.debug)) {
        this.create = fObj.create.bind(fObj, name);
      }
      if (!debug('read', config.debug)) {
        this.read = fObj.read.bind(fObj, name);
        this.findAll = fObj.find.bind(fObj, name);
      }
      if (!debug('update', config.debug)) {
        this.update = fObj.update.bind(fObj, name);
      }
      if (!debug('delete', config.debug)) {
        this.delete = fObj.delete.bind(fObj, name);
      }
      this[measure] = (debug('measure', config));
    }

    _addFormlet(code, data) {
      this[formlets][code] = data;
      return this;
    }

    get formlets() {
      return this[formlets];
    }

    set formlets(v) {
    }

    /*
     * Create wrapper
     * */
    create(formlet) {
      let pObj = this[api].create.apply(this[api], arguments);
      let ts;
      if (this[measure]) {
        ts = Date.now();
      }
      pObj.then((res) => {
        logger.trace(`CREATE ${this.name} of ${(typeof formlet === 'object' ? formlet.formlet : formlet)} ${dump(res, ts)}`);
        return res;
      }, (e) => {
        logger.warn(`CREATE failed for ${this.name} of ${(typeof formlet === 'object' ? formlet.formlet : formlet)}`);
        return e;
      }).catch((e) => {
        logger.warn(`CREATE failed for ${this.name} of ${(typeof formlet === 'object' ? formlet.formlet : formlet)}`);
        return Promise.reject(e);
      });
      return pObj;
    }

    read(id) {
      let pObj = this[api].read.apply(this[api], arguments);
      let ts;
      if (this[measure]) {
        ts = Date.now();
      }
      pObj.then((res) => {
        logger.trace(`READ ${this.name}: ${typeof id === 'object' ? id.id : id} ${dump(res, ts)}`);
        return res;
      }, (e) => {
        logger.warn(`READ failed for ${this.name} id: ${typeof id === 'object' ? id.id : id}`);
        return e;
      }).catch((e) => {
        logger.warn(`READ failed for ${this.name} id: ${typeof id === 'object' ? id.id : id}`);
        return Promise.reject(e);
      });
      return pObj;
    }


    update(id) {
      let pObj = this[api].update.apply(this[api], arguments);
      let ts;
      if (this[measure]) {
        ts = Date.now();
      }
      pObj.then((res) => {
        logger.trace(`UPDATE ${this.name} id: ${typeof id === 'object' ? id.id : id} ${dump(res, ts)}`);
        return res;
      }, (e) => {
        logger.warn(`UPDATE failed for ${this.name} id: ${typeof id === 'object' ? id.id : id}`);
        return e;
      }).catch((e) => {
        logger.warn(`UPDATE failed for ${this.name} id: ${typeof id === 'object' ? id.id : id}`);
        return Promise.reject(e);
      });
      return pObj;
    }

    delete(id) {
      let pObj = this[api].delete.apply(this[api], arguments);
      let ts;
      if (this[measure]) {
        ts = Date.now();
      }
      pObj.then((res) => {
        logger.trace(`DELETE ${this.name} id: ${typeof id === 'object' ? id.id : id} ${dump(res, ts)}`);
        return res;
      }, (e) => {
        logger.warn(`DELETE failed for ${this.name} id: ${typeof id === 'object' ? id.id : id}`);
        return e;
      }).catch((e) => {
        logger.warn(`DELETE failed for ${this.name} id: ${typeof id === 'object' ? id.id : id}`);
        return Promise.reject(e);
      });
      return pObj;
    }

    findAll() {
      let pObj = this[api].find.apply(this[api], arguments);
      let ts;
      if (this[measure]) {
        ts = Date.now();
      }
      pObj.then((res) => {
        logger.trace(`FIND ${this.name} ${dump(res, ts)}`);
        return res;
      }, (e) => {
        logger.warn(`FIND failed for ${this.name}`);
        return e;
      }).catch((e) => {
        logger.warn(`FIND failed for ${this.name}`);
        return Promise.reject(e);
      });
      return pObj;
    }

    /* Wrapper function */
    find() {
      return this.findAll.apply(this, arguments);
    }

    findOne() {
      return this.read.apply(this, arguments);
    }

    history(id) {
      let pObj = this[api].history.apply(this[api], arguments);
      let ts;
      if (this[measure]) {
        ts = Date.now();
      }
      pObj.then((res) => {
        logger.trace(`HISTORY ${this.name} id: ${typeof id === 'object' ? id.id : id} ${dump(res, ts)}`);
        return res;
      }, (e) => {
        logger.warn(`HISTORY failed for ${this.name}`);
        return e;
      }).catch((e) => {
        logger.warn(`HISTORY failed for ${this.name}`);
        return Promise.reject(e);
      });
      return pObj;
    }

  }
  return FormletNamespace;
};