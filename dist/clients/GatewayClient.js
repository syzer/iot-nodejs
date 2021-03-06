(function (global, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'module', 'format', 'axios', 'bluebird', 'btoa', '../util/util.js', './BaseClient.js'], factory);
  } else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
    factory(exports, module, require('format'), require('axios'), require('bluebird'), require('btoa'), require('../util/util.js'), require('./BaseClient.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, mod, global.format, global.xhr, global.Promise, global.nodeBtoa, global.util, global.BaseClient);
    global.GatewayClient = mod.exports;
  }
})(this, function (exports, module, _format, _axios, _bluebird, _btoa, _utilUtilJs, _BaseClientJs) {
  /**
   *****************************************************************************
   Copyright (c) 2014, 2015 IBM Corporation and other Contributors.
   All rights reserved. This program and the accompanying materials
   are made available under the terms of the Eclipse Public License v1.0
   which accompanies this distribution, and is available at
   http://www.eclipse.org/legal/epl-v10.html
   Contributors:
   Tim-Daniel Jacobi - Initial Contribution
   Jeffrey Dare
   *****************************************************************************
   *
   */
  'use strict';

  var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

  var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

  var _format2 = _interopRequireDefault(_format);

  var _xhr = _interopRequireDefault(_axios);

  var _Promise = _interopRequireDefault(_bluebird);

  var _nodeBtoa = _interopRequireDefault(_btoa);

  var _BaseClient2 = _interopRequireDefault(_BaseClientJs);

  var btoa = btoa || _nodeBtoa['default']; // if browser btoa is available use it otherwise use node module

  var CMD_RE = /^iot-2\/type\/(.+)\/id\/(.+)\/cmd\/(.+)\/fmt\/(.+)$/;
  var QUICKSTART_ORG_ID = "quickstart";

  var GatewayClient = (function (_BaseClient) {
    _inherits(GatewayClient, _BaseClient);

    function GatewayClient(config) {
      _classCallCheck(this, GatewayClient);

      _get(Object.getPrototypeOf(GatewayClient.prototype), 'constructor', this).call(this, config);

      if (!(0, _utilUtilJs.isDefined)(config.type)) {
        throw new Error('config must contain type');
      } else if (!(0, _utilUtilJs.isString)(config.type)) {
        throw new Error('type must be a string');
      }

      if (config.org === QUICKSTART_ORG_ID) {
        throw new Error('Quickstart not supported in Gateways');
      }

      if (!(0, _utilUtilJs.isDefined)(config['auth-method'])) {
        throw new Error('config must contain auth-method');
      } else if (!(0, _utilUtilJs.isString)(config['auth-method'])) {
        throw new Error('auth-method must be a string');
      } else if (config['auth-method'] !== 'token') {
        throw new Error('unsupported authentication method' + config['auth-method']);
      }

      this.mqttConfig.username = 'use-token-auth';

      this.org = config.org;
      this.type = config.type;
      this.id = config.id;
      this.deviceToken = config['auth-token'];
      this.mqttConfig.clientId = "g:" + config.org + ":" + config.type + ":" + config.id;

      this.subscriptions = [];

      this.log.info("GatewayClient initialized for organization : " + config.org + " for ID : " + config.id);
    }

    _createClass(GatewayClient, [{
      key: 'connect',
      value: function connect() {
        var _this = this;

        _get(Object.getPrototypeOf(GatewayClient.prototype), 'connect', this).call(this);

        var mqtt = this.mqtt;

        this.mqtt.on('connect', function () {
          _this.isConnected = true;
          _this.log.info("GatewayClient Connected");

          if (_this.retryCount === 0) {
            _this.emit('connect');
          } else {
            _this.emit('reconnect');
          }

          //reset the counter to 0 incase of reconnection
          _this.retryCount = 0;

          try {
            for (var i = 0, l = _this.subscriptions.length; i < l; i++) {
              mqtt.subscribe(_this.subscriptions[i], { qos: 0 });
            }
          } catch (err) {
            _this.log.error("Error while trying to subscribe : " + err);
          }

          //subscribe to all the commands for this gateway by default
          /*let gatewayWildCardTopic = format("iot-2/type/%s/id/%s/cmd/+/fmt/+", this.type, this.id);
          mqtt.subscribe(gatewayWildCardTopic, { qos: 2 }, function(){});*/
        });

        this.mqtt.on('message', function (topic, payload) {
          _this.log.debug("Message received on topic : " + topic + " with payload : " + payload);

          var match = CMD_RE.exec(topic);

          if (match) {
            _this.emit('command', match[1], match[2], match[3], match[4], payload, topic);
          }
        });
      }
    }, {
      key: 'publishGatewayEvent',
      value: function publishGatewayEvent(eventType, eventFormat, payload, qos) {
        return this.publishEvent(this.type, this.id, eventType, eventFormat, payload, qos);
      }
    }, {
      key: 'publishDeviceEvent',
      value: function publishDeviceEvent(deviceType, deviceId, eventType, eventFormat, payload, qos) {
        return this.publishEvent(deviceType, deviceId, eventType, eventFormat, payload, qos);
      }
    }, {
      key: 'publishEvent',
      value: function publishEvent(type, id, eventType, eventFormat, payload, qos) {
        if (!this.isConnected) {
          this.log.error("Client is not connected");
          //throw new Error("Client is not connected");
          //instead of throwing error, will emit 'error' event.
          this.emit('error', "Client is not connected");
        }

        if (!(0, _utilUtilJs.isDefined)(payload)) {
          this.log.error("Payload is undefined");
          payload = "";
        }

        var topic = (0, _format2['default'])("iot-2/type/%s/id/%s/evt/%s/fmt/%s", type, id, eventType, eventFormat);
        var QOS = qos || 0;

        this.log.debug("Publishing to topic : " + topic + " with payload : " + payload + " with QoS : " + QOS);

        this.mqtt.publish(topic, payload, { qos: QOS });

        return this;
      }
    }, {
      key: 'publishHTTPS',
      value: function publishHTTPS(eventType, eventFormat, payload) {
        var _this2 = this;

        this.log.debug("Publishing event of Type: " + eventType + " with payload : " + payload);
        return new _Promise['default'](function (resolve, reject) {
          var uri = undefined;
          if (_this2.staging) {
            uri = (0, _format2['default'])("https://%s.staging.internetofthings.ibmcloud.com/api/v0002/device/types/%s/devices/%s/events/%s", _this2.org, _this2.type, _this2.id, eventType);
          } else {
            uri = (0, _format2['default'])("https://%s.%s/api/v0002/device/types/%s/devices/%s/events/%s", _this2.org, _this2.domainName, _this2.type, _this2.id, eventType);
          }
          var xhrConfig = {
            url: uri,
            method: 'POST',
            data: payload,
            headers: {}
          };

          if (eventFormat === 'json') {
            xhrConfig.headers['Content-Type'] = 'application/json';
          }

          if (_this2.org !== QUICKSTART_ORG_ID) {
            xhrConfig.headers['Authorization'] = 'Basic ' + btoa('use-token-auth' + ':' + _this2.deviceToken);
          }
          _this2.log.debug(xhrConfig);

          (0, _xhr['default'])(xhrConfig).then(resolve, reject);
        });
      }
    }, {
      key: 'subscribeToDeviceCommand',
      value: function subscribeToDeviceCommand(type, id, command, format) {
        type = type || '+';
        id = id || '+';
        command = command || '+';
        format = format || '+';

        var topic = "iot-2/type/" + type + "/id/" + id + "/cmd/" + command + "/fmt/" + format;

        this.subscribe(topic);
        return this;
      }
    }, {
      key: 'unsubscribeToDeviceCommand',
      value: function unsubscribeToDeviceCommand(type, id, command, format) {
        type = type || '+';
        id = id || '+';
        command = command || '+';
        format = format || '+';

        var topic = "iot-2/type/" + type + "/id/" + id + "/cmd/" + command + "/fmt/" + format;

        this.unsubscribe(topic);

        return this;
      }
    }, {
      key: 'subscribeToGatewayCommand',
      value: function subscribeToGatewayCommand(command, format) {
        command = command || '+';
        format = format || '+';

        var topic = "iot-2/type/" + this.type + "/id/" + this.id + "/cmd/" + command + "/fmt/" + format;

        this.subscribe(topic);
        return this;
      }
    }, {
      key: 'unsubscribeToGatewayCommand',
      value: function unsubscribeToGatewayCommand(command, format) {
        command = command || '+';
        format = format || '+';

        var topic = "iot-2/type/" + this.type + "/id/" + this.id + "/cmd/" + command + "/fmt/" + format;

        this.unsubscribe(topic);

        return this;
      }
    }, {
      key: 'subscribe',
      value: function subscribe(topic) {
        if (!this.isConnected) {
          this.log.error("Client is not connected");
          //throw new Error("Client is not connected");
          //instead of throwing error, will emit 'error' event.
          this.emit('error', "Client is not connected. So cannot subscribe to topic :" + topic);
        }

        this.log.debug("Subscribe: " + topic);
        this.subscriptions.push(topic);

        if (this.isConnected) {
          this.mqtt.subscribe(topic, { qos: 0 });
          this.log.debug("Subscribed to: " + topic);
        } else {
          this.log.error("Unable to subscribe as application is not currently connected");
        }
      }
    }, {
      key: 'unsubscribe',
      value: function unsubscribe(topic) {
        if (!this.isConnected) {
          this.log.error("Client is not connected");
          //throw new Error("Client is not connected");
          //instead of throwing error, will emit 'error' event.
          this.emit('error', "Client is not connected");
        }

        this.log.debug("Unsubscribe: " + topic);
        var i = this.subscriptions.indexOf(topic);
        if (i != -1) {
          this.subscriptions.splice(i, 1);
        }

        this.mqtt.unsubscribe(topic);
        this.log.debug("Unsubscribed to: " + topic);
      }
    }]);

    return GatewayClient;
  })(_BaseClient2['default']);

  module.exports = GatewayClient;
});