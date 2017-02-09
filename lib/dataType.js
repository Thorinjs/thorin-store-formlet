'use strict';
/**
 * Formlet data types
 */
function map(type, validations) {
  let obj = {
    type: type
  };
  if (typeof validations === 'object' && validations) {
    obj.validations = validations;
  }
  return obj;
}
module.exports = {
  ARRAY: function ARRAY(validations) {
    return map('ARRAY', validations);
  },
  BOOL: function BOOL() {
    return map('BOOL');
  },
  BOOLEAN: function BOOL() {
    return map('BOOL');
  },
  COLOR_RGBA: function COLOR_RGBA(val) {
    return map('COLOR_RGBA', val);
  },
  COLOR_HEX: function COLOR_HEX(val) {
    return map('COLOR_HEX', val);
  },
  FILE: function FILE(val) {
    return map('FILE', val);
  },
  DATE: function DATE(val) {
    return map('DATE', val);
  },
  DOMAIN: function DOMAIN(val) {
    return map('DOMAIN', val);
  },
  EMAIL: function EMAIL(val) {
    return map('EMAIL', val);
  },
  PHONE: function PHONE(val) {
    return map('PHONE', val);
  },
  PHONE_PREFIX: function PHONE_PREFIX(val) {
    return map('PHONE_PREFIX', val);
  },
  REGION: function REGION(val) {
    return map('REGION', val);
  },
  ENUM: function ENUM(values) {
    let o = {
      type: 'MULTI',
      values: []
    };
    if (typeof values === 'string') values = values.split(',');
    if (!(values instanceof Array)) {
      values = Array.prototype.slice.call(arguments);
    }
    if (values instanceof Array) {
      for (let i = 0; i < values.length; i++) {
        let val = values[i],
          item = {};
        if (typeof val === 'object' && val) {
          item = val;
        } else if (typeof val === 'string') {
          item.code = val;
          item.name = val;
        } else if (typeof val === 'number') {
          item.code = val;
          item.name = val.toString();
        }
        if (!item.code || !item.name) continue;
        o.values.push(item);
      }
    }
    return o;
  },
  GENDER: function GENDER() {
    return map('GENDER');
  },
  YEAR: function YEAR(val) {
    return map('YEAR', val);
  },
  MONTH: function MONTH(val) {
    return map('MONTH', val);
  },
  WEEK_DAY: function WEEK_DAY(val) {
    return map('WEEK_DAY', val);
  },
  COUNTRY: function COUNTRY(val) {
    return map('COUNTRY', val);
  },
  FLOAT: function FLOAT(val) {
    return map('FLOAT', val);
  },
  IP: function IP(val) {
    return map('IP', val);
  },
  IP_PRIVATE: function IP_PRIVATE(val) {
    return map('IP_PRIVATE', val);
  },
  IP_PUBLIC: function IP_PUBLIC(val) {
    return map('IP_PUBLIC', val);
  },
  IP_RANGE: function IP_RANGE(val) {
    return map('IP_RANGE', val);
  },
  NUMBER: function NUMBER(val) {
    return map('NUMBER', val);
  },
  STRING: function STRING(val) {
    if (typeof val === 'number' && val > 0) {
      return map('STRING', {
        max: val
      });
    }

    return map('STRING', val);
  },
  HTML: function HTML(val) {
    return map('HTML', val);
  },
  URL: function URL(val) {
    return map('URL', val);
  }
};