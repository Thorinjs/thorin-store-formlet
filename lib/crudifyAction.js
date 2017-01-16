'use strict';
/**
 * The formlet action that handles crudification
 */

module.exports = (thorin, opt) => {

  const Action = thorin.Action;

  class ThorinAction extends Action {

    constructor(actionName) {
      super(actionName);
      this.filters = [];
    }

    /*
     * When we want to crudify a model with READ and FIND, the default
     * WHERE select query will be select *
     * Whenever we want to limit or attach additional filters to a restified filter,
     * we just insert a filter callback, that will be called with filter(intentObj, whereQuery)
     * Note:
     *  if crudifyType is not specified, we will apply the filter for both  READ and FIND.
     *  If it is, it should be either FIND or READ
     * */
    filter(crudifyType, fn) {
      if (typeof crudifyType === 'object' && crudifyType) {
        try {
          if (typeof super.filter === 'function') {
            super.filter(crudifyType);
          }
          return this;
        } catch (e) {
        }
      }
      if (typeof crudifyType === 'function') {
        fn = crudifyType;
        crudifyType = undefined;
      } else if (typeof crudifyType === 'string') {
        crudifyType = crudifyType.toLowerCase();
      }
      if (typeof fn === 'function') {
        this.filters.push({
          type: crudifyType,
          fn: fn
        });
      }
      return this;
    }

    /* Private function that calls all the registered filter callbacks with the
     * intent and the pending query. */
    _runFilters(crudifyType, intentObj, qry) {
      for (let i = 0; i < this.filters.length; i++) {
        let item = this.filters[i];
        if (typeof item.type === 'string' && item.type !== crudifyType) continue;
        item.fn(intentObj, qry);
      }
    }


    /*
     * This will run the "action.send" filter. Note that when overriding
     * the {name}.send filter, we will not call the intent.send() function.
     * */
    _runSend(crudifyType, intentObj, next) {
      for (let i = 0; i < this.filters.length; i++) {
        let item = this.filters[i];
        if (item.type === crudifyType) {
          try {
            return item.fn(intentObj);
          } catch (e) {
            intentObj.error(e);
            return next(e);
          }
        }
      }
      next();
    }
  }
  thorin.Action = ThorinAction;
  return ThorinAction;
};
