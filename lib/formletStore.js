'use strict';
const formlet = require('formlet'),
  path = require('path'),
  decamelize = require('decamelize'),
  initNamespace = require('./namespace'),
  initCrudify = require('./crudifyFormlet');

const NAME_SEPARATOR = "_";

/**
 * Created by Adrian on 06-Jan-17.
 */
module.exports = (thorin, opt) => {
  const config = Symbol(),
    instance = Symbol(),
    models = Symbol(),
    async = thorin.util.async,
    logger = thorin.logger(opt.logger);

  const Namespace = initNamespace(thorin, opt),
    crudify = initCrudify(thorin, opt);


  class ThorinFormletStore extends thorin.Interface.Store {
    static publicName() {
      return "formlet";
    }

    constructor() {
      super();
      this.type = "formlet";
      this[config] = {};
      this[instance] = null;
      this[models] = {};
    }

    /*
     * Initializes the store with its configuration
     * */
    init(storeConfig) {
      this[config] = thorin.util.extend({
        debug: {
          create: true,
          read: true,
          update: true,
          delete: true,
          measure: true   // should we measure ms
        },
        path: {
          formlets: path.normalize(thorin.root + '/app/formlets') // the formlet definition files
        },
        host: process.env.FORMLET_HOST || 'https://formlet.io',
        key: process.env.FORMLET_KEY || ''
      }, storeConfig);
      this[instance] = new formlet(this[config]);
      /* read up all models. */
      loadFormlets.call(this, this[config]);
      thorin.config('store.' + this.name, this[config]);
    }

    /*
     * Connect to formlet and test out credentials.
     * */
    run(done) {
      if (!this[config].key) return done(thorin.error('FORMLET.CREDENTIALS', 'Missing Formlet key'));
      let calls = [],
        fObj = this.getInstance();
      /* check token */
      calls.push(() => {
        return fObj.dispatch('auth.check', {});
      });
      thorin.series(calls, done);
    }

    getInstance() {
      return this[instance];
    }

    /*
     * Initiate the setup and synchronization process for the given data.
     * */
    setup(done) {
      let formletPath = this[config].path.formlets,
        iObj = this.getInstance();
      if (!formletPath) {
        logger.trace(`No formlet path set, setup will stop`);
        return done();
      }
      let calls = [],
        fullTook = 0;
      let formlets = thorin.util.readDirectory(formletPath, {
        relative: true,
        levels: 1,
        ext: '.js'
      });
      if (formlets.length === 0) {
        logger.trace(`No formlet models found, setup will stop`);
        return done();
      }
      logger.info(`Initializing formlet structure setup ${formlets.length}`);
      formlets.sort((a, b) => a.localeCompare(b));
      formlets.forEach((fileName) => {
        let itemName = decamelize(fileName, NAME_SEPARATOR),
          itemData;
        itemName = itemName.replace(/\.js/g, '');
        try {
          itemData = require(`${formletPath}/${fileName}`);
        } catch (e) {
          logger.error(`Could not require model ${fileName} data`);
          logger.error(e);
          return;
        }
        calls.push(() => {
          let payload = {};
          payload[itemName] = itemData;
          let took = Date.now();
          return iObj.sync(payload).then(() => {
            took = Date.now() - took;
            fullTook += took;
            logger.debug(`Synchronized ${itemName} (${took}ms)`);
          }).catch((e) => {
            logger.error(`Could not synchronize ${itemName}`);
            logger.debug(e);
            return Promise.reject(e);
          });
        });
      });

      calls.push(() => {
        logger.info(`Formlet setup completed (took ${fullTook}ms)`);
      });

      thorin.series(calls, done);
    };

    /*
     * Returns a namespaced model.
     * */
    model(namespace) {
      let iObj = this.getInstance();
      if (!iObj) return null;
      namespace = decamelize(namespace, NAME_SEPARATOR);
      if (!this[models][namespace]) {
        this[models][namespace] = new Namespace(namespace, iObj, this[config]);
      }
      return this[models][namespace];
    }

    /*
     * Manually execute a dispatch to formlet.io
     * */
    query(type, payload) {
      let fObj = this.getInstance();
      if (!fObj) return Promise.reject(thorin.error('FORMLET.NOT_READY', 'Formlet is not ready yet'));
      if (this[config].debug) {
        let full = '';
        if (thorin.env === 'development') {
          full = ': ' + JSON.stringify(payload);
        }
        logger.trace(`QUERY ${type} ${full}`);
      }
      return fObj.dispatch(type, payload);
    }

    /*
     * The crudify function will attach CREATE, READ, FIND, UPDATE, DELETE
     * on the given model name.
     * Arguments:
     *   modelName - the model name we want to crudify.
     *   action - the actions we want to attach. Defaults to all.
     *   options - additional options to pass.
     *      - action - the action we want to register.

     * */
    crudify(modelName, action, opt) {
      const namespaceObj = this.model(modelName);
      if (typeof opt !== 'object' || !opt) opt = {};
      if (!opt.name) {
        opt.name = modelName.code;
      }
      if (['create', 'read', 'update', 'delete', 'find'].indexOf(action) === -1) {
        console.error(`Crudify action for model ${modelName} is not valid.`);
        return;
      }
      const actionObj = crudify[action](namespaceObj, opt);
      if (!actionObj) {
        logger.warn(`Crudify ${action} for model ${modelName} was not registered.`);
        return;
      }
      thorin.on(thorin.EVENT.RUN, 'store.' + this.name, () => {
        thorin.dispatcher.addAction(actionObj);
      });
      return actionObj;
    }
  }

  /*
   * Load up all formlets
   * */
  function loadFormlets(config) {
    if (!config.path.formlets) return;
    let formletPath = config.path.formlets;
    let namespaces = thorin.util.readDirectory(formletPath, {
      relative: true,
      levels: 1,
      ext: '.js'
    });
    if (namespaces.length === 0) {
      return;
    }
    namespaces.sort((a, b) => a.localeCompare(b));
    let loaded = {};
    for (let i = 0; i < namespaces.length; i++) {
      let fileName = namespaces[i];
      let itemName = decamelize(fileName.replace(/\.js/g, ''), NAME_SEPARATOR),
        itemData;
      try {
        itemData = require(`${formletPath}/${fileName}`);
      } catch (e) {
        logger.error(`Could not require model ${fileName} data`);
        logger.error(e);
        continue;
      }
      loaded[itemName] = itemData;
    }
    // now, for each loaded namespace, look into its formlets.
    Object.keys(loaded).forEach((namespace) => {
      let nsObj = this.model(namespace);
      let nsData = loaded[namespace];
      if (!nsData.formlets) return;
      Object.keys(nsData.formlets).forEach((formlet) => {
        let formletData = nsData.formlets[formlet];
        nsObj._addFormlet(formlet, formletData);
      });
    });
  }

  return ThorinFormletStore;

};