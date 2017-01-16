'use strict';
/**
 * The formlet action that extends the thorin action
 * and allows for proxying()
 */
const decamelize = require('decamelize');
module.exports = (thorin, opt) => {

  const logger = thorin.logger(opt.logger),
    Action = thorin.Action;

  const HANDLER_TYPE = 'formlet';
  Action.HANDLER_TYPE.PROXY_FORMLET = 'proxy.formlet';

  class ThorinAction extends Action {


    /**
     * This will be available for all actions, it will proxy the request to the formlet api
     * to proxy the incoming intent to the formlet server
     * NOTE:
     *  the name MUST contain "formlet#" to identify that we're going to
     *  proxy the request via formlet.
     *  The pattern is: "cluster#{actionName}"
     * Ex:
     *
     *  thorin.dispatcher.addAction('myAction')
     *      .use((intentObj, next) => {
     *        intentObj.input('someValue', 1);    // override the intent's input.
     *        next();
     *      })
     *      .before('proxy', (intentObj, serviceData) => {
     *        console.log('Will proxy action to ${serviceData.ip});
     *      })
     *      .proxy('formlet#entry.find', {
     *        namespace: 'someNamespace' // or intentObj.data('namespace'),
     *        formlet: 'someFormlet'  // or intentObj.data('formlet')
     *      })
     *      .after('proxy', (intentObj, response) => {
     *        console.log(`Proxy successful. Response:`, response);
     *      })
     *      .use((intentObj) => {
     *        console.log("formlet responded with: ", intentObj.result());
     *        // here is where we can mutate the result of the intent to send back to the client.
     *        intentObj.send();
     *      });
     *      OPTIONS:
     *        - store=string(default: formlet) -> the formlet store to use.
     *        - namespace=string -> the target namespace
     *        - payload=object -> the base payload that will override the intent input.
     *        - rawInput=false -> should we use intentObj.input() or intentObj.rawInput
     *        - exclude: [],  -> array of keys to exclude from input
     * */
    proxy(proxyServiceName, opt) {
      if (typeof proxyServiceName !== 'string' || !proxyServiceName) {
        logger.error(`proxy() of action ${this.name} must have a valid string for the proxy service name`);
        return this;
      }
      let tmp = proxyServiceName.split('#'),
        proxyName = tmp[0],
        serviceName = tmp[1];
      if (proxyName !== 'formlet') {
        if (typeof super.proxy === 'function') {
          return super.proxy.apply(this, arguments);
        }
        logger.warn(`proxy() must contain the following pattern: formlet#{actionName} [current: ${proxyServiceName}]`);
        return this;
      }
      let options = Object.assign({}, {
        actionName: serviceName,
        store: 'formlet',
        rawInput: true,
        exclude: [],
        payload: {}
      }, opt || {});
      this.stack.push({
        name: proxyServiceName,
        type: Action.HANDLER_TYPE.PROXY_FORMLET,
        opt: options
      });
      return this;
    }

    /*
     * Runs our custom proxy middleware function.
     * */
    _runCustomType(intentObj, handler, done) {
      if (handler.type !== Action.HANDLER_TYPE.PROXY_FORMLET) {
        return super._runCustomType.apply(this, arguments);
      }
      let opt = handler.opt,
        actionName = opt.actionName,
        namespace = opt.namespace,
        formlet = opt.formlet,
        intentInput = {};
      if (!namespace) {
        namespace = intentObj.data('namespace');
      }
      if (!formlet) formlet = intentObj.data('formlet');
      if (opt.rawInput === true || typeof opt.fields === 'object' && opt.fields) {
        intentInput = intentObj.rawInput;
      } else {
        intentInput = intentObj.input();
        if (intentInput.namespace) namespace = intentInput.namespace;
      }
      let payload = opt.payload ? JSON.parse(JSON.stringify(opt.payload)) : {};
      if (typeof opt.fields === 'object' && opt.fields) {
        Object.keys(opt.fields).forEach((keyName) => {
          if (typeof intentInput[keyName] === 'undefined') return;
          let newKeyName = opt.fields[keyName];
          if (newKeyName === true) {
            payload[keyName] = intentInput[keyName];
          } else if (typeof newKeyName === 'string') {
            payload[newKeyName] = intentInput[keyName];
          }
        });
      } else {
        payload = Object.assign({}, intentInput, opt.payload);
      }

      if (opt.exclude instanceof Array) {
        for (let i = 0; i < opt.exclude.length; i++) {
          let keyName = opt.exclude[i];
          if (typeof payload[keyName] !== 'undefined') delete payload[keyName];
        }
      }
      if (namespace) {
        namespace = decamelize(namespace, '_');
        payload.namespace = namespace;
      }
      if (formlet) {
        payload.formlet = formlet;
      }
      this._runHandler(
        'before',
        HANDLER_TYPE,
        intentObj,
        actionName,
        namespace,
        payload
      );

      let storeObj = thorin.store(opt.store);
      storeObj.query(actionName, payload).then((res) => {
        if (typeof res.meta !== 'undefined') {
          intentObj.setMeta(res.meta);
        }
        if (typeof res.result !== 'undefined') {
          intentObj.result(res.result);
        }
      }).catch((e) => {
        intentObj.error(thorin.error(e));
      }).finally(() => {
        this._runHandler(
          'after',
          HANDLER_TYPE,
          intentObj,
          actionName,
          namespace,
          payload
        );
        done();
      });
    }
  }

  thorin.Action = ThorinAction;
  return thorin.Action;
};
