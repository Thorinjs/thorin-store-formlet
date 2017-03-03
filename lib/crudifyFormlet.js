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
   *  - create.after(intentObj, entityObj)  -> right after we call save() and before we send the intent.
   *  - create.send(intentObj)
   * */
  actions.create = function Create(formletObj, opt) {
    let actionId = opt.action || (formletObj.name.replace(/_/g, '.') + '.create');
    let actionObj = new thorin.Action(actionId);
    process.nextTick(() => {
      actionObj.use((intentObj, next) => {
        let fullData = intentObj.rawInput,
          payload = {},
          filter = intentObj.filter(),
          meta = getMeta(intentObj);
        if (opt.fields instanceof Array) {
          for (let i = 0; i < opt.fields.length; i++) {
            let fieldName = opt.fields[i];
            if (typeof payload[fieldName] !== 'undefined') continue;
            if (typeof fullData[fieldName] === 'undefined') continue;
            payload[fieldName] = fullData[fieldName];
          }
        } else {
          payload = fullData || {};
        }
        if (!payload.created_by) {
          let createdBy = intentObj.data('createdBy');
          if (createdBy) {
            payload.created_by = createdBy;
          }
        }
        if (opt.ignore instanceof Array) {
          for (let i = 0; i < opt.ignore.length; i++) {
            let fieldName = opt.ignore[i];
            if (typeof payload[fieldName] !== 'undefined') {
              delete payload[fieldName];
            }
          }
        }
        if (!payload.created_by) {
          return next(thorin.error('DATA.INVALID', 'Missing created by information'));
        }
        if (typeof payload.formlet !== 'string') payload.formlet = formletObj.name;
        try {
          actionObj._runFilters('create.before', intentObj, {
            payload,
            filter,
            meta
          });
        } catch (e) {
          intentObj.error(thorin.error(e));
          return actionObj._runSend('create.error', intentObj, next);
        }
        formletObj.create(payload, filter, meta).then((res) => {
          let entity = (typeof res.result === 'object' && res.result ? res.result : res);
          filterEntry(formletObj, entity);
          try {
            actionObj._runFilters('create.after', intentObj, entity);
          } catch (e) {
            intentObj.error(thorin.error(e));
            actionObj._runSend('create.error', intentObj, next);
            return null;
          }
          intentObj.result(entity);
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
   *  - read.after(intentObj, entityObj)
   *  - read.send(intentObj)
   * */
  actions.read = function (formletObj, opt) {
    let actionId = opt.action || (formletObj.name.replace(/_/g, '.') + '.create');
    let actionObj = new thorin.Action(actionId);
    /* We attach our actions only after all other uses were binded */
    process.nextTick(() => {
      actionObj.use((intentObj, next) => {
        let filter = intentObj.filter(),
          payload = intentObj.input();
        try {
          actionObj._runFilters('read.before', intentObj, filter);
        } catch (e) {
          intentObj.error(thorin.error(e));
          actionObj._runSend('read.error', intentObj, next);
          return null;
        }
        if (typeof payload.formlet !== 'string') payload.formlet = formletObj.name;
        formletObj.read(payload, filter).then((res) => {
          let entity = (typeof res.result === 'object' && res.result ? res.result : res);
          filterEntry(formletObj, entity);
          try {
            actionObj._runFilters('read.after', intentObj, entity);
          } catch (e) {
            intentObj.error(thorin.error(e));
            actionObj._runSend('read.error', intentObj, next);
            return null;
          }
          intentObj.result(entity);
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
   *   - update.after(intentObj, entityObj)
   *   - update.send(intentObj)
   * */
  actions.update = function (formletObj, opt) {
    let actionId = opt.action || (formletObj.name.replace(/_/g, '.') + '.create');
    let actionObj = new thorin.Action(actionId);
    let rawFields = false;
    if (opt.fields instanceof Array) {
      rawFields = {
        updated_by: true
      };
      for (let i = 0; i < opt.fields.length; i++) {
        rawFields[opt.fields[i]] = true;
      }
    }
    process.nextTick(() => {

      actionObj.use((intentObj, next) => {
        let filter = intentObj.filter(),
          meta = getMeta(intentObj),
          payload = (opt.raw === false ? intentObj.input() : intentObj.rawInput);
        if (!payload.created_by) {
          let createdBy = intentObj.data('createdBy');
          if (createdBy) {
            payload.created_by = createdBy;
          }
        }

        let inputFields = Object.keys(payload);
        if (rawFields !== false) {
          for (let i = 0, len = inputFields.length; i < len; i++) {
            let keyName = inputFields[i];
            if (!rawFields[keyName]) {
              delete payload[keyName];
            }
          }
        }


        if (opt.ignore instanceof Array) {
          for (let i = 0; i < opt.ignore.length; i++) {
            let fieldName = opt.ignore[i];
            if (typeof payload[fieldName] !== 'undefined') {
              delete payload[fieldName];
            }
          }
        }
        if (typeof payload.formlet !== 'string') payload.formlet = formletObj.name;
        try {
          actionObj._runFilters('update.before', intentObj, {
            payload,
            filter,
            meta
          });
        } catch (e) {
          intentObj.error(thorin.error(e));
          actionObj._runSend('update.error', intentObj, next);
          return null;
        }
        formletObj.update(payload, filter, meta).then((res) => {
          let entity = (typeof res.result === 'object' && res.result ? res.result : res);
          filterEntry(formletObj, entity);
          try {
            actionObj._runFilters('update.after', intentObj, entity);
          } catch (e) {
            intentObj.error(thorin.error(e));
            actionObj._runSend('update.error', intentObj, next);
            return null;
          }
          intentObj.result(entity);
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
  actions.delete = function (formletObj, opt) {
    let actionId = opt.action || (formletObj.name.replace(/_/g, '.') + '.create');
    let actionObj = new thorin.Action(actionId);

    process.nextTick(() => {
      actionObj.use((intentObj, next) => {
        let filter = intentObj.filter(),
          meta = getMeta(intentObj),
          payload = intentObj.input();

        if (!payload.created_by) {
          let createdBy = intentObj.data('createdBy');
          if (createdBy) {
            payload.created_by = createdBy;
          }
        }
        if (typeof payload.formlet !== 'string') payload.formlet = formletObj.name;
        try {
          actionObj._runFilters('delete.before', intentObj, {
            payload,
            filter,
            meta
          });
        } catch (e) {
          intentObj.error(thorin.error(e));
          actionObj._runSend('delete.error', intentObj, next);
          return null;
        }
        formletObj.delete(payload, filter, meta).then((res) => {
          let entity = (typeof res.result === 'object' && res.result ? res.result : res);
          filterEntry(formletObj, entity);
          try {
            actionObj._runFilters('delete.after', intentObj, entity);
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
  actions.find = function (formletObj, opt) {
    let actionId = opt.action || (formletObj.name.replace(/_/g, '.') + '.create');
    let actionObj = new thorin.Action(actionId);

    process.nextTick(() => {
      actionObj.use((intentObj, next) => {
        let payload = intentObj.input(),
          filter = intentObj.filter();
        if (!filter.created_by) {
          let createdBy = intentObj.data('createdBy');
          if (createdBy) filter.created_by = createdBy;
        }
        if (typeof payload.formlet !== 'string') payload.formlet = formletObj.name;
        try {
          actionObj._runFilters('find.before', intentObj, {
            payload,
            filter
          });
        } catch (e) {
          intentObj.error(thorin.error(e));
          actionObj._runSend('find.error', intentObj, next);
          return null;
        }
        formletObj.find(payload, filter).then((res) => {
          intentObj.setMeta(res.meta || {});
          if (res.result instanceof Array) {
            for (let i = 0, len = res.result.length; i < len; i++) {
              let entity = res.result[i];
              filterEntry(formletObj, entity);
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
          return null;
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
   * Handles the COUNT operation
   * Action will be:
   *   {modelName}.count
   * FILTERS
   *   - count.before(intentObj, payload)
   *   - count.after(intentObj, result{})
   * */
  actions.count = function (formletObj, opt) {
    let actionId = opt.action || (formletObj.name.replace(/_/g, '.') + '.count');
    let actionObj = new thorin.Action(actionId);

    process.nextTick(() => {
      actionObj.use((intentObj, next) => {
        let payload = intentObj.input(),
          filter = intentObj.filter();
        if (typeof payload.formlet !== 'string') payload.formlet = formletObj.name;
        try {
          actionObj._runFilters('count.before', intentObj, {
            payload,
            filter
          });
        } catch (e) {
          intentObj.error(thorin.error(e));
          actionObj._runSend('count.error', intentObj, next);
          return null;
        }
        formletObj.count(payload, filter).then((res) => {
          intentObj.setMeta(res.meta || {});
          try {
            actionObj._runFilters('count.after', intentObj, res.result);
          } catch (e) {
            intentObj.error(thorin.error(e));
            actionObj._runSend('count.error', intentObj, next);
            return null;
          }
          intentObj.result(res.result);
          actionObj._runSend('count.send', intentObj, next);
          return null;
        }, (e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('count.error', intentObj, next);
          return null;
        }).catch((e) => {
          intentObj.error(parseError(e));
          actionObj._runSend('count.error', intentObj, next);
          return null;
        });
      });
    });

    return actionObj;
  };

  /*
   * Strips away hidden fields of a given formlet.
   * */
  function filterEntry(formletObj, entityObj) {
    // TODO
  }

  /*
   * Sets the metadata of the intent to the payload.
   * */
  function getMeta(intentObj) {
    let meta = {};
    let client = intentObj.client(),
      headers = client['headers'] || {};
    if (!meta.ip) meta.ip = client.ip;
    if (!meta.user_agent && headers['user-agent']) {
      meta.user_agent = headers['user-agent'];
    }
    return meta;
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