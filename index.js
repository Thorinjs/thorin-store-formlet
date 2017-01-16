'use strict';
const storeInit = require('./lib/formletStore'),
  actionInit = require('./lib/formletAction'),
  crudifyInit = require('./lib/crudifyAction');
/**
 *
 *
 */
module.exports = function init(thorin, opt) {
  const async = thorin.util.async;
  // Attach the SQL error parser to thorin.
  opt = thorin.util.extend({
    logger: 'formlet'
  }, opt);
  crudifyInit(thorin, opt);
  actionInit(thorin, opt);
  const ThorinFormletStore = storeInit(thorin, opt || {});
  return ThorinFormletStore;
};
module.exports.publicName = 'formlet';