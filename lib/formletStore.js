'use strict';
const formlet = require('formlet'),
  path = require('path'),
  decamelize = require('decamelize'),
  initFormlet = require('./formletModel'),
  initCrudify = require('./crudifyFormlet');

const NAME_SEPARATOR = "_",
  TYPES = require('./dataType');

/**
 * Created by Adrian on 06-Jan-17.
 */
module.exports = (thorin, opt) => {
  const config = Symbol(),
    instance = Symbol(),
    models = Symbol(),
    _loaded = Symbol(),
    async = thorin.util.async,
    logger = thorin.logger(opt.logger);

  const Model = initFormlet(thorin, opt),
    crudify = initCrudify(thorin, opt);


  class ThorinFormletStore extends thorin.Interface.Store {
    static publicName() {
      return "formlet";
    }

    constructor() {
      super();
      this.type = "formlet";
      this.loaded = false;
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
        domain: null, // the domain to use for all formlet namespaces
        dropCreate: false,  // set to true to perform drop-create. WARNING: removes ALL data.
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
        return fObj.dispatch('auth.check', {}).catch((e) => {
          if (e.code === 'GLOBAL.ERROR') return Promise.reject(thorin.error('FORMLET.UNAVAILABLE', 'The formlet server is unavailable.'));
        });
      });

      /* NEXT, we attach the iObj to our formlets */
      calls.push(() => {
        Object.keys(this[models]).forEach((key) => {
          initModel(this[models][key], fObj, this[config]);
        });
        this.loaded = true;
      });

      thorin.series(calls, done);
    }

    getInstance() {
      return this[instance];
    }

    getModels() {
      let res = [],
        keys = Object.keys(this[models]);
      keys.forEach((n) => {
        res.push(this[models][n]);
      });
      return res;
    }

    /*
     * Initiate the setup and synchronization process for the given data.
     * WAYS OF CALLING:
     * node launch.js --setup=formlet --formlet={name} --namespace={name} --type={relation|model}
     * ARGUMENTS:
     *  - formlet - if specified, setup only the given formlet(s), delimited by comma
     *  - namespace - if specified, setup only the given namespace(s), delimited by comma.
     *  - type - if specified, setup only models/relations of all formlets. This is useful when you have multiple microservices
     *          that share relations
     * */
    setup(done) {
      let iObj = this.getInstance(),
        calls = [],
        models = this.getModels(),
        customFormlet = thorin.argv('formlet'),
        customNamespace = thorin.argv('namespace'),
        saveType = 'ALL';
      if (thorin.argv('type') === 'relation') {
        saveType = 'RELATION';
      } else if (thorin.argv('type') === 'model') {
        saveType = 'MODEL';
      }
      if (customFormlet != null) {
        if (!(customFormlet instanceof Array)) {
          customFormlet = [customFormlet];
        }
      }
      if (customNamespace != null) {
        if (!(customNamespace instanceof Array)) {
          customNamespace = [customNamespace];
        }
      }
      /* Step zero, build up the namespaces we've created and sync them up */
      function canSetup(modelObj) {
        if (customFormlet == null && customNamespace == null) return true;
        if (customFormlet) {
          for (let i = 0; i < customFormlet.length; i++) {
            let tmp = decamelize(customFormlet[i], NAME_SEPARATOR);
            if (tmp === modelObj.name) return true;
          }
        }
        if (customNamespace) {
          for (let i = 0; i < customNamespace.length; i++) {
            let tmp = decamelize(customNamespace[i], NAME_SEPARATOR);
            if (tmp === modelObj.getNamespace(true)) return true;
          }
        }
        return false;
      }

      calls.push(() => {
        let ns = {},
          saves = [];
        models.forEach((modelObj) => {
          if (!canSetup(modelObj)) return;
          let nsOpt = modelObj.getNamespace();
          if (ns[nsOpt.code]) return;
          ns[nsOpt.code] = true;
          saves.push(() => {
            return this.query('namespace.save', nsOpt);
          });
        });
        return thorin.series(saves);
      });

      /* Next, save all formlets */
      calls.push(() => {
        let saves = [];
        models.forEach((modelObj) => {
          if (!canSetup(modelObj)) return;
          if (saveType !== 'ALL' && saveType !== 'MODEL') return;
          saves.push(() => {
            let data = modelObj.getSyncData();
            return this.query('formlet.save', data).catch((e) => {
              logger.error(`Formlet ${modelObj.name} could not be synced.`);
              throw e;
            });
          });
        });
        return thorin.series(saves);
      });

      /* Next, for each formlet, save its fields. */
      calls.push(() => {
        let saves = [];
        models.forEach((modelObj) => {
          if (!canSetup(modelObj)) return;
          let namespace = modelObj.getNamespace(true);
          if (saveType === 'ALL' || saveType === 'MODEL') {
            /* For each field, save it */
            modelObj.getFields().forEach((field) => {
              field.namespace = namespace;
              field.formlet = modelObj.name;
              saves.push(() => {
                return this.query('formlet.field.save', field).catch((e) => {
                  logger.error(`Formlet ${modelObj.name} field: ${field.code} could not be saved`);
                  throw e;
                });
              });
            });

            /* Then, for each added search, save it. */
            modelObj.getSearches().forEach((search) => {
              search.namespace = namespace;
              search.formlet = modelObj.name;
              saves.push(() => {
                return this.query('formlet.search.save', search).catch((e) => {
                  logger.error(`Formlet ${modelObj.name} search: ${search.code} could not be saved`);
                  throw e;
                });
              });
            });
          }

          if (saveType === 'ALL' || saveType === 'RELATION') {
            /* For each relation, save it */
            modelObj.getRelations().forEach((rel) => {
              rel.namespace = namespace;
              rel.formlet = modelObj.name;
              saves.push(() => {
                return this.query('formlet.relation.save', rel).catch((e) => {
                  logger.error(`Formlet ${modelObj.name} relation: ${rel.relation} ${rel.target} could not be saved`);
                  throw e;
                });
              });
            });
            /* For each unique index, we sync */
            modelObj.getUniques().forEach((fields) => {
              let d = {
                namespace: namespace,
                formlet: modelObj.name,
                fields: fields
              };
              saves.push(() => {
                return this.query('formlet.field.unique', d).catch((e) => {
                  logger.warn(`Formlet ${modelObj.name} uniques: ${fields.join(', ')} could not be saved`);
                  throw e;
                });
              });
            })
          }
        });
        return thorin.series(saves);
      });

      thorin.series(calls, (e) => {
        if (e) {
          logger.warn(`Could not finalize formlet synchronization`);
          return done(e);
        }
        done();
      });
    }

    /*
     * Returns a namespaced model.
     * */
    model(formlet) {
      let iObj = this.getInstance();
      if (!iObj) return null;
      formlet = decamelize(formlet, NAME_SEPARATOR);
      if (this[models][formlet]) return this[models][formlet];
      // IF we are started, we dynamically build the model
      if (!this.loaded) return null;
      let mObj = new Model(formlet);
      initModel(mObj, this.getInstance(), this[config]);
      mObj.dynamic = true;
      this[models][formlet] = mObj;
      return this[models][formlet];
    }

    /*
     * Manually execute a dispatch to formlet.io
     * */
    query(type, payload, filter, meta) {
      let fObj = this.getInstance();
      if (!fObj) return Promise.reject(thorin.error('FORMLET.NOT_READY', 'Formlet is not ready yet'));
      if (this[config].debug) {
        let full = '';
        if (thorin.env === 'development') {
          full = ': ' + JSON.stringify(payload);
        }
        logger.trace(`DISPATCH ${type} ${full}`);
      }
      return fObj.dispatch(type, payload, filter, meta);
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
      const formletObj = this.model(modelName);
      if (typeof opt !== 'object' || !opt) opt = {};
      if (!opt.name) {
        opt.name = modelName.code;
      }
      if (['create', 'read', 'update', 'delete', 'find', 'count'].indexOf(action) === -1) {
        console.error(`Crudify action for model ${modelName} is not valid.`);
        return;
      }
      const actionObj = crudify[action](formletObj, opt);
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
    let formlets = thorin.util.readDirectory(formletPath, {
      relative: true,
      levels: 2,
      ext: '.js'
    });
    if (formlets.length === 0) {
      return;
    }
    formlets.sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < formlets.length; i++) {
      let filePath = formlets[i];
      let fileName = filePath.replace(/\\/g, '/');
      fileName = fileName.split('/').pop();
      let itemName = decamelize(fileName.replace(/\.js/g, ''), NAME_SEPARATOR),
        itemData;
      try {
        itemData = require(`${formletPath}/${filePath}`);
      } catch (e) {
        logger.error(`Could not require model ${fileName} data`);
        logger.error(e);
        continue;
      }
      if (typeof itemData !== 'function') {
        continue;
      }
      let modelObj = new Model(itemName);
      itemData(modelObj, TYPES);
      modelObj.name = decamelize(modelObj.name, NAME_SEPARATOR);
      if (!modelObj.isValid()) {
        logger.trace(`Skipping ${modelObj.name} - no valid definition found.`);
        continue;
      }
      this[models][modelObj.name] = modelObj;
    }
  }

  /*
   * Initialize all our formlet models
   * */
  function initModel(modelObj, api, config) {
    modelObj.__init(api, config);
  }


  return ThorinFormletStore;

};