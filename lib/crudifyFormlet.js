'use strict';
/**
 * Formlet CRUDIFICATION
 */

module.exports = (thorin, opt) => {

  const logger = thorin.logger(opt.logger),
    actions = {},
    dispatcher = thorin.dispatcher;

  /*
   * Handles the CREATEion of a sql model.
   * Action id will be:
   *   {modelName}.create
   * FILTERS:
   *  - create.before(intentObj) -> right before we call the save()
   *  - create.after(intentObj, entryObj)  -> right after we call save() and before we send the intent.
   *  - create.send(intentObj)
   * */
  actions.create = function Create(namespaceObj, opt) {
    let actionId = (typeof opt.action === 'undefined' ? namespaceObj.name + opt.name + '.create' : opt.action);
    let actionObj = new thorin.Action(actionId),
      formlets = namespaceObj.formlets;
    /* We attach our actions only after all other uses were binded */
    actionObj.input({
      formlet: dispatcher.validate('ENUM', Object.keys(formlets)).error('DATA.INVALID', 'The specified formlet does not exist or is invalid.')
    });
    process.nextTick(() => {
      actionObj.use((intentObj, next) => {
        let fullData = intentObj.rawInput,
          payload = intentObj.input(),
          formletObj = formlets[payload.formlet];
        if (!formletObj) {
          logger.warn(`Crudify for ${namespaceObj.name} does not have formlet ${payload.formlet}`);
          return next(thorin.error('DATA.INVALID', 'Missing or invalid formlet name.'));
        }
        if (typeof formletObj.fields === 'object' && formletObj.fields) {
          let fields = Object.keys(formletObj.fields);
          for (let i = 0; i < fields.length; i++) {
            let fieldName = fields[i];
            if (typeof payload[fieldName] !== 'undefined') continue;
            if (typeof fullData[fieldName] === 'undefined') continue;
            payload[fieldName] = fullData[fieldName];
          }
        }
        if (!payload.created_by) {
          let createdBy = intentObj.data('createdBy');
          if (createdBy) {
            payload.created_by = createdBy;
          }
        }
        if (!payload.created_by) {
          return next(thorin.error('DATA.INVALID', 'Missing created by information'));
        }
        setMeta(intentObj, payload);
        try {
          actionObj._runFilters('create.before', intentObj, payload);
        } catch (e) {
          intentObj.error(thorin.error(e));
          return actionObj._runSend('create.error', intentObj, next);
        }
        namespaceObj.create(payload).then((res) => {
          let entry = (typeof res.result === 'object' && res.result ? res.result : res);
          filterEntry(formletObj, entry);
          try {
            actionObj._runFilters('create.after', intentObj, entry);
          } catch (e) {
            intentObj.error(thorin.error(e));
            actionObj._runSend('create.error', intentObj, next);
            return null;
          }
          intentObj.result(entry);
          actionObj._runSend('create.send', intentObj, next);
          return null;
        }, (e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('create.error', intentObj, next);
          return null;
        }).catch((e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('create.error', intentObj, next);
          return null;
        });
        return null;
      });
    });

    return actionObj;
  };

  /*
   * Handles the "FindByID" via reads
   * Action id will be:
   *   {modelName}.read
   * FILTERS:
   *  - read.before(intentObj, whereQuery)
   *  - read.after(intentObj, entryObj)
   *  - read.send(intentObj)
   * */
  actions.read = function (namespaceObj, opt) {
    let actionId = (typeof opt.action === 'undefined' ? namespaceObj.name + opt.name + '.read' : opt.action);
    let actionObj = new thorin.Action(actionId),
      formlets = namespaceObj.formlets;
    /* We attach our actions only after all other uses were binded */
    actionObj.input({
      formlet: dispatcher.validate('ARRAY', {type: 'string'}).default([])
    });

    process.nextTick(() => {
      actionObj.input({
        id: dispatcher.validate('STRING').error('DATA.INVALID', 'Missing entry id information')
      });
      actionObj.use((intentObj, next) => {
        let payload = intentObj.input(),
          filter = intentObj.filter();
        try {
          actionObj._runFilters('read.before', intentObj, payload, filter);
        } catch (e) {
          intentObj.error(thorin.error(e));
          return actionObj._runSend('read.error', intentObj, next);
        }
        namespaceObj.read(payload, filter).then((res) => {
          let entry = (typeof res.result === 'object' && res.result ? res.result : res),
            formletObj = formlets[entry.formlet];
          if (formletObj) {
            filterEntry(formletObj, entry);
          }
          try {
            actionObj._runFilters('read.after', intentObj, entry);
          } catch (e) {
            intentObj.error(thorin.error(e));
            actionObj._runSend('read.error', intentObj, next);
            return null;
          }
          intentObj.result(entry);
          actionObj._runSend('read.send', intentObj, next);
          return null;
        }, (e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('read.error', intentObj, next);
          return null;
        }).catch((e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('read.error', intentObj, next);
          return null;
        });
        return null;
      });
    });

    return actionObj;
  };

  /*
   * Handles the UPDATE operation
   * Action will be:
   *   {modelName}.update
   *   OPTIONS
   *    - opt.fields[] - an array of fields to get from the rawInput. Defaults to all
   *    - opt.ignore[] - an array of fields to ignore from the rawInput. Defaults to none.
   * FILTERS
   *   - update.before(intentObj, payload)
   *   - update.after(intentObj, entryObj)
   *   - update.send(intentObj)
   * */
  actions.update = function (namespaceObj, opt) {
    let actionId = (typeof opt.action === 'undefined' ? namespaceObj.name + opt.name + '.update' : opt.action);
    let actionObj = new thorin.Action(actionId),
      formlets = namespaceObj.formlets,
      rawFields = false;
    if (opt.fields instanceof Array) {
      rawFields = {
        updated_by: true
      };
      for (let i = 0; i < opt.fields.length; i++) {
        rawFields[opt.fields[i]] = true;
      }
    }
    /* We attach our actions only after all other uses were binded */
    actionObj.input({
      formlet: dispatcher.validate('STRING').default(null)
    });

    process.nextTick(() => {
      actionObj.input({
        id: dispatcher.validate('STRING').error('DATA.INVALID', 'Missing entry id information')
      });

      actionObj.use((intentObj, next) => {
        let fullData = intentObj.rawInput,
          payload = intentObj.input(),
          filter = intentObj.filter(),
          formletObj = formlets[payload.formlet];
        if (!payload.created_by) {
          let createdBy = intentObj.data('createdBy');
          if (createdBy) {
            payload.created_by = createdBy;
          }
        }
        // IF we have a formlet, we check the fields to send.
        if (formletObj && typeof formletObj.fields === 'object' && formletObj.fields) {
          let fields = Object.keys(formletObj.fields);
          for (let i = 0; i < fields.length; i++) {
            let fieldName = fields[i];
            if (typeof payload[fieldName] !== 'undefined') continue;
            if (typeof fullData[fieldName] === 'undefined') continue;
            if (rawFields && !rawFields[fieldName]) continue;
            payload[fieldName] = fullData[fieldName];
          }
        } else {
          Object.keys(fullData).forEach((fieldName) => {
            if (typeof payload[fieldName] !== 'undefined') return;
            if (rawFields && !rawFields[fieldName]) return;
            payload[fieldName] = fullData[fieldName];
          });
          delete payload.formlet;
        }
        if (opt.ignore instanceof Array) {
          for (let i = 0; i < opt.ignore.length; i++) {
            let fieldName = opt.ignore[i];
            if (typeof payload[fieldName] !== 'undefined') {
              delete payload[fieldName];
            }
          }
        }
        setMeta(intentObj, payload);
        try {
          actionObj._runFilters('update.before', intentObj, payload, filter);
        } catch (e) {
          intentObj.error(thorin.error(e));
          return actionObj._runSend('update.error', intentObj, next);
        }

        namespaceObj.update(payload, filter).then((res) => {
          let entry = (typeof res.result === 'object' && res.result ? res.result : res),
            formletObj = formlets[entry.formlet];
          if (formletObj) {
            filterEntry(formletObj, entry);
          }
          try {
            actionObj._runFilters('update.after', intentObj, entry);
          } catch (e) {
            intentObj.error(thorin.error(e));
            actionObj._runSend('update.error', intentObj, next);
            return null;
          }
          intentObj.result(entry);
          actionObj._runSend('update.send', intentObj, next);
          return null;
        }, (e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('update.error', intentObj, next);
          return null;
        }).catch((e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('update.error', intentObj, next);
          return null;
        });
        return null;
      });
    });

    return actionObj;
  };


  /*
   * Handles the DELETE operation
   * Action will be:
   *   {modelName}.delete
   * FILTERS
   *   - delete.before(intentObj, payload)
   *   - delete.after(intentObj)
   * */
  actions.delete = function (namespaceObj, opt) {
    let actionId = (typeof opt.action === 'undefined' ? namespaceObj.name + opt.name + '.delete' : opt.action);
    let actionObj = new thorin.Action(actionId),
      formlets = namespaceObj.formlets;
    /* We attach our actions only after all other uses were binded */
    actionObj.input({
      formlet: dispatcher.validate('STRING').default(null)
    });

    process.nextTick(() => {
      actionObj.input({
        id: dispatcher.validate('STRING').error('DATA.INVALID', 'Missing entry id information')
      });

      actionObj.use((intentObj, next) => {
        let payload = intentObj.input(),
          filter = intentObj.filter();
        if (!payload.created_by) {
          let createdBy = intentObj.data('createdBy');
          if (createdBy) {
            payload.created_by = createdBy;
          }
        }
        setMeta(intentObj, payload);
        try {
          actionObj._runFilters('delete.before', intentObj, payload, filter);
        } catch (e) {
          intentObj.error(thorin.error(e));
          return actionObj._runSend('delete.error', intentObj, next);
        }
        namespaceObj.delete(payload, filter).then((res) => {
          let entry = (typeof res.result === 'object' && res.result ? res.result : res),
            formletObj = formlets[entry.formlet];
          if (formletObj) {
            filterEntry(formletObj, entry);
          }
          try {
            actionObj._runFilters('delete.after', intentObj, entry);
          } catch (e) {
            intentObj.error(thorin.error(e));
            actionObj._runSend('delete.error', intentObj, next);
            return null;
          }
          intentObj.result({
            deleted: true
          });
          actionObj._runSend('delete.send', intentObj, next);
          return null;
        }, (e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('delete.error', intentObj, next);
          return null;
        }).catch((e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('delete.error', intentObj, next);
          return null;
        });
      });
    });
    return actionObj;
  };

  /*
   * Handles the FIND operation (with pagination, sorting, etc)
   * Action will be:
   *   {modelName}.find
   * FILTERS
   *   - find.before(intentObj, payload)
   *   - find.after(intentObj, results[])
   * */
  actions.find = function (namespaceObj, opt) {
    let actionId = (typeof opt.action === 'undefined' ? namespaceObj.name + opt.name + '.find' : opt.action);
    let actionObj = new thorin.Action(actionId),
      formlets = namespaceObj.formlets;
    /* We attach our actions only after all other uses were binded */
    actionObj.input({
      formlet: dispatcher.validate('ARRAY', {type: 'string'}).default([])
    });

    process.nextTick(() => {
      /* add pagination input */
      actionObj.input({
        page: dispatcher.validate('NUMBER', {min: 1}).default(1),
        limit: dispatcher.validate('NUMBER', {min: 1}).default(10),
        start_date: dispatcher.validate('DATE').default(null),
        end_date: dispatcher.validate('DATE').default(null),
        date_field: dispatcher.validate('STRING').default(null),
        order: dispatcher.validate('ENUM', ['ASC', 'DESC']).default('DESC'),
        order_by: dispatcher.validate('ARRAY', {type: 'string'}).default(['created_at'])
      });

      actionObj.use((intentObj, next) => {
        let fullData = intentObj.rawInput,
          filter = intentObj.filter(),
          payload = intentObj.input(),
          formletObj = formlets[payload.formlet];
        if (!payload.created_by) {
          let createdBy = intentObj.data('createdBy');
          if (createdBy) {
            payload.created_by = createdBy;
          }
        }
        // IF we have a formlet, we check the fields to send.
        if (formletObj && typeof formletObj.fields === 'object' && formletObj.fields) {
          let fields = Object.keys(formletObj.fields);
          for (let i = 0; i < fields.length; i++) {
            let fieldName = fields[i];
            if (typeof payload[fieldName] !== 'undefined') continue;
            if (typeof fullData[fieldName] === 'undefined') continue;
            payload[fieldName] = fullData[fieldName];
          }
        } else {
          Object.keys(fullData).forEach((keyName) => {
            if (typeof payload[keyName] !== 'undefined') return;
            payload[keyName] = fullData[keyName];
          });
          delete payload.formlet;
        }
        if (payload.start_date == null) delete payload.start_date;
        if (payload.end_date == null) delete payload.end_date;
        if (payload.date_field == null) delete payload.date_field;
        try {
          actionObj._runFilters('find.before', intentObj, payload, filter);
        } catch (e) {
          intentObj.error(thorin.error(e));
          return actionObj._runSend('find.error', intentObj, next);
        }
        console.log("FIND", payload, filter);
        namespaceObj.find(payload, filter).then((res) => {
          intentObj.setMeta(res.meta || {});
          if (res.result instanceof Array) {
            for (let i = 0, len = res.result.length; i < len; i++) {
              let entry = res.result[i],
                formletObj = formlets[entry.formlet];
              if (formletObj) {
                filterEntry(formletObj, entry);
              }
            }
          }
          try {
            actionObj._runFilters('find.after', intentObj, res.result);
          } catch (e) {
            intentObj.error(thorin.error(e));
            actionObj._runSend('find.error', intentObj, next);
            return null;
          }
          intentObj.result(res.result);
          actionObj._runSend('find.send', intentObj, next);
          next();
        }, (e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('find.error', intentObj, next);
          return null;
        }).catch((e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('find.error', intentObj, next);
          return null;
        });
      });
    });

    return actionObj;
  };

  /*
   * Strips away hidden fields of a given formlet.
   * */
  function filterEntry(formletObj, entryObj) {
    // TODO
  }

  /*
   * Sets the metadata of the intent to the payload.
   * */
  function setMeta(intentObj, payload) {
    if (typeof payload.meta === 'object') return;
    let meta = intentObj.data('meta');
    if (typeof meta !== 'object' || !meta) meta = {};
    let client = intentObj.client(),
      headers = client['headers'] || {};
    if (!meta.ip) meta.ip = client.ip;
    if (!meta.user_agent && headers['user-agent']) {
      meta.user_agent = headers['user-agent'];
    }
    payload.meta = meta;
  }

  /*
   * Handles an error
   * */
  function parseError(e) {
    let err = thorin.error(e.code, e.message, e.fields, e.statusCode);
    err.ns = 'STORE';
    return err;
  }

  return actions;

};