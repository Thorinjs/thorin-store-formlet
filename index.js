'use strict';
const storeInit = require('./lib/formletStore');
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
  const ThorinFormletStore = storeInit(thorin, opt || {});
  return ThorinFormletStore;
};
module.exports.publicName = 'formlet';