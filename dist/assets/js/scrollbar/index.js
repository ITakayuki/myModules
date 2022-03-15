(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (process){(function (){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var sheet = require('@emotion/sheet');
var stylis = require('stylis');
require('@emotion/weak-memoize');
require('@emotion/memoize');

var last = function last(arr) {
  return arr.length ? arr[arr.length - 1] : null;
}; // based on https://github.com/thysultan/stylis.js/blob/e6843c373ebcbbfade25ebcc23f540ed8508da0a/src/Tokenizer.js#L239-L244


var identifierWithPointTracking = function identifierWithPointTracking(begin, points, index) {
  var previous = 0;
  var character = 0;

  while (true) {
    previous = character;
    character = stylis.peek(); // &\f

    if (previous === 38 && character === 12) {
      points[index] = 1;
    }

    if (stylis.token(character)) {
      break;
    }

    stylis.next();
  }

  return stylis.slice(begin, stylis.position);
};

var toRules = function toRules(parsed, points) {
  // pretend we've started with a comma
  var index = -1;
  var character = 44;

  do {
    switch (stylis.token(character)) {
      case 0:
        // &\f
        if (character === 38 && stylis.peek() === 12) {
          // this is not 100% correct, we don't account for literal sequences here - like for example quoted strings
          // stylis inserts \f after & to know when & where it should replace this sequence with the context selector
          // and when it should just concatenate the outer and inner selectors
          // it's very unlikely for this sequence to actually appear in a different context, so we just leverage this fact here
          points[index] = 1;
        }

        parsed[index] += identifierWithPointTracking(stylis.position - 1, points, index);
        break;

      case 2:
        parsed[index] += stylis.delimit(character);
        break;

      case 4:
        // comma
        if (character === 44) {
          // colon
          parsed[++index] = stylis.peek() === 58 ? '&\f' : '';
          points[index] = parsed[index].length;
          break;
        }

      // fallthrough

      default:
        parsed[index] += stylis.from(character);
    }
  } while (character = stylis.next());

  return parsed;
};

var getRules = function getRules(value, points) {
  return stylis.dealloc(toRules(stylis.alloc(value), points));
}; // WeakSet would be more appropriate, but only WeakMap is supported in IE11


var fixedElements = /* #__PURE__ */new WeakMap();
var compat = function compat(element) {
  if (element.type !== 'rule' || !element.parent || // positive .length indicates that this rule contains pseudo
  // negative .length indicates that this rule has been already prefixed
  element.length < 1) {
    return;
  }

  var value = element.value,
      parent = element.parent;
  var isImplicitRule = element.column === parent.column && element.line === parent.line;

  while (parent.type !== 'rule') {
    parent = parent.parent;
    if (!parent) return;
  } // short-circuit for the simplest case


  if (element.props.length === 1 && value.charCodeAt(0) !== 58
  /* colon */
  && !fixedElements.get(parent)) {
    return;
  } // if this is an implicitly inserted rule (the one eagerly inserted at the each new nested level)
  // then the props has already been manipulated beforehand as they that array is shared between it and its "rule parent"


  if (isImplicitRule) {
    return;
  }

  fixedElements.set(element, true);
  var points = [];
  var rules = getRules(value, points);
  var parentRules = parent.props;

  for (var i = 0, k = 0; i < rules.length; i++) {
    for (var j = 0; j < parentRules.length; j++, k++) {
      element.props[k] = points[i] ? rules[i].replace(/&\f/g, parentRules[j]) : parentRules[j] + " " + rules[i];
    }
  }
};
var removeLabel = function removeLabel(element) {
  if (element.type === 'decl') {
    var value = element.value;

    if ( // charcode for l
    value.charCodeAt(0) === 108 && // charcode for b
    value.charCodeAt(2) === 98) {
      // this ignores label
      element["return"] = '';
      element.value = '';
    }
  }
};
var ignoreFlag = 'emotion-disable-server-rendering-unsafe-selector-warning-please-do-not-use-this-the-warning-exists-for-a-reason';

var isIgnoringComment = function isIgnoringComment(element) {
  return !!element && element.type === 'comm' && element.children.indexOf(ignoreFlag) > -1;
};

var createUnsafeSelectorsAlarm = function createUnsafeSelectorsAlarm(cache) {
  return function (element, index, children) {
    if (element.type !== 'rule') return;
    var unsafePseudoClasses = element.value.match(/(:first|:nth|:nth-last)-child/g);

    if (unsafePseudoClasses && cache.compat !== true) {
      var prevElement = index > 0 ? children[index - 1] : null;

      if (prevElement && isIgnoringComment(last(prevElement.children))) {
        return;
      }

      unsafePseudoClasses.forEach(function (unsafePseudoClass) {
        console.error("The pseudo class \"" + unsafePseudoClass + "\" is potentially unsafe when doing server-side rendering. Try changing it to \"" + unsafePseudoClass.split('-child')[0] + "-of-type\".");
      });
    }
  };
};

var isImportRule = function isImportRule(element) {
  return element.type.charCodeAt(1) === 105 && element.type.charCodeAt(0) === 64;
};

var isPrependedWithRegularRules = function isPrependedWithRegularRules(index, children) {
  for (var i = index - 1; i >= 0; i--) {
    if (!isImportRule(children[i])) {
      return true;
    }
  }

  return false;
}; // use this to remove incorrect elements from further processing
// so they don't get handed to the `sheet` (or anything else)
// as that could potentially lead to additional logs which in turn could be overhelming to the user


var nullifyElement = function nullifyElement(element) {
  element.type = '';
  element.value = '';
  element["return"] = '';
  element.children = '';
  element.props = '';
};

var incorrectImportAlarm = function incorrectImportAlarm(element, index, children) {
  if (!isImportRule(element)) {
    return;
  }

  if (element.parent) {
    console.error("`@import` rules can't be nested inside other rules. Please move it to the top level and put it before regular rules. Keep in mind that they can only be used within global styles.");
    nullifyElement(element);
  } else if (isPrependedWithRegularRules(index, children)) {
    console.error("`@import` rules can't be after other rules. Please put your `@import` rules before your other rules.");
    nullifyElement(element);
  }
};

var defaultStylisPlugins = [stylis.prefixer];

var createCache = function createCache(options) {
  var key = options.key;

  if (process.env.NODE_ENV !== 'production' && !key) {
    throw new Error("You have to configure `key` for your cache. Please make sure it's unique (and not equal to 'css') as it's used for linking styles to your cache.\n" + "If multiple caches share the same key they might \"fight\" for each other's style elements.");
  }

  if ( key === 'css') {
    var ssrStyles = document.querySelectorAll("style[data-emotion]:not([data-s])"); // get SSRed styles out of the way of React's hydration
    // document.head is a safe place to move them to(though note document.head is not necessarily the last place they will be)
    // note this very very intentionally targets all style elements regardless of the key to ensure
    // that creating a cache works inside of render of a React component

    Array.prototype.forEach.call(ssrStyles, function (node) {
      // we want to only move elements which have a space in the data-emotion attribute value
      // because that indicates that it is an Emotion 11 server-side rendered style elements
      // while we will already ignore Emotion 11 client-side inserted styles because of the :not([data-s]) part in the selector
      // Emotion 10 client-side inserted styles did not have data-s (but importantly did not have a space in their data-emotion attributes)
      // so checking for the space ensures that loading Emotion 11 after Emotion 10 has inserted some styles
      // will not result in the Emotion 10 styles being destroyed
      var dataEmotionAttribute = node.getAttribute('data-emotion');

      if (dataEmotionAttribute.indexOf(' ') === -1) {
        return;
      }
      document.head.appendChild(node);
      node.setAttribute('data-s', '');
    });
  }

  var stylisPlugins = options.stylisPlugins || defaultStylisPlugins;

  if (process.env.NODE_ENV !== 'production') {
    // $FlowFixMe
    if (/[^a-z-]/.test(key)) {
      throw new Error("Emotion key must only contain lower case alphabetical characters and - but \"" + key + "\" was passed");
    }
  }

  var inserted = {}; // $FlowFixMe

  var container;
  var nodesToHydrate = [];

  {
    container = options.container || document.head;
    Array.prototype.forEach.call( // this means we will ignore elements which don't have a space in them which
    // means that the style elements we're looking at are only Emotion 11 server-rendered style elements
    document.querySelectorAll("style[data-emotion^=\"" + key + " \"]"), function (node) {
      var attrib = node.getAttribute("data-emotion").split(' '); // $FlowFixMe

      for (var i = 1; i < attrib.length; i++) {
        inserted[attrib[i]] = true;
      }

      nodesToHydrate.push(node);
    });
  }

  var _insert;

  var omnipresentPlugins = [compat, removeLabel];

  if (process.env.NODE_ENV !== 'production') {
    omnipresentPlugins.push(createUnsafeSelectorsAlarm({
      get compat() {
        return cache.compat;
      }

    }), incorrectImportAlarm);
  }

  {
    var currentSheet;
    var finalizingPlugins = [stylis.stringify, process.env.NODE_ENV !== 'production' ? function (element) {
      if (!element.root) {
        if (element["return"]) {
          currentSheet.insert(element["return"]);
        } else if (element.value && element.type !== stylis.COMMENT) {
          // insert empty rule in non-production environments
          // so @emotion/jest can grab `key` from the (JS)DOM for caches without any rules inserted yet
          currentSheet.insert(element.value + "{}");
        }
      }
    } : stylis.rulesheet(function (rule) {
      currentSheet.insert(rule);
    })];
    var serializer = stylis.middleware(omnipresentPlugins.concat(stylisPlugins, finalizingPlugins));

    var stylis$1 = function stylis$1(styles) {
      return stylis.serialize(stylis.compile(styles), serializer);
    };

    _insert = function insert(selector, serialized, sheet, shouldCache) {
      currentSheet = sheet;

      if (process.env.NODE_ENV !== 'production' && serialized.map !== undefined) {
        currentSheet = {
          insert: function insert(rule) {
            sheet.insert(rule + serialized.map);
          }
        };
      }

      stylis$1(selector ? selector + "{" + serialized.styles + "}" : serialized.styles);

      if (shouldCache) {
        cache.inserted[serialized.name] = true;
      }
    };
  }

  var cache = {
    key: key,
    sheet: new sheet.StyleSheet({
      key: key,
      container: container,
      nonce: options.nonce,
      speedy: options.speedy,
      prepend: options.prepend,
      insertionPoint: options.insertionPoint
    }),
    nonce: options.nonce,
    inserted: inserted,
    registered: {},
    insert: _insert
  };
  cache.sheet.hydrate(nodesToHydrate);
  return cache;
};

exports.default = createCache;

}).call(this)}).call(this,require('_process'))

},{"@emotion/memoize":8,"@emotion/sheet":10,"@emotion/weak-memoize":13,"_process":17,"stylis":18}],2:[function(require,module,exports){
(function (process){(function (){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var createCache = require('@emotion/cache');
var serialize = require('@emotion/serialize');
var utils = require('@emotion/utils');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var createCache__default = /*#__PURE__*/_interopDefault(createCache);

function insertWithoutScoping(cache, serialized) {
  if (cache.inserted[serialized.name] === undefined) {
    return cache.insert('', serialized, cache.sheet, true);
  }
}

function merge(registered, css, className) {
  var registeredStyles = [];
  var rawClassName = utils.getRegisteredStyles(registered, registeredStyles, className);

  if (registeredStyles.length < 2) {
    return className;
  }

  return rawClassName + css(registeredStyles);
}

var createEmotion = function createEmotion(options) {
  var cache = createCache__default['default'](options); // $FlowFixMe

  cache.sheet.speedy = function (value) {
    if (process.env.NODE_ENV !== 'production' && this.ctr !== 0) {
      throw new Error('speedy must be changed before any rules are inserted');
    }

    this.isSpeedy = value;
  };

  cache.compat = true;

  var css = function css() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var serialized = serialize.serializeStyles(args, cache.registered, undefined);
    utils.insertStyles(cache, serialized, false);
    return cache.key + "-" + serialized.name;
  };

  var keyframes = function keyframes() {
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    var serialized = serialize.serializeStyles(args, cache.registered);
    var animation = "animation-" + serialized.name;
    insertWithoutScoping(cache, {
      name: serialized.name,
      styles: "@keyframes " + animation + "{" + serialized.styles + "}"
    });
    return animation;
  };

  var injectGlobal = function injectGlobal() {
    for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    var serialized = serialize.serializeStyles(args, cache.registered);
    insertWithoutScoping(cache, serialized);
  };

  var cx = function cx() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    return merge(cache.registered, css, classnames(args));
  };

  return {
    css: css,
    cx: cx,
    injectGlobal: injectGlobal,
    keyframes: keyframes,
    hydrate: function hydrate(ids) {
      ids.forEach(function (key) {
        cache.inserted[key] = true;
      });
    },
    flush: function flush() {
      cache.registered = {};
      cache.inserted = {};
      cache.sheet.flush();
    },
    // $FlowFixMe
    sheet: cache.sheet,
    cache: cache,
    getRegisteredStyles: utils.getRegisteredStyles.bind(null, cache.registered),
    merge: merge.bind(null, cache.registered, css)
  };
};

var classnames = function classnames(args) {
  var cls = '';

  for (var i = 0; i < args.length; i++) {
    var arg = args[i];
    if (arg == null) continue;
    var toAdd = void 0;

    switch (typeof arg) {
      case 'boolean':
        break;

      case 'object':
        {
          if (Array.isArray(arg)) {
            toAdd = classnames(arg);
          } else {
            toAdd = '';

            for (var k in arg) {
              if (arg[k] && k) {
                toAdd && (toAdd += ' ');
                toAdd += k;
              }
            }
          }

          break;
        }

      default:
        {
          toAdd = arg;
        }
    }

    if (toAdd) {
      cls && (cls += ' ');
      cls += toAdd;
    }
  }

  return cls;
};

exports.default = createEmotion;

}).call(this)}).call(this,require('_process'))

},{"@emotion/cache":1,"@emotion/serialize":9,"@emotion/utils":12,"_process":17}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: !0
});

var createCache = require("@emotion/cache"), serialize = require("@emotion/serialize"), utils = require("@emotion/utils");

function _interopDefault(e) {
  return e && e.__esModule ? e : {
    default: e
  };
}

var createCache__default = _interopDefault(createCache);

function insertWithoutScoping(cache, serialized) {
  if (void 0 === cache.inserted[serialized.name]) return cache.insert("", serialized, cache.sheet, !0);
}

function merge(registered, css, className) {
  var registeredStyles = [], rawClassName = utils.getRegisteredStyles(registered, registeredStyles, className);
  return registeredStyles.length < 2 ? className : rawClassName + css(registeredStyles);
}

var createEmotion = function(options) {
  var cache = createCache__default.default(options);
  cache.sheet.speedy = function(value) {
    this.isSpeedy = value;
  }, cache.compat = !0;
  var css = function() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) args[_key] = arguments[_key];
    var serialized = serialize.serializeStyles(args, cache.registered, void 0);
    return utils.insertStyles(cache, serialized, !1), cache.key + "-" + serialized.name;
  };
  return {
    css: css,
    cx: function() {
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) args[_key4] = arguments[_key4];
      return merge(cache.registered, css, classnames(args));
    },
    injectGlobal: function() {
      for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) args[_key3] = arguments[_key3];
      var serialized = serialize.serializeStyles(args, cache.registered);
      insertWithoutScoping(cache, serialized);
    },
    keyframes: function() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) args[_key2] = arguments[_key2];
      var serialized = serialize.serializeStyles(args, cache.registered), animation = "animation-" + serialized.name;
      return insertWithoutScoping(cache, {
        name: serialized.name,
        styles: "@keyframes " + animation + "{" + serialized.styles + "}"
      }), animation;
    },
    hydrate: function(ids) {
      ids.forEach((function(key) {
        cache.inserted[key] = !0;
      }));
    },
    flush: function() {
      cache.registered = {}, cache.inserted = {}, cache.sheet.flush();
    },
    sheet: cache.sheet,
    cache: cache,
    getRegisteredStyles: utils.getRegisteredStyles.bind(null, cache.registered),
    merge: merge.bind(null, cache.registered, css)
  };
}, classnames = function classnames(args) {
  for (var cls = "", i = 0; i < args.length; i++) {
    var arg = args[i];
    if (null != arg) {
      var toAdd = void 0;
      switch (typeof arg) {
       case "boolean":
        break;

       case "object":
        if (Array.isArray(arg)) toAdd = classnames(arg); else for (var k in toAdd = "", 
        arg) arg[k] && k && (toAdd && (toAdd += " "), toAdd += k);
        break;

       default:
        toAdd = arg;
      }
      toAdd && (cls && (cls += " "), cls += toAdd);
    }
  }
  return cls;
};

exports.default = createEmotion;

},{"@emotion/cache":1,"@emotion/serialize":9,"@emotion/utils":12}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

require('@emotion/cache');
require('@emotion/serialize');
require('@emotion/utils');
var createInstance_dist_emotionCssCreateInstance = require('../create-instance/dist/emotion-css-create-instance.cjs.dev.js');

var _createEmotion = createInstance_dist_emotionCssCreateInstance['default']({
  key: 'css'
}),
    flush = _createEmotion.flush,
    hydrate = _createEmotion.hydrate,
    cx = _createEmotion.cx,
    merge = _createEmotion.merge,
    getRegisteredStyles = _createEmotion.getRegisteredStyles,
    injectGlobal = _createEmotion.injectGlobal,
    keyframes = _createEmotion.keyframes,
    css = _createEmotion.css,
    sheet = _createEmotion.sheet,
    cache = _createEmotion.cache;

exports.cache = cache;
exports.css = css;
exports.cx = cx;
exports.flush = flush;
exports.getRegisteredStyles = getRegisteredStyles;
exports.hydrate = hydrate;
exports.injectGlobal = injectGlobal;
exports.keyframes = keyframes;
exports.merge = merge;
exports.sheet = sheet;

},{"../create-instance/dist/emotion-css-create-instance.cjs.dev.js":2,"@emotion/cache":1,"@emotion/serialize":9,"@emotion/utils":12}],5:[function(require,module,exports){
(function (process){(function (){
'use strict';

if (process.env.NODE_ENV === "production") {
  module.exports = require("./emotion-css.cjs.prod.js");
} else {
  module.exports = require("./emotion-css.cjs.dev.js");
}

}).call(this)}).call(this,require('_process'))

},{"./emotion-css.cjs.dev.js":4,"./emotion-css.cjs.prod.js":6,"_process":17}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: !0
}), require("@emotion/cache"), require("@emotion/serialize"), require("@emotion/utils");

var createInstance_dist_emotionCssCreateInstance = require("../create-instance/dist/emotion-css-create-instance.cjs.prod.js"), _createEmotion = createInstance_dist_emotionCssCreateInstance.default({
  key: "css"
}), flush = _createEmotion.flush, hydrate = _createEmotion.hydrate, cx = _createEmotion.cx, merge = _createEmotion.merge, getRegisteredStyles = _createEmotion.getRegisteredStyles, injectGlobal = _createEmotion.injectGlobal, keyframes = _createEmotion.keyframes, css = _createEmotion.css, sheet = _createEmotion.sheet, cache = _createEmotion.cache;

exports.cache = cache, exports.css = css, exports.cx = cx, exports.flush = flush, 
exports.getRegisteredStyles = getRegisteredStyles, exports.hydrate = hydrate, exports.injectGlobal = injectGlobal, 
exports.keyframes = keyframes, exports.merge = merge, exports.sheet = sheet;

},{"../create-instance/dist/emotion-css-create-instance.cjs.prod.js":3,"@emotion/cache":1,"@emotion/serialize":9,"@emotion/utils":12}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/* eslint-disable */
// Inspired by https://github.com/garycourt/murmurhash-js
// Ported from https://github.com/aappleby/smhasher/blob/61a0530f28277f2e850bfc39600ce61d02b518de/src/MurmurHash2.cpp#L37-L86
function murmur2(str) {
  // 'm' and 'r' are mixing constants generated offline.
  // They're not really 'magic', they just happen to work well.
  // const m = 0x5bd1e995;
  // const r = 24;
  // Initialize the hash
  var h = 0; // Mix 4 bytes at a time into the hash

  var k,
      i = 0,
      len = str.length;

  for (; len >= 4; ++i, len -= 4) {
    k = str.charCodeAt(i) & 0xff | (str.charCodeAt(++i) & 0xff) << 8 | (str.charCodeAt(++i) & 0xff) << 16 | (str.charCodeAt(++i) & 0xff) << 24;
    k =
    /* Math.imul(k, m): */
    (k & 0xffff) * 0x5bd1e995 + ((k >>> 16) * 0xe995 << 16);
    k ^=
    /* k >>> r: */
    k >>> 24;
    h =
    /* Math.imul(k, m): */
    (k & 0xffff) * 0x5bd1e995 + ((k >>> 16) * 0xe995 << 16) ^
    /* Math.imul(h, m): */
    (h & 0xffff) * 0x5bd1e995 + ((h >>> 16) * 0xe995 << 16);
  } // Handle the last few bytes of the input array


  switch (len) {
    case 3:
      h ^= (str.charCodeAt(i + 2) & 0xff) << 16;

    case 2:
      h ^= (str.charCodeAt(i + 1) & 0xff) << 8;

    case 1:
      h ^= str.charCodeAt(i) & 0xff;
      h =
      /* Math.imul(h, m): */
      (h & 0xffff) * 0x5bd1e995 + ((h >>> 16) * 0xe995 << 16);
  } // Do a few final mixes of the hash to ensure the last few
  // bytes are well-incorporated.


  h ^= h >>> 13;
  h =
  /* Math.imul(h, m): */
  (h & 0xffff) * 0x5bd1e995 + ((h >>> 16) * 0xe995 << 16);
  return ((h ^ h >>> 15) >>> 0).toString(36);
}

exports.default = murmur2;

},{}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function memoize(fn) {
  var cache = Object.create(null);
  return function (arg) {
    if (cache[arg] === undefined) cache[arg] = fn(arg);
    return cache[arg];
  };
}

exports.default = memoize;

},{}],9:[function(require,module,exports){
(function (process){(function (){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var hashString = require('@emotion/hash');
var unitless = require('@emotion/unitless');
var memoize = require('@emotion/memoize');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var hashString__default = /*#__PURE__*/_interopDefault(hashString);
var unitless__default = /*#__PURE__*/_interopDefault(unitless);
var memoize__default = /*#__PURE__*/_interopDefault(memoize);

var ILLEGAL_ESCAPE_SEQUENCE_ERROR = "You have illegal escape sequence in your template literal, most likely inside content's property value.\nBecause you write your CSS inside a JavaScript string you actually have to do double escaping, so for example \"content: '\\00d7';\" should become \"content: '\\\\00d7';\".\nYou can read more about this here:\nhttps://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#ES2018_revision_of_illegal_escape_sequences";
var UNDEFINED_AS_OBJECT_KEY_ERROR = "You have passed in falsy value as style object's key (can happen when in example you pass unexported component as computed key).";
var hyphenateRegex = /[A-Z]|^ms/g;
var animationRegex = /_EMO_([^_]+?)_([^]*?)_EMO_/g;

var isCustomProperty = function isCustomProperty(property) {
  return property.charCodeAt(1) === 45;
};

var isProcessableValue = function isProcessableValue(value) {
  return value != null && typeof value !== 'boolean';
};

var processStyleName = /* #__PURE__ */memoize__default['default'](function (styleName) {
  return isCustomProperty(styleName) ? styleName : styleName.replace(hyphenateRegex, '-$&').toLowerCase();
});

var processStyleValue = function processStyleValue(key, value) {
  switch (key) {
    case 'animation':
    case 'animationName':
      {
        if (typeof value === 'string') {
          return value.replace(animationRegex, function (match, p1, p2) {
            cursor = {
              name: p1,
              styles: p2,
              next: cursor
            };
            return p1;
          });
        }
      }
  }

  if (unitless__default['default'][key] !== 1 && !isCustomProperty(key) && typeof value === 'number' && value !== 0) {
    return value + 'px';
  }

  return value;
};

if (process.env.NODE_ENV !== 'production') {
  var contentValuePattern = /(attr|counters?|url|(((repeating-)?(linear|radial))|conic)-gradient)\(|(no-)?(open|close)-quote/;
  var contentValues = ['normal', 'none', 'initial', 'inherit', 'unset'];
  var oldProcessStyleValue = processStyleValue;
  var msPattern = /^-ms-/;
  var hyphenPattern = /-(.)/g;
  var hyphenatedCache = {};

  processStyleValue = function processStyleValue(key, value) {
    if (key === 'content') {
      if (typeof value !== 'string' || contentValues.indexOf(value) === -1 && !contentValuePattern.test(value) && (value.charAt(0) !== value.charAt(value.length - 1) || value.charAt(0) !== '"' && value.charAt(0) !== "'")) {
        throw new Error("You seem to be using a value for 'content' without quotes, try replacing it with `content: '\"" + value + "\"'`");
      }
    }

    var processed = oldProcessStyleValue(key, value);

    if (processed !== '' && !isCustomProperty(key) && key.indexOf('-') !== -1 && hyphenatedCache[key] === undefined) {
      hyphenatedCache[key] = true;
      console.error("Using kebab-case for css properties in objects is not supported. Did you mean " + key.replace(msPattern, 'ms-').replace(hyphenPattern, function (str, _char) {
        return _char.toUpperCase();
      }) + "?");
    }

    return processed;
  };
}

function handleInterpolation(mergedProps, registered, interpolation) {
  if (interpolation == null) {
    return '';
  }

  if (interpolation.__emotion_styles !== undefined) {
    if (process.env.NODE_ENV !== 'production' && interpolation.toString() === 'NO_COMPONENT_SELECTOR') {
      throw new Error('Component selectors can only be used in conjunction with @emotion/babel-plugin.');
    }

    return interpolation;
  }

  switch (typeof interpolation) {
    case 'boolean':
      {
        return '';
      }

    case 'object':
      {
        if (interpolation.anim === 1) {
          cursor = {
            name: interpolation.name,
            styles: interpolation.styles,
            next: cursor
          };
          return interpolation.name;
        }

        if (interpolation.styles !== undefined) {
          var next = interpolation.next;

          if (next !== undefined) {
            // not the most efficient thing ever but this is a pretty rare case
            // and there will be very few iterations of this generally
            while (next !== undefined) {
              cursor = {
                name: next.name,
                styles: next.styles,
                next: cursor
              };
              next = next.next;
            }
          }

          var styles = interpolation.styles + ";";

          if (process.env.NODE_ENV !== 'production' && interpolation.map !== undefined) {
            styles += interpolation.map;
          }

          return styles;
        }

        return createStringFromObject(mergedProps, registered, interpolation);
      }

    case 'function':
      {
        if (mergedProps !== undefined) {
          var previousCursor = cursor;
          var result = interpolation(mergedProps);
          cursor = previousCursor;
          return handleInterpolation(mergedProps, registered, result);
        } else if (process.env.NODE_ENV !== 'production') {
          console.error('Functions that are interpolated in css calls will be stringified.\n' + 'If you want to have a css call based on props, create a function that returns a css call like this\n' + 'let dynamicStyle = (props) => css`color: ${props.color}`\n' + 'It can be called directly with props or interpolated in a styled call like this\n' + "let SomeComponent = styled('div')`${dynamicStyle}`");
        }

        break;
      }

    case 'string':
      if (process.env.NODE_ENV !== 'production') {
        var matched = [];
        var replaced = interpolation.replace(animationRegex, function (match, p1, p2) {
          var fakeVarName = "animation" + matched.length;
          matched.push("const " + fakeVarName + " = keyframes`" + p2.replace(/^@keyframes animation-\w+/, '') + "`");
          return "${" + fakeVarName + "}";
        });

        if (matched.length) {
          console.error('`keyframes` output got interpolated into plain string, please wrap it with `css`.\n\n' + 'Instead of doing this:\n\n' + [].concat(matched, ["`" + replaced + "`"]).join('\n') + '\n\nYou should wrap it with `css` like this:\n\n' + ("css`" + replaced + "`"));
        }
      }

      break;
  } // finalize string values (regular strings and functions interpolated into css calls)


  if (registered == null) {
    return interpolation;
  }

  var cached = registered[interpolation];
  return cached !== undefined ? cached : interpolation;
}

function createStringFromObject(mergedProps, registered, obj) {
  var string = '';

  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      string += handleInterpolation(mergedProps, registered, obj[i]) + ";";
    }
  } else {
    for (var _key in obj) {
      var value = obj[_key];

      if (typeof value !== 'object') {
        if (registered != null && registered[value] !== undefined) {
          string += _key + "{" + registered[value] + "}";
        } else if (isProcessableValue(value)) {
          string += processStyleName(_key) + ":" + processStyleValue(_key, value) + ";";
        }
      } else {
        if (_key === 'NO_COMPONENT_SELECTOR' && process.env.NODE_ENV !== 'production') {
          throw new Error('Component selectors can only be used in conjunction with @emotion/babel-plugin.');
        }

        if (Array.isArray(value) && typeof value[0] === 'string' && (registered == null || registered[value[0]] === undefined)) {
          for (var _i = 0; _i < value.length; _i++) {
            if (isProcessableValue(value[_i])) {
              string += processStyleName(_key) + ":" + processStyleValue(_key, value[_i]) + ";";
            }
          }
        } else {
          var interpolated = handleInterpolation(mergedProps, registered, value);

          switch (_key) {
            case 'animation':
            case 'animationName':
              {
                string += processStyleName(_key) + ":" + interpolated + ";";
                break;
              }

            default:
              {
                if (process.env.NODE_ENV !== 'production' && _key === 'undefined') {
                  console.error(UNDEFINED_AS_OBJECT_KEY_ERROR);
                }

                string += _key + "{" + interpolated + "}";
              }
          }
        }
      }
    }
  }

  return string;
}

var labelPattern = /label:\s*([^\s;\n{]+)\s*(;|$)/g;
var sourceMapPattern;

if (process.env.NODE_ENV !== 'production') {
  sourceMapPattern = /\/\*#\ssourceMappingURL=data:application\/json;\S+\s+\*\//g;
} // this is the cursor for keyframes
// keyframes are stored on the SerializedStyles object as a linked list


var cursor;
var serializeStyles = function serializeStyles(args, registered, mergedProps) {
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && args[0].styles !== undefined) {
    return args[0];
  }

  var stringMode = true;
  var styles = '';
  cursor = undefined;
  var strings = args[0];

  if (strings == null || strings.raw === undefined) {
    stringMode = false;
    styles += handleInterpolation(mergedProps, registered, strings);
  } else {
    if (process.env.NODE_ENV !== 'production' && strings[0] === undefined) {
      console.error(ILLEGAL_ESCAPE_SEQUENCE_ERROR);
    }

    styles += strings[0];
  } // we start at 1 since we've already handled the first arg


  for (var i = 1; i < args.length; i++) {
    styles += handleInterpolation(mergedProps, registered, args[i]);

    if (stringMode) {
      if (process.env.NODE_ENV !== 'production' && strings[i] === undefined) {
        console.error(ILLEGAL_ESCAPE_SEQUENCE_ERROR);
      }

      styles += strings[i];
    }
  }

  var sourceMap;

  if (process.env.NODE_ENV !== 'production') {
    styles = styles.replace(sourceMapPattern, function (match) {
      sourceMap = match;
      return '';
    });
  } // using a global regex with .exec is stateful so lastIndex has to be reset each time


  labelPattern.lastIndex = 0;
  var identifierName = '';
  var match; // https://esbench.com/bench/5b809c2cf2949800a0f61fb5

  while ((match = labelPattern.exec(styles)) !== null) {
    identifierName += '-' + // $FlowFixMe we know it's not null
    match[1];
  }

  var name = hashString__default['default'](styles) + identifierName;

  if (process.env.NODE_ENV !== 'production') {
    // $FlowFixMe SerializedStyles type doesn't have toString property (and we don't want to add it)
    return {
      name: name,
      styles: styles,
      map: sourceMap,
      next: cursor,
      toString: function toString() {
        return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop).";
      }
    };
  }

  return {
    name: name,
    styles: styles,
    next: cursor
  };
};

exports.serializeStyles = serializeStyles;

}).call(this)}).call(this,require('_process'))

},{"@emotion/hash":7,"@emotion/memoize":8,"@emotion/unitless":11,"_process":17}],10:[function(require,module,exports){
(function (process){(function (){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/*

Based off glamor's StyleSheet, thanks Sunil ❤️

high performance StyleSheet for css-in-js systems

- uses multiple style tags behind the scenes for millions of rules
- uses `insertRule` for appending in production for *much* faster performance

// usage

import { StyleSheet } from '@emotion/sheet'

let styleSheet = new StyleSheet({ key: '', container: document.head })

styleSheet.insert('#box { border: 1px solid red; }')
- appends a css rule into the stylesheet

styleSheet.flush()
- empties the stylesheet of all its contents

*/
// $FlowFixMe
function sheetForTag(tag) {
  if (tag.sheet) {
    // $FlowFixMe
    return tag.sheet;
  } // this weirdness brought to you by firefox

  /* istanbul ignore next */


  for (var i = 0; i < document.styleSheets.length; i++) {
    if (document.styleSheets[i].ownerNode === tag) {
      // $FlowFixMe
      return document.styleSheets[i];
    }
  }
}

function createStyleElement(options) {
  var tag = document.createElement('style');
  tag.setAttribute('data-emotion', options.key);

  if (options.nonce !== undefined) {
    tag.setAttribute('nonce', options.nonce);
  }

  tag.appendChild(document.createTextNode(''));
  tag.setAttribute('data-s', '');
  return tag;
}

var StyleSheet = /*#__PURE__*/function () {
  function StyleSheet(options) {
    var _this = this;

    this._insertTag = function (tag) {
      var before;

      if (_this.tags.length === 0) {
        if (_this.insertionPoint) {
          before = _this.insertionPoint.nextSibling;
        } else if (_this.prepend) {
          before = _this.container.firstChild;
        } else {
          before = _this.before;
        }
      } else {
        before = _this.tags[_this.tags.length - 1].nextSibling;
      }

      _this.container.insertBefore(tag, before);

      _this.tags.push(tag);
    };

    this.isSpeedy = options.speedy === undefined ? process.env.NODE_ENV === 'production' : options.speedy;
    this.tags = [];
    this.ctr = 0;
    this.nonce = options.nonce; // key is the value of the data-emotion attribute, it's used to identify different sheets

    this.key = options.key;
    this.container = options.container;
    this.prepend = options.prepend;
    this.insertionPoint = options.insertionPoint;
    this.before = null;
  }

  var _proto = StyleSheet.prototype;

  _proto.hydrate = function hydrate(nodes) {
    nodes.forEach(this._insertTag);
  };

  _proto.insert = function insert(rule) {
    // the max length is how many rules we have per style tag, it's 65000 in speedy mode
    // it's 1 in dev because we insert source maps that map a single rule to a location
    // and you can only have one source map per style tag
    if (this.ctr % (this.isSpeedy ? 65000 : 1) === 0) {
      this._insertTag(createStyleElement(this));
    }

    var tag = this.tags[this.tags.length - 1];

    if (process.env.NODE_ENV !== 'production') {
      var isImportRule = rule.charCodeAt(0) === 64 && rule.charCodeAt(1) === 105;

      if (isImportRule && this._alreadyInsertedOrderInsensitiveRule) {
        // this would only cause problem in speedy mode
        // but we don't want enabling speedy to affect the observable behavior
        // so we report this error at all times
        console.error("You're attempting to insert the following rule:\n" + rule + '\n\n`@import` rules must be before all other types of rules in a stylesheet but other rules have already been inserted. Please ensure that `@import` rules are before all other rules.');
      }
      this._alreadyInsertedOrderInsensitiveRule = this._alreadyInsertedOrderInsensitiveRule || !isImportRule;
    }

    if (this.isSpeedy) {
      var sheet = sheetForTag(tag);

      try {
        // this is the ultrafast version, works across browsers
        // the big drawback is that the css won't be editable in devtools
        sheet.insertRule(rule, sheet.cssRules.length);
      } catch (e) {
        if (process.env.NODE_ENV !== 'production' && !/:(-moz-placeholder|-moz-focus-inner|-moz-focusring|-ms-input-placeholder|-moz-read-write|-moz-read-only|-ms-clear){/.test(rule)) {
          console.error("There was a problem inserting the following rule: \"" + rule + "\"", e);
        }
      }
    } else {
      tag.appendChild(document.createTextNode(rule));
    }

    this.ctr++;
  };

  _proto.flush = function flush() {
    // $FlowFixMe
    this.tags.forEach(function (tag) {
      return tag.parentNode && tag.parentNode.removeChild(tag);
    });
    this.tags = [];
    this.ctr = 0;

    if (process.env.NODE_ENV !== 'production') {
      this._alreadyInsertedOrderInsensitiveRule = false;
    }
  };

  return StyleSheet;
}();

exports.StyleSheet = StyleSheet;

}).call(this)}).call(this,require('_process'))

},{"_process":17}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var unitlessKeys = {
  animationIterationCount: 1,
  borderImageOutset: 1,
  borderImageSlice: 1,
  borderImageWidth: 1,
  boxFlex: 1,
  boxFlexGroup: 1,
  boxOrdinalGroup: 1,
  columnCount: 1,
  columns: 1,
  flex: 1,
  flexGrow: 1,
  flexPositive: 1,
  flexShrink: 1,
  flexNegative: 1,
  flexOrder: 1,
  gridRow: 1,
  gridRowEnd: 1,
  gridRowSpan: 1,
  gridRowStart: 1,
  gridColumn: 1,
  gridColumnEnd: 1,
  gridColumnSpan: 1,
  gridColumnStart: 1,
  msGridRow: 1,
  msGridRowSpan: 1,
  msGridColumn: 1,
  msGridColumnSpan: 1,
  fontWeight: 1,
  lineHeight: 1,
  opacity: 1,
  order: 1,
  orphans: 1,
  tabSize: 1,
  widows: 1,
  zIndex: 1,
  zoom: 1,
  WebkitLineClamp: 1,
  // SVG-related properties
  fillOpacity: 1,
  floodOpacity: 1,
  stopOpacity: 1,
  strokeDasharray: 1,
  strokeDashoffset: 1,
  strokeMiterlimit: 1,
  strokeOpacity: 1,
  strokeWidth: 1
};

exports.default = unitlessKeys;

},{}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var isBrowser = "object" !== 'undefined';
function getRegisteredStyles(registered, registeredStyles, classNames) {
  var rawClassName = '';
  classNames.split(' ').forEach(function (className) {
    if (registered[className] !== undefined) {
      registeredStyles.push(registered[className] + ";");
    } else {
      rawClassName += className + " ";
    }
  });
  return rawClassName;
}
var registerStyles = function registerStyles(cache, serialized, isStringTag) {
  var className = cache.key + "-" + serialized.name;

  if ( // we only need to add the styles to the registered cache if the
  // class name could be used further down
  // the tree but if it's a string tag, we know it won't
  // so we don't have to add it to registered cache.
  // this improves memory usage since we can avoid storing the whole style string
  (isStringTag === false || // we need to always store it if we're in compat mode and
  // in node since emotion-server relies on whether a style is in
  // the registered cache to know whether a style is global or not
  // also, note that this check will be dead code eliminated in the browser
  isBrowser === false ) && cache.registered[className] === undefined) {
    cache.registered[className] = serialized.styles;
  }
};
var insertStyles = function insertStyles(cache, serialized, isStringTag) {
  registerStyles(cache, serialized, isStringTag);
  var className = cache.key + "-" + serialized.name;

  if (cache.inserted[serialized.name] === undefined) {
    var current = serialized;

    do {
      var maybeStyles = cache.insert(serialized === current ? "." + className : '', current, cache.sheet, true);

      current = current.next;
    } while (current !== undefined);
  }
};

exports.getRegisteredStyles = getRegisteredStyles;
exports.insertStyles = insertStyles;
exports.registerStyles = registerStyles;

},{}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var weakMemoize = function weakMemoize(func) {
  // $FlowFixMe flow doesn't include all non-primitive types as allowed for weakmaps
  var cache = new WeakMap();
  return function (arg) {
    if (cache.has(arg)) {
      // $FlowFixMe
      return cache.get(arg);
    }

    var ret = func(arg);
    cache.set(arg, ret);
    return ret;
  };
};

exports.default = weakMemoize;

},{}],14:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomScrollbar = void 0;
const util_1 = __importDefault(require("./util"));
const defaultOption = {
    contents: ".custom-scroll-contents",
    wrap: ".custom-scroll-wrap",
    bar: ".custom-scroll-bar",
    direction: "vertical"
};
class CustomScrollbar {
    constructor(target, option = {}) {
        this.watchScroll = () => {
            switch (this.option.direction) {
                case "horizontal":
                    return this.contents.scrollLeft;
                case "vertical":
                    return this.contents.scrollTop;
            }
        };
        this.createWrapper = () => {
            const contentsHTML = this.contents.innerHTML;
            this.contents.innerHTML = `<div class="custom-scrollbar-content-wrapper">${contentsHTML}</div>`;
            this.contentsInner = this.target.querySelector(".custom-scrollbar-content-wrapper");
        };
        this.moveScrollbar = () => {
            const scrollVal = this.watchScroll();
            const contentsHeight = this.contents.clientHeight;
            let scrollRange = 0;
            if (this.contentsInner) {
                scrollRange = this.contentsInner.clientHeight - contentsHeight;
            }
            const barHeight = this.bar.clientHeight;
            const range = this.wrap.clientHeight - barHeight;
            const barPosition = util_1.default.mapping(scrollVal, 0, scrollRange, 0, range);
            this.bar.style.top = `${Math.abs(barPosition)}px`;
        };
        this.needScrollBar = () => {
            var _a;
            // @ts-ignore
            if (this.contents.getBoundingClientRect().height >= ((_a = this.contentsInner) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect().height)) {
                this.wrap.classList.add("is-noScroll");
            }
        };
        this.onBarClick = () => {
            this.clickFlag = true;
            this.contents.style.userSelect = "none";
            this.bar.classList.add("is-grabbing");
        };
        this.onBarUnClick = () => {
            this.clickFlag = false;
            this.contents.style.userSelect = "";
            this.bar.classList.remove("is-grabbing");
        };
        this.followScrollBar = (e) => {
            if (this.clickFlag) {
                const mouseY = e.pageY;
                const scrollWrapPosY = this.wrap.getBoundingClientRect().top;
                const barPos = mouseY - scrollWrapPosY;
                const range = this.wrap.clientHeight - this.bar.clientHeight;
                const contentsHeight = this.contents.clientHeight;
                const scrollRange = this.contentsInner ? this.contentsInner.clientHeight - contentsHeight : 0;
                if (barPos >= 0 && barPos <= range) {
                    this.bar.style.top = `${barPos}px`;
                    const scrollPos = util_1.default.mapping(barPos, 0, range, 0, scrollRange);
                    this.contents.scrollTo(0, scrollPos);
                }
            }
        };
        this.addEvent = () => {
            this.contents.addEventListener("scroll", this.moveScrollbar);
            this.bar.addEventListener("mousedown", this.onBarClick);
            window.addEventListener("mouseup", this.onBarUnClick);
            window.addEventListener("mousemove", this.followScrollBar);
        };
        this.destroy = () => {
            this.contents.removeEventListener("scroll", this.moveScrollbar);
            this.bar.removeEventListener("click", this.onBarClick);
            window.removeEventListener("mouseup", this.onBarUnClick);
        };
        this.target = typeof target === "string" ? document.querySelector(target) : target;
        this.option = Object.assign(defaultOption, option);
        this.contents = this.target.querySelector(this.option.contents);
        this.bar = this.target.querySelector(this.option.bar);
        this.wrap = this.target.querySelector(this.option.wrap);
        this.contentsInner = null;
        this.clickFlag = false;
        this.createWrapper();
        this.addEvent();
        this.needScrollBar();
    }
}
exports.CustomScrollbar = CustomScrollbar;

},{"./util":15}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Util {
    static mapping(value, minVal, maxVal, transformMinVal, transformMaxVal) {
        const transformDiff = transformMaxVal - transformMinVal;
        const diff = maxVal - minVal;
        const percentage = value / diff;
        return transformDiff * percentage + transformMinVal;
    }
}
exports.default = Util;

},{}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComponent = exports.Component = exports.Page = void 0;
class Base {
    constructor(_tag) {
        this.setEmotion = () => {
            var _a;
            let style = null;
            if (this.style) {
                style = this.style();
            }
            if (style) {
                const selector = `[${this.tag}-css]`;
                const styleTargets = (_a = this.section) === null || _a === void 0 ? void 0 : _a.querySelectorAll(selector);
                if (styleTargets) {
                    for (const target of styleTargets) {
                        const selector = target.getAttribute(`${this.tag}-css`);
                        // @ts-ignore
                        target.classList.add(style[selector]);
                    }
                }
            }
        };
        this.startWatcher = (keys) => {
            Object.keys(keys).forEach((key) => {
                // @ts-ignore
                let lastVal = this[key];
                this.watchFuncs[key] = () => {
                    // @ts-ignore
                    if (this[key] !== lastVal) {
                        // @ts-ignore
                        lastVal = this[key];
                        keys[key]();
                    }
                    requestAnimationFrame(this.watchFuncs[key]);
                };
                this.watchFuncs[key]();
            });
        };
        this._addEvents = () => {
            const events = ["click", "scroll", "load", "mouseenter", "mouseleave", "mouseover", "change"];
            for (const event of events) {
                const eventName = `${this.tag}-${event}`;
                if (this.section !== undefined && this.section !== null) {
                    const targets = this.section.querySelectorAll("[" + eventName + "]");
                    for (const target of targets) {
                        const func = target.getAttribute(eventName);
                        const addFunc = (e) => {
                            if (func !== null) {
                                // @ts-ignore
                                this[func](e);
                            }
                        };
                        target.addEventListener(event, addFunc);
                    }
                }
            }
        };
        this.tag = _tag;
        this.refs = {};
        this.watchFuncs = {};
    }
    init(cb) {
        if (this.section) {
            this._addEvents();
            this.getReference();
            this.setWatch();
            this.setEmotion();
            if (cb) {
                cb();
            }
        }
    }
    setWatch() {
        if (this.watch !== undefined) {
            const callback = this.watch();
            this.startWatcher(callback);
        }
    }
    removeWatch() {
        Object.keys(this.watchFuncs).forEach((key) => {
            // @ts-ignore
            clearInterval(this.watchFuncs[key]);
        });
    }
    getReference() {
        const tag = `${this.tag}-ref`;
        if (this.section) {
            const refs = this.section.querySelectorAll(`[${tag}]`);
            for (const ref of refs) {
                const attribute = ref.getAttribute(tag);
                if (attribute) {
                    this.refs[attribute] = ref;
                }
            }
        }
    }
    destroy() {
        // @ts-ignore
        if (this.beforeDestroy) {
            // @ts-ignore
            this.beforeDestroy();
        }
    }
}
class Page extends Base {
    constructor(_tag, num = null) {
        super(_tag);
        this.tag = _tag;
        this.section = document.getElementById(_tag);
    }
}
exports.Page = Page;
class Component extends Base {
    constructor(props) {
        super(props.tag);
        this.section = props.component;
    }
}
exports.Component = Component;
function createComponent(_tagName, _class) {
    const targets = document.querySelectorAll(_tagName);
    const refactorTag = _tagName.replace("#", "").replace(".", "");
    const classes = [];
    if (_tagName.includes("#")) {
        for (const target of targets) {
            classes.push(new _class(refactorTag));
        }
    }
    else if (_tagName.includes(".")) {
        for (const target of targets) {
            classes.push(new _class({ component: target, tag: refactorTag }));
        }
    }
    return classes;
}
exports.createComponent = createComponent;

},{}],17:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],18:[function(require,module,exports){
(function(e,r){typeof exports==="object"&&typeof module!=="undefined"?r(exports):typeof define==="function"&&define.amd?define(["exports"],r):(e=e||self,r(e.stylis={}))})(this,(function(e){"use strict";var r="-ms-";var a="-moz-";var c="-webkit-";var t="comm";var n="rule";var s="decl";var i="@page";var u="@media";var o="@import";var f="@charset";var l="@viewport";var h="@supports";var p="@document";var v="@namespace";var b="@keyframes";var d="@font-face";var m="@counter-style";var w="@font-feature-values";var k=Math.abs;var $=String.fromCharCode;var g=Object.assign;function x(e,r){return(((r<<2^O(e,0))<<2^O(e,1))<<2^O(e,2))<<2^O(e,3)}function E(e){return e.trim()}function y(e,r){return(e=r.exec(e))?e[0]:e}function T(e,r,a){return e.replace(r,a)}function A(e,r){return e.indexOf(r)}function O(e,r){return e.charCodeAt(r)|0}function C(e,r,a){return e.slice(r,a)}function M(e){return e.length}function S(e){return e.length}function R(e,r){return r.push(e),e}function z(e,r){return e.map(r).join("")}e.line=1;e.column=1;e.length=0;e.position=0;e.character=0;e.characters="";function N(r,a,c,t,n,s,i){return{value:r,root:a,parent:c,type:t,props:n,children:s,line:e.line,column:e.column,length:i,return:""}}function P(e,r){return g(N("",null,null,"",null,null,0),e,{length:-e.length},r)}function j(){return e.character}function U(){e.character=e.position>0?O(e.characters,--e.position):0;if(e.column--,e.character===10)e.column=1,e.line--;return e.character}function _(){e.character=e.position<e.length?O(e.characters,e.position++):0;if(e.column++,e.character===10)e.column=1,e.line++;return e.character}function F(){return O(e.characters,e.position)}function I(){return e.position}function L(r,a){return C(e.characters,r,a)}function D(e){switch(e){case 0:case 9:case 10:case 13:case 32:return 5;case 33:case 43:case 44:case 47:case 62:case 64:case 126:case 59:case 123:case 125:return 4;case 58:return 3;case 34:case 39:case 40:case 91:return 2;case 41:case 93:return 1}return 0}function K(r){return e.line=e.column=1,e.length=M(e.characters=r),e.position=0,[]}function V(r){return e.characters="",r}function W(r){return E(L(e.position-1,Z(r===91?r+2:r===40?r+1:r)))}function Y(e){return V(G(K(e)))}function B(r){while(e.character=F())if(e.character<33)_();else break;return D(r)>2||D(e.character)>3?"":" "}function G(r){while(_())switch(D(e.character)){case 0:R(J(e.position-1),r);break;case 2:R(W(e.character),r);break;default:R($(e.character),r)}return r}function H(r,a){while(--a&&_())if(e.character<48||e.character>102||e.character>57&&e.character<65||e.character>70&&e.character<97)break;return L(r,I()+(a<6&&F()==32&&_()==32))}function Z(r){while(_())switch(e.character){case r:return e.position;case 34:case 39:if(r!==34&&r!==39)Z(e.character);break;case 40:if(r===41)Z(r);break;case 92:_();break}return e.position}function q(r,a){while(_())if(r+e.character===47+10)break;else if(r+e.character===42+42&&F()===47)break;return"/*"+L(a,e.position-1)+"*"+$(r===47?r:_())}function J(r){while(!D(F()))_();return L(r,e.position)}function Q(e){return V(X("",null,null,null,[""],e=K(e),0,[0],e))}function X(e,r,a,c,t,n,s,i,u){var o=0;var f=0;var l=s;var h=0;var p=0;var v=0;var b=1;var d=1;var m=1;var w=0;var k="";var g=t;var x=n;var E=c;var y=k;while(d)switch(v=w,w=_()){case 40:if(v!=108&&y.charCodeAt(l-1)==58){if(A(y+=T(W(w),"&","&\f"),"&\f")!=-1)m=-1;break}case 34:case 39:case 91:y+=W(w);break;case 9:case 10:case 13:case 32:y+=B(v);break;case 92:y+=H(I()-1,7);continue;case 47:switch(F()){case 42:case 47:R(re(q(_(),I()),r,a),u);break;default:y+="/"}break;case 123*b:i[o++]=M(y)*m;case 125*b:case 59:case 0:switch(w){case 0:case 125:d=0;case 59+f:if(p>0&&M(y)-l)R(p>32?ae(y+";",c,a,l-1):ae(T(y," ","")+";",c,a,l-2),u);break;case 59:y+=";";default:R(E=ee(y,r,a,o,f,t,i,k,g=[],x=[],l),n);if(w===123)if(f===0)X(y,r,E,E,g,n,l,i,x);else switch(h){case 100:case 109:case 115:X(e,E,E,c&&R(ee(e,E,E,0,0,t,i,k,t,g=[],l),x),t,x,l,i,c?g:x);break;default:X(y,E,E,E,[""],x,0,i,x)}}o=f=p=0,b=m=1,k=y="",l=s;break;case 58:l=1+M(y),p=v;default:if(b<1)if(w==123)--b;else if(w==125&&b++==0&&U()==125)continue;switch(y+=$(w),w*b){case 38:m=f>0?1:(y+="\f",-1);break;case 44:i[o++]=(M(y)-1)*m,m=1;break;case 64:if(F()===45)y+=W(_());h=F(),f=l=M(k=y+=J(I())),w++;break;case 45:if(v===45&&M(y)==2)b=0}}return n}function ee(e,r,a,c,t,s,i,u,o,f,l){var h=t-1;var p=t===0?s:[""];var v=S(p);for(var b=0,d=0,m=0;b<c;++b)for(var w=0,$=C(e,h+1,h=k(d=i[b])),g=e;w<v;++w)if(g=E(d>0?p[w]+" "+$:T($,/&\f/g,p[w])))o[m++]=g;return N(e,r,a,t===0?n:u,o,f,l)}function re(e,r,a){return N(e,r,a,t,$(j()),C(e,2,-2),0)}function ae(e,r,a,c){return N(e,r,a,s,C(e,0,c),C(e,c+1,-1),c)}function ce(e,t){switch(x(e,t)){case 5103:return c+"print-"+e+e;case 5737:case 4201:case 3177:case 3433:case 1641:case 4457:case 2921:case 5572:case 6356:case 5844:case 3191:case 6645:case 3005:case 6391:case 5879:case 5623:case 6135:case 4599:case 4855:case 4215:case 6389:case 5109:case 5365:case 5621:case 3829:return c+e+e;case 5349:case 4246:case 4810:case 6968:case 2756:return c+e+a+e+r+e+e;case 6828:case 4268:return c+e+r+e+e;case 6165:return c+e+r+"flex-"+e+e;case 5187:return c+e+T(e,/(\w+).+(:[^]+)/,c+"box-$1$2"+r+"flex-$1$2")+e;case 5443:return c+e+r+"flex-item-"+T(e,/flex-|-self/,"")+e;case 4675:return c+e+r+"flex-line-pack"+T(e,/align-content|flex-|-self/,"")+e;case 5548:return c+e+r+T(e,"shrink","negative")+e;case 5292:return c+e+r+T(e,"basis","preferred-size")+e;case 6060:return c+"box-"+T(e,"-grow","")+c+e+r+T(e,"grow","positive")+e;case 4554:return c+T(e,/([^-])(transform)/g,"$1"+c+"$2")+e;case 6187:return T(T(T(e,/(zoom-|grab)/,c+"$1"),/(image-set)/,c+"$1"),e,"")+e;case 5495:case 3959:return T(e,/(image-set\([^]*)/,c+"$1"+"$`$1");case 4968:return T(T(e,/(.+:)(flex-)?(.*)/,c+"box-pack:$3"+r+"flex-pack:$3"),/s.+-b[^;]+/,"justify")+c+e+e;case 4095:case 3583:case 4068:case 2532:return T(e,/(.+)-inline(.+)/,c+"$1$2")+e;case 8116:case 7059:case 5753:case 5535:case 5445:case 5701:case 4933:case 4677:case 5533:case 5789:case 5021:case 4765:if(M(e)-1-t>6)switch(O(e,t+1)){case 109:if(O(e,t+4)!==45)break;case 102:return T(e,/(.+:)(.+)-([^]+)/,"$1"+c+"$2-$3"+"$1"+a+(O(e,t+3)==108?"$3":"$2-$3"))+e;case 115:return~A(e,"stretch")?ce(T(e,"stretch","fill-available"),t)+e:e}break;case 4949:if(O(e,t+1)!==115)break;case 6444:switch(O(e,M(e)-3-(~A(e,"!important")&&10))){case 107:return T(e,":",":"+c)+e;case 101:return T(e,/(.+:)([^;!]+)(;|!.+)?/,"$1"+c+(O(e,14)===45?"inline-":"")+"box$3"+"$1"+c+"$2$3"+"$1"+r+"$2box$3")+e}break;case 5936:switch(O(e,t+11)){case 114:return c+e+r+T(e,/[svh]\w+-[tblr]{2}/,"tb")+e;case 108:return c+e+r+T(e,/[svh]\w+-[tblr]{2}/,"tb-rl")+e;case 45:return c+e+r+T(e,/[svh]\w+-[tblr]{2}/,"lr")+e}return c+e+r+e+e}return e}function te(e,r){var a="";var c=S(e);for(var t=0;t<c;t++)a+=r(e[t],t,e,r)||"";return a}function ne(e,r,a,c){switch(e.type){case o:case s:return e.return=e.return||e.value;case t:return"";case b:return e.return=e.value+"{"+te(e.children,c)+"}";case n:e.value=e.props.join(",")}return M(a=te(e.children,c))?e.return=e.value+"{"+a+"}":""}function se(e){var r=S(e);return function(a,c,t,n){var s="";for(var i=0;i<r;i++)s+=e[i](a,c,t,n)||"";return s}}function ie(e){return function(r){if(!r.root)if(r=r.return)e(r)}}function ue(e,t,i,u){if(e.length>-1)if(!e.return)switch(e.type){case s:e.return=ce(e.value,e.length);break;case b:return te([P(e,{value:T(e.value,"@","@"+c)})],u);case n:if(e.length)return z(e.props,(function(t){switch(y(t,/(::plac\w+|:read-\w+)/)){case":read-only":case":read-write":return te([P(e,{props:[T(t,/:(read-\w+)/,":"+a+"$1")]})],u);case"::placeholder":return te([P(e,{props:[T(t,/:(plac\w+)/,":"+c+"input-$1")]}),P(e,{props:[T(t,/:(plac\w+)/,":"+a+"$1")]}),P(e,{props:[T(t,/:(plac\w+)/,r+"input-$1")]})],u)}return""}))}}function oe(e){switch(e.type){case n:e.props=e.props.map((function(r){return z(Y(r),(function(r,a,c){switch(O(r,0)){case 12:return C(r,1,M(r));case 0:case 40:case 43:case 62:case 126:return r;case 58:if(c[++a]==="global")c[a]="",c[++a]="\f"+C(c[a],a=1,-1);case 32:return a===1?"":r;default:switch(a){case 0:e=r;return S(c)>1?"":r;case a=S(c)-1:case 2:return a===2?r+e+e:r+e;default:return r}}}))}))}}e.CHARSET=f;e.COMMENT=t;e.COUNTER_STYLE=m;e.DECLARATION=s;e.DOCUMENT=p;e.FONT_FACE=d;e.FONT_FEATURE_VALUES=w;e.IMPORT=o;e.KEYFRAMES=b;e.MEDIA=u;e.MOZ=a;e.MS=r;e.NAMESPACE=v;e.PAGE=i;e.RULESET=n;e.SUPPORTS=h;e.VIEWPORT=l;e.WEBKIT=c;e.abs=k;e.alloc=K;e.append=R;e.assign=g;e.caret=I;e.char=j;e.charat=O;e.combine=z;e.comment=re;e.commenter=q;e.compile=Q;e.copy=P;e.dealloc=V;e.declaration=ae;e.delimit=W;e.delimiter=Z;e.escaping=H;e.from=$;e.hash=x;e.identifier=J;e.indexof=A;e.match=y;e.middleware=se;e.namespace=oe;e.next=_;e.node=N;e.parse=X;e.peek=F;e.prefix=ce;e.prefixer=ue;e.prev=U;e.replace=T;e.ruleset=ee;e.rulesheet=ie;e.serialize=te;e.sizeof=S;e.slice=L;e.stringify=ne;e.strlen=M;e.substr=C;e.token=D;e.tokenize=Y;e.tokenizer=G;e.trim=E;e.whitespace=B;Object.defineProperty(e,"__esModule",{value:true})}));


},{}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const View = require("@itkyk/view");
const css_1 = require("@emotion/css");
class Code extends View.Component {
    constructor(props) {
        super(props);
        this.style = () => {
            return {
                wrap: (0, css_1.css)({
                    width: "100%"
                }),
                title: (0, css_1.css)({
                    fontSize: "20px",
                    marginBottom: "-50px"
                })
            };
        };
        console.log(this);
        this.init(() => {
        });
    }
}
exports.default = () => View.createComponent(".code", Code);

},{"@emotion/css":5,"@itkyk/view":16}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const View = require("@itkyk/view");
const css_1 = require("@emotion/css");
class ViewPort extends View.Component {
    constructor(props) {
        super(props);
        this.style = () => {
            return {
                wrap: (0, css_1.css)({
                    marginTop: "20px"
                }),
                title: (0, css_1.css)({
                    fontSize: "20px",
                    marginBottom: "20px"
                }),
                contents: (0, css_1.css)({
                    border: "solid 1px #ccc"
                }),
            };
        };
        this.init(() => {
        });
    }
}
exports.default = () => View.createComponent(".viewport", ViewPort);

},{"@emotion/css":5,"@itkyk/view":16}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const View = require("@itkyk/view");
const custom_scrollbar_1 = require("@itkyk/custom-scrollbar");
const css_1 = require("@emotion/css");
const Code_1 = require("../../components/Organisms/Code");
const ViewPort_1 = require("../../components/Organisms/ViewPort");
class Scroller extends View.Page {
    constructor(props) {
        super(props);
        this.startScrollBar = () => {
            this.scrollbar = new custom_scrollbar_1.CustomScrollbar(this.refs.target, {});
        };
        this.globalStyle = () => {
            (0, css_1.injectGlobal)({
                "body": {
                    padding: "20px"
                }
            });
        };
        this.style = () => {
            return {
                contentsWrap: (0, css_1.css)({
                    display: "grid",
                    gridTemplateColumns: "530px calc(100vw - 570px)",
                    h2: {
                        fontSize: "20px",
                        fontWeight: 500,
                    }
                }),
                wrap: (0, css_1.css)({
                    position: "relative",
                    width: "530px",
                    paddingRight: "30px",
                }),
                contents: (0, css_1.css)({
                    width: "500px",
                    height: "500px",
                    overflow: "scroll",
                    msOverflowStyle: "none",
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": {
                        display: "none"
                    }
                }),
                scrollWrap: (0, css_1.css)({
                    position: "absolute",
                    top: "20px",
                    right: "0",
                    height: "460px",
                    width: "10px",
                    backgroundColor: "#ccc",
                }),
                scrollBar: (0, css_1.css)({
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "10px",
                    height: "50px",
                    backgroundColor: "#555"
                }),
                codes: (0, css_1.css)({
                    fontSize: "13px!important"
                })
            };
        };
        this.scrollbar = null;
        this.init(() => {
            this.globalStyle();
            this.startScrollBar();
        });
    }
}
View.createComponent("#scrollbar", Scroller);
(0, Code_1.default)();
(0, ViewPort_1.default)();

},{"../../components/Organisms/Code":19,"../../components/Organisms/ViewPort":20,"@emotion/css":5,"@itkyk/custom-scrollbar":14,"@itkyk/view":16}]},{},[21])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vY2FjaGUvZGlzdC9lbW90aW9uLWNhY2hlLmJyb3dzZXIuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL2Nzcy9jcmVhdGUtaW5zdGFuY2UvZGlzdC9lbW90aW9uLWNzcy1jcmVhdGUtaW5zdGFuY2UuY2pzLmRldi5qcyIsIm5vZGVfbW9kdWxlcy9AZW1vdGlvbi9jc3MvY3JlYXRlLWluc3RhbmNlL2Rpc3QvZW1vdGlvbi1jc3MtY3JlYXRlLWluc3RhbmNlLmNqcy5wcm9kLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL2Nzcy9kaXN0L2Vtb3Rpb24tY3NzLmNqcy5kZXYuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vY3NzL2Rpc3QvZW1vdGlvbi1jc3MuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL2Nzcy9kaXN0L2Vtb3Rpb24tY3NzLmNqcy5wcm9kLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL2hhc2gvZGlzdC9oYXNoLmJyb3dzZXIuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL21lbW9pemUvZGlzdC9lbW90aW9uLW1lbW9pemUuYnJvd3Nlci5janMuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vc2VyaWFsaXplL2Rpc3QvZW1vdGlvbi1zZXJpYWxpemUuYnJvd3Nlci5janMuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vc2hlZXQvZGlzdC9lbW90aW9uLXNoZWV0LmJyb3dzZXIuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL3VuaXRsZXNzL2Rpc3QvdW5pdGxlc3MuYnJvd3Nlci5janMuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vdXRpbHMvZGlzdC9lbW90aW9uLXV0aWxzLmJyb3dzZXIuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL3dlYWstbWVtb2l6ZS9kaXN0L3dlYWstbWVtb2l6ZS5icm93c2VyLmNqcy5qcyIsIm5vZGVfbW9kdWxlcy9AaXRreWsvY3VzdG9tLXNjcm9sbGJhci9kaXN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0BpdGt5ay9jdXN0b20tc2Nyb2xsYmFyL2Rpc3QvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9AaXRreWsvdmlldy9kaXN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9zdHlsaXMvZGlzdC91bWQvc3R5bGlzLmpzIiwic3JjL2Fzc2V0cy9qcy9jb21wb25lbnRzL09yZ2FuaXNtcy9Db2RlLnRzIiwic3JjL2Fzc2V0cy9qcy9jb21wb25lbnRzL09yZ2FuaXNtcy9WaWV3UG9ydC50cyIsInNyYy9hc3NldHMvanMvcGFnZXMvc2Nyb2xsYmFyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2hWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3BVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTs7OztBQ0ZBLG9DQUFvQztBQUNwQyxzQ0FBaUM7QUFFakMsTUFBTSxJQUFLLFNBQVEsSUFBSSxDQUFDLFNBQVM7SUFDL0IsWUFBWSxLQUFLO1FBQ2YsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBT2YsVUFBSyxHQUFHLEdBQUcsRUFBRTtZQUNYLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLElBQUEsU0FBRyxFQUFDO29CQUNSLEtBQUssRUFBRSxNQUFNO2lCQUNkLENBQUM7Z0JBQ0YsS0FBSyxFQUFFLElBQUEsU0FBRyxFQUFDO29CQUNULFFBQVEsRUFBRSxNQUFNO29CQUNoQixZQUFZLEVBQUUsT0FBTztpQkFDdEIsQ0FBQzthQUNILENBQUE7UUFDSCxDQUFDLENBQUE7UUFoQkMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNqQixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUUsRUFBRTtRQUVkLENBQUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQWFGO0FBRUQsa0JBQWUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7Ozs7O0FDekJ6RCxvQ0FBb0M7QUFDcEMsc0NBQWlDO0FBRWpDLE1BQU0sUUFBUyxTQUFRLElBQUksQ0FBQyxTQUFTO0lBQ25DLFlBQVksS0FBSztRQUNmLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQU1mLFVBQUssR0FBRyxHQUFHLEVBQUU7WUFDWCxPQUFPO2dCQUNMLElBQUksRUFBRSxJQUFBLFNBQUcsRUFBQztvQkFDUixTQUFTLEVBQUUsTUFBTTtpQkFDbEIsQ0FBQztnQkFDRixLQUFLLEVBQUUsSUFBQSxTQUFHLEVBQUM7b0JBQ1QsUUFBUSxFQUFFLE1BQU07b0JBQ2hCLFlBQVksRUFBRSxNQUFNO2lCQUNyQixDQUFDO2dCQUNGLFFBQVEsRUFBRSxJQUFBLFNBQUcsRUFBQztvQkFDWixNQUFNLEVBQUUsZ0JBQWdCO2lCQUN6QixDQUFDO2FBQ0gsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQWxCQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUUsRUFBRTtRQUVkLENBQUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQWdCRjtBQUVELGtCQUFlLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxDQUFBOzs7OztBQzNCaEUsb0NBQW9DO0FBQ3BDLDhEQUF3RDtBQUN4RCxzQ0FBK0M7QUFDL0MsMERBQW1EO0FBQ25ELGtFQUEyRDtBQUUzRCxNQUFNLFFBQVMsU0FBUSxJQUFJLENBQUMsSUFBSTtJQUU5QixZQUFZLEtBQUs7UUFDZixLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7UUFRZixtQkFBYyxHQUFHLEdBQUcsRUFBRTtZQUNwQixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksa0NBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQTtRQUM1RCxDQUFDLENBQUE7UUFFRCxnQkFBVyxHQUFHLEdBQUcsRUFBRTtZQUNqQixJQUFBLGtCQUFZLEVBQUM7Z0JBQ1gsTUFBTSxFQUFFO29CQUNOLE9BQU8sRUFBRSxNQUFNO2lCQUNoQjthQUNGLENBQUMsQ0FBQTtRQUNKLENBQUMsQ0FBQTtRQUVELFVBQUssR0FBRyxHQUFHLEVBQUU7WUFDWCxPQUFPO2dCQUNMLFlBQVksRUFBRSxJQUFBLFNBQUcsRUFBQztvQkFDaEIsT0FBTyxFQUFFLE1BQU07b0JBQ2YsbUJBQW1CLEVBQUUsMkJBQTJCO29CQUNoRCxFQUFFLEVBQUU7d0JBQ0YsUUFBUSxFQUFFLE1BQU07d0JBQ2hCLFVBQVUsRUFBRSxHQUFHO3FCQUNoQjtpQkFDRixDQUFDO2dCQUNGLElBQUksRUFBRSxJQUFBLFNBQUcsRUFBQztvQkFDUixRQUFRLEVBQUUsVUFBVTtvQkFDcEIsS0FBSyxFQUFFLE9BQU87b0JBQ2QsWUFBWSxFQUFFLE1BQU07aUJBQ3JCLENBQUM7Z0JBQ0YsUUFBUSxFQUFFLElBQUEsU0FBRyxFQUFDO29CQUNaLEtBQUssRUFBRSxPQUFPO29CQUNkLE1BQU0sRUFBRSxPQUFPO29CQUNmLFFBQVEsRUFBRSxRQUFRO29CQUNsQixlQUFlLEVBQUUsTUFBTTtvQkFDdkIsY0FBYyxFQUFFLE1BQU07b0JBQ3RCLHNCQUFzQixFQUFFO3dCQUN0QixPQUFPLEVBQUUsTUFBTTtxQkFDaEI7aUJBQ0YsQ0FBQztnQkFDRixVQUFVLEVBQUUsSUFBQSxTQUFHLEVBQUM7b0JBQ2QsUUFBUSxFQUFFLFVBQVU7b0JBQ3BCLEdBQUcsRUFBRSxNQUFNO29CQUNYLEtBQUssRUFBRSxHQUFHO29CQUNWLE1BQU0sRUFBRSxPQUFPO29CQUNmLEtBQUssRUFBRSxNQUFNO29CQUNiLGVBQWUsRUFBRSxNQUFNO2lCQUN4QixDQUFDO2dCQUNGLFNBQVMsRUFBRSxJQUFBLFNBQUcsRUFBQztvQkFDYixRQUFRLEVBQUUsVUFBVTtvQkFDcEIsSUFBSSxFQUFFLENBQUM7b0JBQ1AsR0FBRyxFQUFFLENBQUM7b0JBQ04sS0FBSyxFQUFFLE1BQU07b0JBQ2IsTUFBTSxFQUFFLE1BQU07b0JBQ2QsZUFBZSxFQUFFLE1BQU07aUJBQ3hCLENBQUM7Z0JBQ0YsS0FBSyxFQUFFLElBQUEsU0FBRyxFQUFDO29CQUNULFFBQVEsRUFBRSxnQkFBZ0I7aUJBQzNCLENBQUM7YUFDSCxDQUFBO1FBQ0gsQ0FBQyxDQUFBO1FBaEVDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRSxFQUFFO1lBQ1osSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ25CLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN4QixDQUFDLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0E0REY7QUFFRCxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztBQUM3QyxJQUFBLGNBQUksR0FBRSxDQUFDO0FBQ1AsSUFBQSxrQkFBUSxHQUFFLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbnZhciBzaGVldCA9IHJlcXVpcmUoJ0BlbW90aW9uL3NoZWV0Jyk7XG52YXIgc3R5bGlzID0gcmVxdWlyZSgnc3R5bGlzJyk7XG5yZXF1aXJlKCdAZW1vdGlvbi93ZWFrLW1lbW9pemUnKTtcbnJlcXVpcmUoJ0BlbW90aW9uL21lbW9pemUnKTtcblxudmFyIGxhc3QgPSBmdW5jdGlvbiBsYXN0KGFycikge1xuICByZXR1cm4gYXJyLmxlbmd0aCA/IGFyclthcnIubGVuZ3RoIC0gMV0gOiBudWxsO1xufTsgLy8gYmFzZWQgb24gaHR0cHM6Ly9naXRodWIuY29tL3RoeXN1bHRhbi9zdHlsaXMuanMvYmxvYi9lNjg0M2MzNzNlYmNiYmZhZGUyNWViY2MyM2Y1NDBlZDg1MDhkYTBhL3NyYy9Ub2tlbml6ZXIuanMjTDIzOS1MMjQ0XG5cblxudmFyIGlkZW50aWZpZXJXaXRoUG9pbnRUcmFja2luZyA9IGZ1bmN0aW9uIGlkZW50aWZpZXJXaXRoUG9pbnRUcmFja2luZyhiZWdpbiwgcG9pbnRzLCBpbmRleCkge1xuICB2YXIgcHJldmlvdXMgPSAwO1xuICB2YXIgY2hhcmFjdGVyID0gMDtcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHByZXZpb3VzID0gY2hhcmFjdGVyO1xuICAgIGNoYXJhY3RlciA9IHN0eWxpcy5wZWVrKCk7IC8vICZcXGZcblxuICAgIGlmIChwcmV2aW91cyA9PT0gMzggJiYgY2hhcmFjdGVyID09PSAxMikge1xuICAgICAgcG9pbnRzW2luZGV4XSA9IDE7XG4gICAgfVxuXG4gICAgaWYgKHN0eWxpcy50b2tlbihjaGFyYWN0ZXIpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBzdHlsaXMubmV4dCgpO1xuICB9XG5cbiAgcmV0dXJuIHN0eWxpcy5zbGljZShiZWdpbiwgc3R5bGlzLnBvc2l0aW9uKTtcbn07XG5cbnZhciB0b1J1bGVzID0gZnVuY3Rpb24gdG9SdWxlcyhwYXJzZWQsIHBvaW50cykge1xuICAvLyBwcmV0ZW5kIHdlJ3ZlIHN0YXJ0ZWQgd2l0aCBhIGNvbW1hXG4gIHZhciBpbmRleCA9IC0xO1xuICB2YXIgY2hhcmFjdGVyID0gNDQ7XG5cbiAgZG8ge1xuICAgIHN3aXRjaCAoc3R5bGlzLnRva2VuKGNoYXJhY3RlcikpIHtcbiAgICAgIGNhc2UgMDpcbiAgICAgICAgLy8gJlxcZlxuICAgICAgICBpZiAoY2hhcmFjdGVyID09PSAzOCAmJiBzdHlsaXMucGVlaygpID09PSAxMikge1xuICAgICAgICAgIC8vIHRoaXMgaXMgbm90IDEwMCUgY29ycmVjdCwgd2UgZG9uJ3QgYWNjb3VudCBmb3IgbGl0ZXJhbCBzZXF1ZW5jZXMgaGVyZSAtIGxpa2UgZm9yIGV4YW1wbGUgcXVvdGVkIHN0cmluZ3NcbiAgICAgICAgICAvLyBzdHlsaXMgaW5zZXJ0cyBcXGYgYWZ0ZXIgJiB0byBrbm93IHdoZW4gJiB3aGVyZSBpdCBzaG91bGQgcmVwbGFjZSB0aGlzIHNlcXVlbmNlIHdpdGggdGhlIGNvbnRleHQgc2VsZWN0b3JcbiAgICAgICAgICAvLyBhbmQgd2hlbiBpdCBzaG91bGQganVzdCBjb25jYXRlbmF0ZSB0aGUgb3V0ZXIgYW5kIGlubmVyIHNlbGVjdG9yc1xuICAgICAgICAgIC8vIGl0J3MgdmVyeSB1bmxpa2VseSBmb3IgdGhpcyBzZXF1ZW5jZSB0byBhY3R1YWxseSBhcHBlYXIgaW4gYSBkaWZmZXJlbnQgY29udGV4dCwgc28gd2UganVzdCBsZXZlcmFnZSB0aGlzIGZhY3QgaGVyZVxuICAgICAgICAgIHBvaW50c1tpbmRleF0gPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyc2VkW2luZGV4XSArPSBpZGVudGlmaWVyV2l0aFBvaW50VHJhY2tpbmcoc3R5bGlzLnBvc2l0aW9uIC0gMSwgcG9pbnRzLCBpbmRleCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIDI6XG4gICAgICAgIHBhcnNlZFtpbmRleF0gKz0gc3R5bGlzLmRlbGltaXQoY2hhcmFjdGVyKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgNDpcbiAgICAgICAgLy8gY29tbWFcbiAgICAgICAgaWYgKGNoYXJhY3RlciA9PT0gNDQpIHtcbiAgICAgICAgICAvLyBjb2xvblxuICAgICAgICAgIHBhcnNlZFsrK2luZGV4XSA9IHN0eWxpcy5wZWVrKCkgPT09IDU4ID8gJyZcXGYnIDogJyc7XG4gICAgICAgICAgcG9pbnRzW2luZGV4XSA9IHBhcnNlZFtpbmRleF0ubGVuZ3RoO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgIC8vIGZhbGx0aHJvdWdoXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHBhcnNlZFtpbmRleF0gKz0gc3R5bGlzLmZyb20oY2hhcmFjdGVyKTtcbiAgICB9XG4gIH0gd2hpbGUgKGNoYXJhY3RlciA9IHN0eWxpcy5uZXh0KCkpO1xuXG4gIHJldHVybiBwYXJzZWQ7XG59O1xuXG52YXIgZ2V0UnVsZXMgPSBmdW5jdGlvbiBnZXRSdWxlcyh2YWx1ZSwgcG9pbnRzKSB7XG4gIHJldHVybiBzdHlsaXMuZGVhbGxvYyh0b1J1bGVzKHN0eWxpcy5hbGxvYyh2YWx1ZSksIHBvaW50cykpO1xufTsgLy8gV2Vha1NldCB3b3VsZCBiZSBtb3JlIGFwcHJvcHJpYXRlLCBidXQgb25seSBXZWFrTWFwIGlzIHN1cHBvcnRlZCBpbiBJRTExXG5cblxudmFyIGZpeGVkRWxlbWVudHMgPSAvKiAjX19QVVJFX18gKi9uZXcgV2Vha01hcCgpO1xudmFyIGNvbXBhdCA9IGZ1bmN0aW9uIGNvbXBhdChlbGVtZW50KSB7XG4gIGlmIChlbGVtZW50LnR5cGUgIT09ICdydWxlJyB8fCAhZWxlbWVudC5wYXJlbnQgfHwgLy8gcG9zaXRpdmUgLmxlbmd0aCBpbmRpY2F0ZXMgdGhhdCB0aGlzIHJ1bGUgY29udGFpbnMgcHNldWRvXG4gIC8vIG5lZ2F0aXZlIC5sZW5ndGggaW5kaWNhdGVzIHRoYXQgdGhpcyBydWxlIGhhcyBiZWVuIGFscmVhZHkgcHJlZml4ZWRcbiAgZWxlbWVudC5sZW5ndGggPCAxKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIHZhbHVlID0gZWxlbWVudC52YWx1ZSxcbiAgICAgIHBhcmVudCA9IGVsZW1lbnQucGFyZW50O1xuICB2YXIgaXNJbXBsaWNpdFJ1bGUgPSBlbGVtZW50LmNvbHVtbiA9PT0gcGFyZW50LmNvbHVtbiAmJiBlbGVtZW50LmxpbmUgPT09IHBhcmVudC5saW5lO1xuXG4gIHdoaWxlIChwYXJlbnQudHlwZSAhPT0gJ3J1bGUnKSB7XG4gICAgcGFyZW50ID0gcGFyZW50LnBhcmVudDtcbiAgICBpZiAoIXBhcmVudCkgcmV0dXJuO1xuICB9IC8vIHNob3J0LWNpcmN1aXQgZm9yIHRoZSBzaW1wbGVzdCBjYXNlXG5cblxuICBpZiAoZWxlbWVudC5wcm9wcy5sZW5ndGggPT09IDEgJiYgdmFsdWUuY2hhckNvZGVBdCgwKSAhPT0gNThcbiAgLyogY29sb24gKi9cbiAgJiYgIWZpeGVkRWxlbWVudHMuZ2V0KHBhcmVudCkpIHtcbiAgICByZXR1cm47XG4gIH0gLy8gaWYgdGhpcyBpcyBhbiBpbXBsaWNpdGx5IGluc2VydGVkIHJ1bGUgKHRoZSBvbmUgZWFnZXJseSBpbnNlcnRlZCBhdCB0aGUgZWFjaCBuZXcgbmVzdGVkIGxldmVsKVxuICAvLyB0aGVuIHRoZSBwcm9wcyBoYXMgYWxyZWFkeSBiZWVuIG1hbmlwdWxhdGVkIGJlZm9yZWhhbmQgYXMgdGhleSB0aGF0IGFycmF5IGlzIHNoYXJlZCBiZXR3ZWVuIGl0IGFuZCBpdHMgXCJydWxlIHBhcmVudFwiXG5cblxuICBpZiAoaXNJbXBsaWNpdFJ1bGUpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBmaXhlZEVsZW1lbnRzLnNldChlbGVtZW50LCB0cnVlKTtcbiAgdmFyIHBvaW50cyA9IFtdO1xuICB2YXIgcnVsZXMgPSBnZXRSdWxlcyh2YWx1ZSwgcG9pbnRzKTtcbiAgdmFyIHBhcmVudFJ1bGVzID0gcGFyZW50LnByb3BzO1xuXG4gIGZvciAodmFyIGkgPSAwLCBrID0gMDsgaSA8IHJ1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBwYXJlbnRSdWxlcy5sZW5ndGg7IGorKywgaysrKSB7XG4gICAgICBlbGVtZW50LnByb3BzW2tdID0gcG9pbnRzW2ldID8gcnVsZXNbaV0ucmVwbGFjZSgvJlxcZi9nLCBwYXJlbnRSdWxlc1tqXSkgOiBwYXJlbnRSdWxlc1tqXSArIFwiIFwiICsgcnVsZXNbaV07XG4gICAgfVxuICB9XG59O1xudmFyIHJlbW92ZUxhYmVsID0gZnVuY3Rpb24gcmVtb3ZlTGFiZWwoZWxlbWVudCkge1xuICBpZiAoZWxlbWVudC50eXBlID09PSAnZGVjbCcpIHtcbiAgICB2YXIgdmFsdWUgPSBlbGVtZW50LnZhbHVlO1xuXG4gICAgaWYgKCAvLyBjaGFyY29kZSBmb3IgbFxuICAgIHZhbHVlLmNoYXJDb2RlQXQoMCkgPT09IDEwOCAmJiAvLyBjaGFyY29kZSBmb3IgYlxuICAgIHZhbHVlLmNoYXJDb2RlQXQoMikgPT09IDk4KSB7XG4gICAgICAvLyB0aGlzIGlnbm9yZXMgbGFiZWxcbiAgICAgIGVsZW1lbnRbXCJyZXR1cm5cIl0gPSAnJztcbiAgICAgIGVsZW1lbnQudmFsdWUgPSAnJztcbiAgICB9XG4gIH1cbn07XG52YXIgaWdub3JlRmxhZyA9ICdlbW90aW9uLWRpc2FibGUtc2VydmVyLXJlbmRlcmluZy11bnNhZmUtc2VsZWN0b3Itd2FybmluZy1wbGVhc2UtZG8tbm90LXVzZS10aGlzLXRoZS13YXJuaW5nLWV4aXN0cy1mb3ItYS1yZWFzb24nO1xuXG52YXIgaXNJZ25vcmluZ0NvbW1lbnQgPSBmdW5jdGlvbiBpc0lnbm9yaW5nQ29tbWVudChlbGVtZW50KSB7XG4gIHJldHVybiAhIWVsZW1lbnQgJiYgZWxlbWVudC50eXBlID09PSAnY29tbScgJiYgZWxlbWVudC5jaGlsZHJlbi5pbmRleE9mKGlnbm9yZUZsYWcpID4gLTE7XG59O1xuXG52YXIgY3JlYXRlVW5zYWZlU2VsZWN0b3JzQWxhcm0gPSBmdW5jdGlvbiBjcmVhdGVVbnNhZmVTZWxlY3RvcnNBbGFybShjYWNoZSkge1xuICByZXR1cm4gZnVuY3Rpb24gKGVsZW1lbnQsIGluZGV4LCBjaGlsZHJlbikge1xuICAgIGlmIChlbGVtZW50LnR5cGUgIT09ICdydWxlJykgcmV0dXJuO1xuICAgIHZhciB1bnNhZmVQc2V1ZG9DbGFzc2VzID0gZWxlbWVudC52YWx1ZS5tYXRjaCgvKDpmaXJzdHw6bnRofDpudGgtbGFzdCktY2hpbGQvZyk7XG5cbiAgICBpZiAodW5zYWZlUHNldWRvQ2xhc3NlcyAmJiBjYWNoZS5jb21wYXQgIT09IHRydWUpIHtcbiAgICAgIHZhciBwcmV2RWxlbWVudCA9IGluZGV4ID4gMCA/IGNoaWxkcmVuW2luZGV4IC0gMV0gOiBudWxsO1xuXG4gICAgICBpZiAocHJldkVsZW1lbnQgJiYgaXNJZ25vcmluZ0NvbW1lbnQobGFzdChwcmV2RWxlbWVudC5jaGlsZHJlbikpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdW5zYWZlUHNldWRvQ2xhc3Nlcy5mb3JFYWNoKGZ1bmN0aW9uICh1bnNhZmVQc2V1ZG9DbGFzcykge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiVGhlIHBzZXVkbyBjbGFzcyBcXFwiXCIgKyB1bnNhZmVQc2V1ZG9DbGFzcyArIFwiXFxcIiBpcyBwb3RlbnRpYWxseSB1bnNhZmUgd2hlbiBkb2luZyBzZXJ2ZXItc2lkZSByZW5kZXJpbmcuIFRyeSBjaGFuZ2luZyBpdCB0byBcXFwiXCIgKyB1bnNhZmVQc2V1ZG9DbGFzcy5zcGxpdCgnLWNoaWxkJylbMF0gKyBcIi1vZi10eXBlXFxcIi5cIik7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG59O1xuXG52YXIgaXNJbXBvcnRSdWxlID0gZnVuY3Rpb24gaXNJbXBvcnRSdWxlKGVsZW1lbnQpIHtcbiAgcmV0dXJuIGVsZW1lbnQudHlwZS5jaGFyQ29kZUF0KDEpID09PSAxMDUgJiYgZWxlbWVudC50eXBlLmNoYXJDb2RlQXQoMCkgPT09IDY0O1xufTtcblxudmFyIGlzUHJlcGVuZGVkV2l0aFJlZ3VsYXJSdWxlcyA9IGZ1bmN0aW9uIGlzUHJlcGVuZGVkV2l0aFJlZ3VsYXJSdWxlcyhpbmRleCwgY2hpbGRyZW4pIHtcbiAgZm9yICh2YXIgaSA9IGluZGV4IC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoIWlzSW1wb3J0UnVsZShjaGlsZHJlbltpXSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn07IC8vIHVzZSB0aGlzIHRvIHJlbW92ZSBpbmNvcnJlY3QgZWxlbWVudHMgZnJvbSBmdXJ0aGVyIHByb2Nlc3Npbmdcbi8vIHNvIHRoZXkgZG9uJ3QgZ2V0IGhhbmRlZCB0byB0aGUgYHNoZWV0YCAob3IgYW55dGhpbmcgZWxzZSlcbi8vIGFzIHRoYXQgY291bGQgcG90ZW50aWFsbHkgbGVhZCB0byBhZGRpdGlvbmFsIGxvZ3Mgd2hpY2ggaW4gdHVybiBjb3VsZCBiZSBvdmVyaGVsbWluZyB0byB0aGUgdXNlclxuXG5cbnZhciBudWxsaWZ5RWxlbWVudCA9IGZ1bmN0aW9uIG51bGxpZnlFbGVtZW50KGVsZW1lbnQpIHtcbiAgZWxlbWVudC50eXBlID0gJyc7XG4gIGVsZW1lbnQudmFsdWUgPSAnJztcbiAgZWxlbWVudFtcInJldHVyblwiXSA9ICcnO1xuICBlbGVtZW50LmNoaWxkcmVuID0gJyc7XG4gIGVsZW1lbnQucHJvcHMgPSAnJztcbn07XG5cbnZhciBpbmNvcnJlY3RJbXBvcnRBbGFybSA9IGZ1bmN0aW9uIGluY29ycmVjdEltcG9ydEFsYXJtKGVsZW1lbnQsIGluZGV4LCBjaGlsZHJlbikge1xuICBpZiAoIWlzSW1wb3J0UnVsZShlbGVtZW50KSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChlbGVtZW50LnBhcmVudCkge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJgQGltcG9ydGAgcnVsZXMgY2FuJ3QgYmUgbmVzdGVkIGluc2lkZSBvdGhlciBydWxlcy4gUGxlYXNlIG1vdmUgaXQgdG8gdGhlIHRvcCBsZXZlbCBhbmQgcHV0IGl0IGJlZm9yZSByZWd1bGFyIHJ1bGVzLiBLZWVwIGluIG1pbmQgdGhhdCB0aGV5IGNhbiBvbmx5IGJlIHVzZWQgd2l0aGluIGdsb2JhbCBzdHlsZXMuXCIpO1xuICAgIG51bGxpZnlFbGVtZW50KGVsZW1lbnQpO1xuICB9IGVsc2UgaWYgKGlzUHJlcGVuZGVkV2l0aFJlZ3VsYXJSdWxlcyhpbmRleCwgY2hpbGRyZW4pKSB7XG4gICAgY29uc29sZS5lcnJvcihcImBAaW1wb3J0YCBydWxlcyBjYW4ndCBiZSBhZnRlciBvdGhlciBydWxlcy4gUGxlYXNlIHB1dCB5b3VyIGBAaW1wb3J0YCBydWxlcyBiZWZvcmUgeW91ciBvdGhlciBydWxlcy5cIik7XG4gICAgbnVsbGlmeUVsZW1lbnQoZWxlbWVudCk7XG4gIH1cbn07XG5cbnZhciBkZWZhdWx0U3R5bGlzUGx1Z2lucyA9IFtzdHlsaXMucHJlZml4ZXJdO1xuXG52YXIgY3JlYXRlQ2FjaGUgPSBmdW5jdGlvbiBjcmVhdGVDYWNoZShvcHRpb25zKSB7XG4gIHZhciBrZXkgPSBvcHRpb25zLmtleTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiAha2V5KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiWW91IGhhdmUgdG8gY29uZmlndXJlIGBrZXlgIGZvciB5b3VyIGNhY2hlLiBQbGVhc2UgbWFrZSBzdXJlIGl0J3MgdW5pcXVlIChhbmQgbm90IGVxdWFsIHRvICdjc3MnKSBhcyBpdCdzIHVzZWQgZm9yIGxpbmtpbmcgc3R5bGVzIHRvIHlvdXIgY2FjaGUuXFxuXCIgKyBcIklmIG11bHRpcGxlIGNhY2hlcyBzaGFyZSB0aGUgc2FtZSBrZXkgdGhleSBtaWdodCBcXFwiZmlnaHRcXFwiIGZvciBlYWNoIG90aGVyJ3Mgc3R5bGUgZWxlbWVudHMuXCIpO1xuICB9XG5cbiAgaWYgKCBrZXkgPT09ICdjc3MnKSB7XG4gICAgdmFyIHNzclN0eWxlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJzdHlsZVtkYXRhLWVtb3Rpb25dOm5vdChbZGF0YS1zXSlcIik7IC8vIGdldCBTU1JlZCBzdHlsZXMgb3V0IG9mIHRoZSB3YXkgb2YgUmVhY3QncyBoeWRyYXRpb25cbiAgICAvLyBkb2N1bWVudC5oZWFkIGlzIGEgc2FmZSBwbGFjZSB0byBtb3ZlIHRoZW0gdG8odGhvdWdoIG5vdGUgZG9jdW1lbnQuaGVhZCBpcyBub3QgbmVjZXNzYXJpbHkgdGhlIGxhc3QgcGxhY2UgdGhleSB3aWxsIGJlKVxuICAgIC8vIG5vdGUgdGhpcyB2ZXJ5IHZlcnkgaW50ZW50aW9uYWxseSB0YXJnZXRzIGFsbCBzdHlsZSBlbGVtZW50cyByZWdhcmRsZXNzIG9mIHRoZSBrZXkgdG8gZW5zdXJlXG4gICAgLy8gdGhhdCBjcmVhdGluZyBhIGNhY2hlIHdvcmtzIGluc2lkZSBvZiByZW5kZXIgb2YgYSBSZWFjdCBjb21wb25lbnRcblxuICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoc3NyU3R5bGVzLCBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgLy8gd2Ugd2FudCB0byBvbmx5IG1vdmUgZWxlbWVudHMgd2hpY2ggaGF2ZSBhIHNwYWNlIGluIHRoZSBkYXRhLWVtb3Rpb24gYXR0cmlidXRlIHZhbHVlXG4gICAgICAvLyBiZWNhdXNlIHRoYXQgaW5kaWNhdGVzIHRoYXQgaXQgaXMgYW4gRW1vdGlvbiAxMSBzZXJ2ZXItc2lkZSByZW5kZXJlZCBzdHlsZSBlbGVtZW50c1xuICAgICAgLy8gd2hpbGUgd2Ugd2lsbCBhbHJlYWR5IGlnbm9yZSBFbW90aW9uIDExIGNsaWVudC1zaWRlIGluc2VydGVkIHN0eWxlcyBiZWNhdXNlIG9mIHRoZSA6bm90KFtkYXRhLXNdKSBwYXJ0IGluIHRoZSBzZWxlY3RvclxuICAgICAgLy8gRW1vdGlvbiAxMCBjbGllbnQtc2lkZSBpbnNlcnRlZCBzdHlsZXMgZGlkIG5vdCBoYXZlIGRhdGEtcyAoYnV0IGltcG9ydGFudGx5IGRpZCBub3QgaGF2ZSBhIHNwYWNlIGluIHRoZWlyIGRhdGEtZW1vdGlvbiBhdHRyaWJ1dGVzKVxuICAgICAgLy8gc28gY2hlY2tpbmcgZm9yIHRoZSBzcGFjZSBlbnN1cmVzIHRoYXQgbG9hZGluZyBFbW90aW9uIDExIGFmdGVyIEVtb3Rpb24gMTAgaGFzIGluc2VydGVkIHNvbWUgc3R5bGVzXG4gICAgICAvLyB3aWxsIG5vdCByZXN1bHQgaW4gdGhlIEVtb3Rpb24gMTAgc3R5bGVzIGJlaW5nIGRlc3Ryb3llZFxuICAgICAgdmFyIGRhdGFFbW90aW9uQXR0cmlidXRlID0gbm9kZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtZW1vdGlvbicpO1xuXG4gICAgICBpZiAoZGF0YUVtb3Rpb25BdHRyaWJ1dGUuaW5kZXhPZignICcpID09PSAtMSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKG5vZGUpO1xuICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtcycsICcnKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZhciBzdHlsaXNQbHVnaW5zID0gb3B0aW9ucy5zdHlsaXNQbHVnaW5zIHx8IGRlZmF1bHRTdHlsaXNQbHVnaW5zO1xuXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgLy8gJEZsb3dGaXhNZVxuICAgIGlmICgvW15hLXotXS8udGVzdChrZXkpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFbW90aW9uIGtleSBtdXN0IG9ubHkgY29udGFpbiBsb3dlciBjYXNlIGFscGhhYmV0aWNhbCBjaGFyYWN0ZXJzIGFuZCAtIGJ1dCBcXFwiXCIgKyBrZXkgKyBcIlxcXCIgd2FzIHBhc3NlZFwiKTtcbiAgICB9XG4gIH1cblxuICB2YXIgaW5zZXJ0ZWQgPSB7fTsgLy8gJEZsb3dGaXhNZVxuXG4gIHZhciBjb250YWluZXI7XG4gIHZhciBub2Rlc1RvSHlkcmF0ZSA9IFtdO1xuXG4gIHtcbiAgICBjb250YWluZXIgPSBvcHRpb25zLmNvbnRhaW5lciB8fCBkb2N1bWVudC5oZWFkO1xuICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIC8vIHRoaXMgbWVhbnMgd2Ugd2lsbCBpZ25vcmUgZWxlbWVudHMgd2hpY2ggZG9uJ3QgaGF2ZSBhIHNwYWNlIGluIHRoZW0gd2hpY2hcbiAgICAvLyBtZWFucyB0aGF0IHRoZSBzdHlsZSBlbGVtZW50cyB3ZSdyZSBsb29raW5nIGF0IGFyZSBvbmx5IEVtb3Rpb24gMTEgc2VydmVyLXJlbmRlcmVkIHN0eWxlIGVsZW1lbnRzXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcInN0eWxlW2RhdGEtZW1vdGlvbl49XFxcIlwiICsga2V5ICsgXCIgXFxcIl1cIiksIGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICB2YXIgYXR0cmliID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJkYXRhLWVtb3Rpb25cIikuc3BsaXQoJyAnKTsgLy8gJEZsb3dGaXhNZVxuXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGF0dHJpYi5sZW5ndGg7IGkrKykge1xuICAgICAgICBpbnNlcnRlZFthdHRyaWJbaV1dID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgbm9kZXNUb0h5ZHJhdGUucHVzaChub2RlKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZhciBfaW5zZXJ0O1xuXG4gIHZhciBvbW5pcHJlc2VudFBsdWdpbnMgPSBbY29tcGF0LCByZW1vdmVMYWJlbF07XG5cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBvbW5pcHJlc2VudFBsdWdpbnMucHVzaChjcmVhdGVVbnNhZmVTZWxlY3RvcnNBbGFybSh7XG4gICAgICBnZXQgY29tcGF0KCkge1xuICAgICAgICByZXR1cm4gY2FjaGUuY29tcGF0O1xuICAgICAgfVxuXG4gICAgfSksIGluY29ycmVjdEltcG9ydEFsYXJtKTtcbiAgfVxuXG4gIHtcbiAgICB2YXIgY3VycmVudFNoZWV0O1xuICAgIHZhciBmaW5hbGl6aW5nUGx1Z2lucyA9IFtzdHlsaXMuc3RyaW5naWZ5LCBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgIGlmICghZWxlbWVudC5yb290KSB7XG4gICAgICAgIGlmIChlbGVtZW50W1wicmV0dXJuXCJdKSB7XG4gICAgICAgICAgY3VycmVudFNoZWV0Lmluc2VydChlbGVtZW50W1wicmV0dXJuXCJdKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50LnZhbHVlICYmIGVsZW1lbnQudHlwZSAhPT0gc3R5bGlzLkNPTU1FTlQpIHtcbiAgICAgICAgICAvLyBpbnNlcnQgZW1wdHkgcnVsZSBpbiBub24tcHJvZHVjdGlvbiBlbnZpcm9ubWVudHNcbiAgICAgICAgICAvLyBzbyBAZW1vdGlvbi9qZXN0IGNhbiBncmFiIGBrZXlgIGZyb20gdGhlIChKUylET00gZm9yIGNhY2hlcyB3aXRob3V0IGFueSBydWxlcyBpbnNlcnRlZCB5ZXRcbiAgICAgICAgICBjdXJyZW50U2hlZXQuaW5zZXJ0KGVsZW1lbnQudmFsdWUgKyBcInt9XCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSA6IHN0eWxpcy5ydWxlc2hlZXQoZnVuY3Rpb24gKHJ1bGUpIHtcbiAgICAgIGN1cnJlbnRTaGVldC5pbnNlcnQocnVsZSk7XG4gICAgfSldO1xuICAgIHZhciBzZXJpYWxpemVyID0gc3R5bGlzLm1pZGRsZXdhcmUob21uaXByZXNlbnRQbHVnaW5zLmNvbmNhdChzdHlsaXNQbHVnaW5zLCBmaW5hbGl6aW5nUGx1Z2lucykpO1xuXG4gICAgdmFyIHN0eWxpcyQxID0gZnVuY3Rpb24gc3R5bGlzJDEoc3R5bGVzKSB7XG4gICAgICByZXR1cm4gc3R5bGlzLnNlcmlhbGl6ZShzdHlsaXMuY29tcGlsZShzdHlsZXMpLCBzZXJpYWxpemVyKTtcbiAgICB9O1xuXG4gICAgX2luc2VydCA9IGZ1bmN0aW9uIGluc2VydChzZWxlY3Rvciwgc2VyaWFsaXplZCwgc2hlZXQsIHNob3VsZENhY2hlKSB7XG4gICAgICBjdXJyZW50U2hlZXQgPSBzaGVldDtcblxuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgc2VyaWFsaXplZC5tYXAgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjdXJyZW50U2hlZXQgPSB7XG4gICAgICAgICAgaW5zZXJ0OiBmdW5jdGlvbiBpbnNlcnQocnVsZSkge1xuICAgICAgICAgICAgc2hlZXQuaW5zZXJ0KHJ1bGUgKyBzZXJpYWxpemVkLm1hcCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBzdHlsaXMkMShzZWxlY3RvciA/IHNlbGVjdG9yICsgXCJ7XCIgKyBzZXJpYWxpemVkLnN0eWxlcyArIFwifVwiIDogc2VyaWFsaXplZC5zdHlsZXMpO1xuXG4gICAgICBpZiAoc2hvdWxkQ2FjaGUpIHtcbiAgICAgICAgY2FjaGUuaW5zZXJ0ZWRbc2VyaWFsaXplZC5uYW1lXSA9IHRydWU7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHZhciBjYWNoZSA9IHtcbiAgICBrZXk6IGtleSxcbiAgICBzaGVldDogbmV3IHNoZWV0LlN0eWxlU2hlZXQoe1xuICAgICAga2V5OiBrZXksXG4gICAgICBjb250YWluZXI6IGNvbnRhaW5lcixcbiAgICAgIG5vbmNlOiBvcHRpb25zLm5vbmNlLFxuICAgICAgc3BlZWR5OiBvcHRpb25zLnNwZWVkeSxcbiAgICAgIHByZXBlbmQ6IG9wdGlvbnMucHJlcGVuZCxcbiAgICAgIGluc2VydGlvblBvaW50OiBvcHRpb25zLmluc2VydGlvblBvaW50XG4gICAgfSksXG4gICAgbm9uY2U6IG9wdGlvbnMubm9uY2UsXG4gICAgaW5zZXJ0ZWQ6IGluc2VydGVkLFxuICAgIHJlZ2lzdGVyZWQ6IHt9LFxuICAgIGluc2VydDogX2luc2VydFxuICB9O1xuICBjYWNoZS5zaGVldC5oeWRyYXRlKG5vZGVzVG9IeWRyYXRlKTtcbiAgcmV0dXJuIGNhY2hlO1xufTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gY3JlYXRlQ2FjaGU7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbnZhciBjcmVhdGVDYWNoZSA9IHJlcXVpcmUoJ0BlbW90aW9uL2NhY2hlJyk7XG52YXIgc2VyaWFsaXplID0gcmVxdWlyZSgnQGVtb3Rpb24vc2VyaWFsaXplJyk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCdAZW1vdGlvbi91dGlscycpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcERlZmF1bHQgKGUpIHsgcmV0dXJuIGUgJiYgZS5fX2VzTW9kdWxlID8gZSA6IHsgJ2RlZmF1bHQnOiBlIH07IH1cblxudmFyIGNyZWF0ZUNhY2hlX19kZWZhdWx0ID0gLyojX19QVVJFX18qL19pbnRlcm9wRGVmYXVsdChjcmVhdGVDYWNoZSk7XG5cbmZ1bmN0aW9uIGluc2VydFdpdGhvdXRTY29waW5nKGNhY2hlLCBzZXJpYWxpemVkKSB7XG4gIGlmIChjYWNoZS5pbnNlcnRlZFtzZXJpYWxpemVkLm5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gY2FjaGUuaW5zZXJ0KCcnLCBzZXJpYWxpemVkLCBjYWNoZS5zaGVldCwgdHJ1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWVyZ2UocmVnaXN0ZXJlZCwgY3NzLCBjbGFzc05hbWUpIHtcbiAgdmFyIHJlZ2lzdGVyZWRTdHlsZXMgPSBbXTtcbiAgdmFyIHJhd0NsYXNzTmFtZSA9IHV0aWxzLmdldFJlZ2lzdGVyZWRTdHlsZXMocmVnaXN0ZXJlZCwgcmVnaXN0ZXJlZFN0eWxlcywgY2xhc3NOYW1lKTtcblxuICBpZiAocmVnaXN0ZXJlZFN0eWxlcy5sZW5ndGggPCAyKSB7XG4gICAgcmV0dXJuIGNsYXNzTmFtZTtcbiAgfVxuXG4gIHJldHVybiByYXdDbGFzc05hbWUgKyBjc3MocmVnaXN0ZXJlZFN0eWxlcyk7XG59XG5cbnZhciBjcmVhdGVFbW90aW9uID0gZnVuY3Rpb24gY3JlYXRlRW1vdGlvbihvcHRpb25zKSB7XG4gIHZhciBjYWNoZSA9IGNyZWF0ZUNhY2hlX19kZWZhdWx0WydkZWZhdWx0J10ob3B0aW9ucyk7IC8vICRGbG93Rml4TWVcblxuICBjYWNoZS5zaGVldC5zcGVlZHkgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB0aGlzLmN0ciAhPT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdzcGVlZHkgbXVzdCBiZSBjaGFuZ2VkIGJlZm9yZSBhbnkgcnVsZXMgYXJlIGluc2VydGVkJyk7XG4gICAgfVxuXG4gICAgdGhpcy5pc1NwZWVkeSA9IHZhbHVlO1xuICB9O1xuXG4gIGNhY2hlLmNvbXBhdCA9IHRydWU7XG5cbiAgdmFyIGNzcyA9IGZ1bmN0aW9uIGNzcygpIHtcbiAgICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IG5ldyBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICAgIGFyZ3NbX2tleV0gPSBhcmd1bWVudHNbX2tleV07XG4gICAgfVxuXG4gICAgdmFyIHNlcmlhbGl6ZWQgPSBzZXJpYWxpemUuc2VyaWFsaXplU3R5bGVzKGFyZ3MsIGNhY2hlLnJlZ2lzdGVyZWQsIHVuZGVmaW5lZCk7XG4gICAgdXRpbHMuaW5zZXJ0U3R5bGVzKGNhY2hlLCBzZXJpYWxpemVkLCBmYWxzZSk7XG4gICAgcmV0dXJuIGNhY2hlLmtleSArIFwiLVwiICsgc2VyaWFsaXplZC5uYW1lO1xuICB9O1xuXG4gIHZhciBrZXlmcmFtZXMgPSBmdW5jdGlvbiBrZXlmcmFtZXMoKSB7XG4gICAgZm9yICh2YXIgX2xlbjIgPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gbmV3IEFycmF5KF9sZW4yKSwgX2tleTIgPSAwOyBfa2V5MiA8IF9sZW4yOyBfa2V5MisrKSB7XG4gICAgICBhcmdzW19rZXkyXSA9IGFyZ3VtZW50c1tfa2V5Ml07XG4gICAgfVxuXG4gICAgdmFyIHNlcmlhbGl6ZWQgPSBzZXJpYWxpemUuc2VyaWFsaXplU3R5bGVzKGFyZ3MsIGNhY2hlLnJlZ2lzdGVyZWQpO1xuICAgIHZhciBhbmltYXRpb24gPSBcImFuaW1hdGlvbi1cIiArIHNlcmlhbGl6ZWQubmFtZTtcbiAgICBpbnNlcnRXaXRob3V0U2NvcGluZyhjYWNoZSwge1xuICAgICAgbmFtZTogc2VyaWFsaXplZC5uYW1lLFxuICAgICAgc3R5bGVzOiBcIkBrZXlmcmFtZXMgXCIgKyBhbmltYXRpb24gKyBcIntcIiArIHNlcmlhbGl6ZWQuc3R5bGVzICsgXCJ9XCJcbiAgICB9KTtcbiAgICByZXR1cm4gYW5pbWF0aW9uO1xuICB9O1xuXG4gIHZhciBpbmplY3RHbG9iYWwgPSBmdW5jdGlvbiBpbmplY3RHbG9iYWwoKSB7XG4gICAgZm9yICh2YXIgX2xlbjMgPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gbmV3IEFycmF5KF9sZW4zKSwgX2tleTMgPSAwOyBfa2V5MyA8IF9sZW4zOyBfa2V5MysrKSB7XG4gICAgICBhcmdzW19rZXkzXSA9IGFyZ3VtZW50c1tfa2V5M107XG4gICAgfVxuXG4gICAgdmFyIHNlcmlhbGl6ZWQgPSBzZXJpYWxpemUuc2VyaWFsaXplU3R5bGVzKGFyZ3MsIGNhY2hlLnJlZ2lzdGVyZWQpO1xuICAgIGluc2VydFdpdGhvdXRTY29waW5nKGNhY2hlLCBzZXJpYWxpemVkKTtcbiAgfTtcblxuICB2YXIgY3ggPSBmdW5jdGlvbiBjeCgpIHtcbiAgICBmb3IgKHZhciBfbGVuNCA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBuZXcgQXJyYXkoX2xlbjQpLCBfa2V5NCA9IDA7IF9rZXk0IDwgX2xlbjQ7IF9rZXk0KyspIHtcbiAgICAgIGFyZ3NbX2tleTRdID0gYXJndW1lbnRzW19rZXk0XTtcbiAgICB9XG5cbiAgICByZXR1cm4gbWVyZ2UoY2FjaGUucmVnaXN0ZXJlZCwgY3NzLCBjbGFzc25hbWVzKGFyZ3MpKTtcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIGNzczogY3NzLFxuICAgIGN4OiBjeCxcbiAgICBpbmplY3RHbG9iYWw6IGluamVjdEdsb2JhbCxcbiAgICBrZXlmcmFtZXM6IGtleWZyYW1lcyxcbiAgICBoeWRyYXRlOiBmdW5jdGlvbiBoeWRyYXRlKGlkcykge1xuICAgICAgaWRzLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICBjYWNoZS5pbnNlcnRlZFtrZXldID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgZmx1c2g6IGZ1bmN0aW9uIGZsdXNoKCkge1xuICAgICAgY2FjaGUucmVnaXN0ZXJlZCA9IHt9O1xuICAgICAgY2FjaGUuaW5zZXJ0ZWQgPSB7fTtcbiAgICAgIGNhY2hlLnNoZWV0LmZsdXNoKCk7XG4gICAgfSxcbiAgICAvLyAkRmxvd0ZpeE1lXG4gICAgc2hlZXQ6IGNhY2hlLnNoZWV0LFxuICAgIGNhY2hlOiBjYWNoZSxcbiAgICBnZXRSZWdpc3RlcmVkU3R5bGVzOiB1dGlscy5nZXRSZWdpc3RlcmVkU3R5bGVzLmJpbmQobnVsbCwgY2FjaGUucmVnaXN0ZXJlZCksXG4gICAgbWVyZ2U6IG1lcmdlLmJpbmQobnVsbCwgY2FjaGUucmVnaXN0ZXJlZCwgY3NzKVxuICB9O1xufTtcblxudmFyIGNsYXNzbmFtZXMgPSBmdW5jdGlvbiBjbGFzc25hbWVzKGFyZ3MpIHtcbiAgdmFyIGNscyA9ICcnO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBhcmcgPSBhcmdzW2ldO1xuICAgIGlmIChhcmcgPT0gbnVsbCkgY29udGludWU7XG4gICAgdmFyIHRvQWRkID0gdm9pZCAwO1xuXG4gICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgIHtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XG4gICAgICAgICAgICB0b0FkZCA9IGNsYXNzbmFtZXMoYXJnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdG9BZGQgPSAnJztcblxuICAgICAgICAgICAgZm9yICh2YXIgayBpbiBhcmcpIHtcbiAgICAgICAgICAgICAgaWYgKGFyZ1trXSAmJiBrKSB7XG4gICAgICAgICAgICAgICAgdG9BZGQgJiYgKHRvQWRkICs9ICcgJyk7XG4gICAgICAgICAgICAgICAgdG9BZGQgKz0gaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHtcbiAgICAgICAgICB0b0FkZCA9IGFyZztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0b0FkZCkge1xuICAgICAgY2xzICYmIChjbHMgKz0gJyAnKTtcbiAgICAgIGNscyArPSB0b0FkZDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY2xzO1xufTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gY3JlYXRlRW1vdGlvbjtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6ICEwXG59KTtcblxudmFyIGNyZWF0ZUNhY2hlID0gcmVxdWlyZShcIkBlbW90aW9uL2NhY2hlXCIpLCBzZXJpYWxpemUgPSByZXF1aXJlKFwiQGVtb3Rpb24vc2VyaWFsaXplXCIpLCB1dGlscyA9IHJlcXVpcmUoXCJAZW1vdGlvbi91dGlsc1wiKTtcblxuZnVuY3Rpb24gX2ludGVyb3BEZWZhdWx0KGUpIHtcbiAgcmV0dXJuIGUgJiYgZS5fX2VzTW9kdWxlID8gZSA6IHtcbiAgICBkZWZhdWx0OiBlXG4gIH07XG59XG5cbnZhciBjcmVhdGVDYWNoZV9fZGVmYXVsdCA9IF9pbnRlcm9wRGVmYXVsdChjcmVhdGVDYWNoZSk7XG5cbmZ1bmN0aW9uIGluc2VydFdpdGhvdXRTY29waW5nKGNhY2hlLCBzZXJpYWxpemVkKSB7XG4gIGlmICh2b2lkIDAgPT09IGNhY2hlLmluc2VydGVkW3NlcmlhbGl6ZWQubmFtZV0pIHJldHVybiBjYWNoZS5pbnNlcnQoXCJcIiwgc2VyaWFsaXplZCwgY2FjaGUuc2hlZXQsICEwKTtcbn1cblxuZnVuY3Rpb24gbWVyZ2UocmVnaXN0ZXJlZCwgY3NzLCBjbGFzc05hbWUpIHtcbiAgdmFyIHJlZ2lzdGVyZWRTdHlsZXMgPSBbXSwgcmF3Q2xhc3NOYW1lID0gdXRpbHMuZ2V0UmVnaXN0ZXJlZFN0eWxlcyhyZWdpc3RlcmVkLCByZWdpc3RlcmVkU3R5bGVzLCBjbGFzc05hbWUpO1xuICByZXR1cm4gcmVnaXN0ZXJlZFN0eWxlcy5sZW5ndGggPCAyID8gY2xhc3NOYW1lIDogcmF3Q2xhc3NOYW1lICsgY3NzKHJlZ2lzdGVyZWRTdHlsZXMpO1xufVxuXG52YXIgY3JlYXRlRW1vdGlvbiA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgdmFyIGNhY2hlID0gY3JlYXRlQ2FjaGVfX2RlZmF1bHQuZGVmYXVsdChvcHRpb25zKTtcbiAgY2FjaGUuc2hlZXQuc3BlZWR5ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB0aGlzLmlzU3BlZWR5ID0gdmFsdWU7XG4gIH0sIGNhY2hlLmNvbXBhdCA9ICEwO1xuICB2YXIgY3NzID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBuZXcgQXJyYXkoX2xlbiksIF9rZXkgPSAwOyBfa2V5IDwgX2xlbjsgX2tleSsrKSBhcmdzW19rZXldID0gYXJndW1lbnRzW19rZXldO1xuICAgIHZhciBzZXJpYWxpemVkID0gc2VyaWFsaXplLnNlcmlhbGl6ZVN0eWxlcyhhcmdzLCBjYWNoZS5yZWdpc3RlcmVkLCB2b2lkIDApO1xuICAgIHJldHVybiB1dGlscy5pbnNlcnRTdHlsZXMoY2FjaGUsIHNlcmlhbGl6ZWQsICExKSwgY2FjaGUua2V5ICsgXCItXCIgKyBzZXJpYWxpemVkLm5hbWU7XG4gIH07XG4gIHJldHVybiB7XG4gICAgY3NzOiBjc3MsXG4gICAgY3g6IGZ1bmN0aW9uKCkge1xuICAgICAgZm9yICh2YXIgX2xlbjQgPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gbmV3IEFycmF5KF9sZW40KSwgX2tleTQgPSAwOyBfa2V5NCA8IF9sZW40OyBfa2V5NCsrKSBhcmdzW19rZXk0XSA9IGFyZ3VtZW50c1tfa2V5NF07XG4gICAgICByZXR1cm4gbWVyZ2UoY2FjaGUucmVnaXN0ZXJlZCwgY3NzLCBjbGFzc25hbWVzKGFyZ3MpKTtcbiAgICB9LFxuICAgIGluamVjdEdsb2JhbDogZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKHZhciBfbGVuMyA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBuZXcgQXJyYXkoX2xlbjMpLCBfa2V5MyA9IDA7IF9rZXkzIDwgX2xlbjM7IF9rZXkzKyspIGFyZ3NbX2tleTNdID0gYXJndW1lbnRzW19rZXkzXTtcbiAgICAgIHZhciBzZXJpYWxpemVkID0gc2VyaWFsaXplLnNlcmlhbGl6ZVN0eWxlcyhhcmdzLCBjYWNoZS5yZWdpc3RlcmVkKTtcbiAgICAgIGluc2VydFdpdGhvdXRTY29waW5nKGNhY2hlLCBzZXJpYWxpemVkKTtcbiAgICB9LFxuICAgIGtleWZyYW1lczogZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKHZhciBfbGVuMiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBuZXcgQXJyYXkoX2xlbjIpLCBfa2V5MiA9IDA7IF9rZXkyIDwgX2xlbjI7IF9rZXkyKyspIGFyZ3NbX2tleTJdID0gYXJndW1lbnRzW19rZXkyXTtcbiAgICAgIHZhciBzZXJpYWxpemVkID0gc2VyaWFsaXplLnNlcmlhbGl6ZVN0eWxlcyhhcmdzLCBjYWNoZS5yZWdpc3RlcmVkKSwgYW5pbWF0aW9uID0gXCJhbmltYXRpb24tXCIgKyBzZXJpYWxpemVkLm5hbWU7XG4gICAgICByZXR1cm4gaW5zZXJ0V2l0aG91dFNjb3BpbmcoY2FjaGUsIHtcbiAgICAgICAgbmFtZTogc2VyaWFsaXplZC5uYW1lLFxuICAgICAgICBzdHlsZXM6IFwiQGtleWZyYW1lcyBcIiArIGFuaW1hdGlvbiArIFwie1wiICsgc2VyaWFsaXplZC5zdHlsZXMgKyBcIn1cIlxuICAgICAgfSksIGFuaW1hdGlvbjtcbiAgICB9LFxuICAgIGh5ZHJhdGU6IGZ1bmN0aW9uKGlkcykge1xuICAgICAgaWRzLmZvckVhY2goKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICBjYWNoZS5pbnNlcnRlZFtrZXldID0gITA7XG4gICAgICB9KSk7XG4gICAgfSxcbiAgICBmbHVzaDogZnVuY3Rpb24oKSB7XG4gICAgICBjYWNoZS5yZWdpc3RlcmVkID0ge30sIGNhY2hlLmluc2VydGVkID0ge30sIGNhY2hlLnNoZWV0LmZsdXNoKCk7XG4gICAgfSxcbiAgICBzaGVldDogY2FjaGUuc2hlZXQsXG4gICAgY2FjaGU6IGNhY2hlLFxuICAgIGdldFJlZ2lzdGVyZWRTdHlsZXM6IHV0aWxzLmdldFJlZ2lzdGVyZWRTdHlsZXMuYmluZChudWxsLCBjYWNoZS5yZWdpc3RlcmVkKSxcbiAgICBtZXJnZTogbWVyZ2UuYmluZChudWxsLCBjYWNoZS5yZWdpc3RlcmVkLCBjc3MpXG4gIH07XG59LCBjbGFzc25hbWVzID0gZnVuY3Rpb24gY2xhc3NuYW1lcyhhcmdzKSB7XG4gIGZvciAodmFyIGNscyA9IFwiXCIsIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBhcmcgPSBhcmdzW2ldO1xuICAgIGlmIChudWxsICE9IGFyZykge1xuICAgICAgdmFyIHRvQWRkID0gdm9pZCAwO1xuICAgICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHRvQWRkID0gY2xhc3NuYW1lcyhhcmcpOyBlbHNlIGZvciAodmFyIGsgaW4gdG9BZGQgPSBcIlwiLCBcbiAgICAgICAgYXJnKSBhcmdba10gJiYgayAmJiAodG9BZGQgJiYgKHRvQWRkICs9IFwiIFwiKSwgdG9BZGQgKz0gayk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAgZGVmYXVsdDpcbiAgICAgICAgdG9BZGQgPSBhcmc7XG4gICAgICB9XG4gICAgICB0b0FkZCAmJiAoY2xzICYmIChjbHMgKz0gXCIgXCIpLCBjbHMgKz0gdG9BZGQpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY2xzO1xufTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gY3JlYXRlRW1vdGlvbjtcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcblxucmVxdWlyZSgnQGVtb3Rpb24vY2FjaGUnKTtcbnJlcXVpcmUoJ0BlbW90aW9uL3NlcmlhbGl6ZScpO1xucmVxdWlyZSgnQGVtb3Rpb24vdXRpbHMnKTtcbnZhciBjcmVhdGVJbnN0YW5jZV9kaXN0X2Vtb3Rpb25Dc3NDcmVhdGVJbnN0YW5jZSA9IHJlcXVpcmUoJy4uL2NyZWF0ZS1pbnN0YW5jZS9kaXN0L2Vtb3Rpb24tY3NzLWNyZWF0ZS1pbnN0YW5jZS5janMuZGV2LmpzJyk7XG5cbnZhciBfY3JlYXRlRW1vdGlvbiA9IGNyZWF0ZUluc3RhbmNlX2Rpc3RfZW1vdGlvbkNzc0NyZWF0ZUluc3RhbmNlWydkZWZhdWx0J10oe1xuICBrZXk6ICdjc3MnXG59KSxcbiAgICBmbHVzaCA9IF9jcmVhdGVFbW90aW9uLmZsdXNoLFxuICAgIGh5ZHJhdGUgPSBfY3JlYXRlRW1vdGlvbi5oeWRyYXRlLFxuICAgIGN4ID0gX2NyZWF0ZUVtb3Rpb24uY3gsXG4gICAgbWVyZ2UgPSBfY3JlYXRlRW1vdGlvbi5tZXJnZSxcbiAgICBnZXRSZWdpc3RlcmVkU3R5bGVzID0gX2NyZWF0ZUVtb3Rpb24uZ2V0UmVnaXN0ZXJlZFN0eWxlcyxcbiAgICBpbmplY3RHbG9iYWwgPSBfY3JlYXRlRW1vdGlvbi5pbmplY3RHbG9iYWwsXG4gICAga2V5ZnJhbWVzID0gX2NyZWF0ZUVtb3Rpb24ua2V5ZnJhbWVzLFxuICAgIGNzcyA9IF9jcmVhdGVFbW90aW9uLmNzcyxcbiAgICBzaGVldCA9IF9jcmVhdGVFbW90aW9uLnNoZWV0LFxuICAgIGNhY2hlID0gX2NyZWF0ZUVtb3Rpb24uY2FjaGU7XG5cbmV4cG9ydHMuY2FjaGUgPSBjYWNoZTtcbmV4cG9ydHMuY3NzID0gY3NzO1xuZXhwb3J0cy5jeCA9IGN4O1xuZXhwb3J0cy5mbHVzaCA9IGZsdXNoO1xuZXhwb3J0cy5nZXRSZWdpc3RlcmVkU3R5bGVzID0gZ2V0UmVnaXN0ZXJlZFN0eWxlcztcbmV4cG9ydHMuaHlkcmF0ZSA9IGh5ZHJhdGU7XG5leHBvcnRzLmluamVjdEdsb2JhbCA9IGluamVjdEdsb2JhbDtcbmV4cG9ydHMua2V5ZnJhbWVzID0ga2V5ZnJhbWVzO1xuZXhwb3J0cy5tZXJnZSA9IG1lcmdlO1xuZXhwb3J0cy5zaGVldCA9IHNoZWV0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vZW1vdGlvbi1jc3MuY2pzLnByb2QuanNcIik7XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2Vtb3Rpb24tY3NzLmNqcy5kZXYuanNcIik7XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiAhMFxufSksIHJlcXVpcmUoXCJAZW1vdGlvbi9jYWNoZVwiKSwgcmVxdWlyZShcIkBlbW90aW9uL3NlcmlhbGl6ZVwiKSwgcmVxdWlyZShcIkBlbW90aW9uL3V0aWxzXCIpO1xuXG52YXIgY3JlYXRlSW5zdGFuY2VfZGlzdF9lbW90aW9uQ3NzQ3JlYXRlSW5zdGFuY2UgPSByZXF1aXJlKFwiLi4vY3JlYXRlLWluc3RhbmNlL2Rpc3QvZW1vdGlvbi1jc3MtY3JlYXRlLWluc3RhbmNlLmNqcy5wcm9kLmpzXCIpLCBfY3JlYXRlRW1vdGlvbiA9IGNyZWF0ZUluc3RhbmNlX2Rpc3RfZW1vdGlvbkNzc0NyZWF0ZUluc3RhbmNlLmRlZmF1bHQoe1xuICBrZXk6IFwiY3NzXCJcbn0pLCBmbHVzaCA9IF9jcmVhdGVFbW90aW9uLmZsdXNoLCBoeWRyYXRlID0gX2NyZWF0ZUVtb3Rpb24uaHlkcmF0ZSwgY3ggPSBfY3JlYXRlRW1vdGlvbi5jeCwgbWVyZ2UgPSBfY3JlYXRlRW1vdGlvbi5tZXJnZSwgZ2V0UmVnaXN0ZXJlZFN0eWxlcyA9IF9jcmVhdGVFbW90aW9uLmdldFJlZ2lzdGVyZWRTdHlsZXMsIGluamVjdEdsb2JhbCA9IF9jcmVhdGVFbW90aW9uLmluamVjdEdsb2JhbCwga2V5ZnJhbWVzID0gX2NyZWF0ZUVtb3Rpb24ua2V5ZnJhbWVzLCBjc3MgPSBfY3JlYXRlRW1vdGlvbi5jc3MsIHNoZWV0ID0gX2NyZWF0ZUVtb3Rpb24uc2hlZXQsIGNhY2hlID0gX2NyZWF0ZUVtb3Rpb24uY2FjaGU7XG5cbmV4cG9ydHMuY2FjaGUgPSBjYWNoZSwgZXhwb3J0cy5jc3MgPSBjc3MsIGV4cG9ydHMuY3ggPSBjeCwgZXhwb3J0cy5mbHVzaCA9IGZsdXNoLCBcbmV4cG9ydHMuZ2V0UmVnaXN0ZXJlZFN0eWxlcyA9IGdldFJlZ2lzdGVyZWRTdHlsZXMsIGV4cG9ydHMuaHlkcmF0ZSA9IGh5ZHJhdGUsIGV4cG9ydHMuaW5qZWN0R2xvYmFsID0gaW5qZWN0R2xvYmFsLCBcbmV4cG9ydHMua2V5ZnJhbWVzID0ga2V5ZnJhbWVzLCBleHBvcnRzLm1lcmdlID0gbWVyZ2UsIGV4cG9ydHMuc2hlZXQgPSBzaGVldDtcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcblxuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIEluc3BpcmVkIGJ5IGh0dHBzOi8vZ2l0aHViLmNvbS9nYXJ5Y291cnQvbXVybXVyaGFzaC1qc1xuLy8gUG9ydGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2FhcHBsZWJ5L3NtaGFzaGVyL2Jsb2IvNjFhMDUzMGYyODI3N2YyZTg1MGJmYzM5NjAwY2U2MWQwMmI1MThkZS9zcmMvTXVybXVySGFzaDIuY3BwI0wzNy1MODZcbmZ1bmN0aW9uIG11cm11cjIoc3RyKSB7XG4gIC8vICdtJyBhbmQgJ3InIGFyZSBtaXhpbmcgY29uc3RhbnRzIGdlbmVyYXRlZCBvZmZsaW5lLlxuICAvLyBUaGV5J3JlIG5vdCByZWFsbHkgJ21hZ2ljJywgdGhleSBqdXN0IGhhcHBlbiB0byB3b3JrIHdlbGwuXG4gIC8vIGNvbnN0IG0gPSAweDViZDFlOTk1O1xuICAvLyBjb25zdCByID0gMjQ7XG4gIC8vIEluaXRpYWxpemUgdGhlIGhhc2hcbiAgdmFyIGggPSAwOyAvLyBNaXggNCBieXRlcyBhdCBhIHRpbWUgaW50byB0aGUgaGFzaFxuXG4gIHZhciBrLFxuICAgICAgaSA9IDAsXG4gICAgICBsZW4gPSBzdHIubGVuZ3RoO1xuXG4gIGZvciAoOyBsZW4gPj0gNDsgKytpLCBsZW4gLT0gNCkge1xuICAgIGsgPSBzdHIuY2hhckNvZGVBdChpKSAmIDB4ZmYgfCAoc3RyLmNoYXJDb2RlQXQoKytpKSAmIDB4ZmYpIDw8IDggfCAoc3RyLmNoYXJDb2RlQXQoKytpKSAmIDB4ZmYpIDw8IDE2IHwgKHN0ci5jaGFyQ29kZUF0KCsraSkgJiAweGZmKSA8PCAyNDtcbiAgICBrID1cbiAgICAvKiBNYXRoLmltdWwoaywgbSk6ICovXG4gICAgKGsgJiAweGZmZmYpICogMHg1YmQxZTk5NSArICgoayA+Pj4gMTYpICogMHhlOTk1IDw8IDE2KTtcbiAgICBrIF49XG4gICAgLyogayA+Pj4gcjogKi9cbiAgICBrID4+PiAyNDtcbiAgICBoID1cbiAgICAvKiBNYXRoLmltdWwoaywgbSk6ICovXG4gICAgKGsgJiAweGZmZmYpICogMHg1YmQxZTk5NSArICgoayA+Pj4gMTYpICogMHhlOTk1IDw8IDE2KSBeXG4gICAgLyogTWF0aC5pbXVsKGgsIG0pOiAqL1xuICAgIChoICYgMHhmZmZmKSAqIDB4NWJkMWU5OTUgKyAoKGggPj4+IDE2KSAqIDB4ZTk5NSA8PCAxNik7XG4gIH0gLy8gSGFuZGxlIHRoZSBsYXN0IGZldyBieXRlcyBvZiB0aGUgaW5wdXQgYXJyYXlcblxuXG4gIHN3aXRjaCAobGVuKSB7XG4gICAgY2FzZSAzOlxuICAgICAgaCBePSAoc3RyLmNoYXJDb2RlQXQoaSArIDIpICYgMHhmZikgPDwgMTY7XG5cbiAgICBjYXNlIDI6XG4gICAgICBoIF49IChzdHIuY2hhckNvZGVBdChpICsgMSkgJiAweGZmKSA8PCA4O1xuXG4gICAgY2FzZSAxOlxuICAgICAgaCBePSBzdHIuY2hhckNvZGVBdChpKSAmIDB4ZmY7XG4gICAgICBoID1cbiAgICAgIC8qIE1hdGguaW11bChoLCBtKTogKi9cbiAgICAgIChoICYgMHhmZmZmKSAqIDB4NWJkMWU5OTUgKyAoKGggPj4+IDE2KSAqIDB4ZTk5NSA8PCAxNik7XG4gIH0gLy8gRG8gYSBmZXcgZmluYWwgbWl4ZXMgb2YgdGhlIGhhc2ggdG8gZW5zdXJlIHRoZSBsYXN0IGZld1xuICAvLyBieXRlcyBhcmUgd2VsbC1pbmNvcnBvcmF0ZWQuXG5cblxuICBoIF49IGggPj4+IDEzO1xuICBoID1cbiAgLyogTWF0aC5pbXVsKGgsIG0pOiAqL1xuICAoaCAmIDB4ZmZmZikgKiAweDViZDFlOTk1ICsgKChoID4+PiAxNikgKiAweGU5OTUgPDwgMTYpO1xuICByZXR1cm4gKChoIF4gaCA+Pj4gMTUpID4+PiAwKS50b1N0cmluZygzNik7XG59XG5cbmV4cG9ydHMuZGVmYXVsdCA9IG11cm11cjI7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbmZ1bmN0aW9uIG1lbW9pemUoZm4pIHtcbiAgdmFyIGNhY2hlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgcmV0dXJuIGZ1bmN0aW9uIChhcmcpIHtcbiAgICBpZiAoY2FjaGVbYXJnXSA9PT0gdW5kZWZpbmVkKSBjYWNoZVthcmddID0gZm4oYXJnKTtcbiAgICByZXR1cm4gY2FjaGVbYXJnXTtcbiAgfTtcbn1cblxuZXhwb3J0cy5kZWZhdWx0ID0gbWVtb2l6ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcblxudmFyIGhhc2hTdHJpbmcgPSByZXF1aXJlKCdAZW1vdGlvbi9oYXNoJyk7XG52YXIgdW5pdGxlc3MgPSByZXF1aXJlKCdAZW1vdGlvbi91bml0bGVzcycpO1xudmFyIG1lbW9pemUgPSByZXF1aXJlKCdAZW1vdGlvbi9tZW1vaXplJyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wRGVmYXVsdCAoZSkgeyByZXR1cm4gZSAmJiBlLl9fZXNNb2R1bGUgPyBlIDogeyAnZGVmYXVsdCc6IGUgfTsgfVxuXG52YXIgaGFzaFN0cmluZ19fZGVmYXVsdCA9IC8qI19fUFVSRV9fKi9faW50ZXJvcERlZmF1bHQoaGFzaFN0cmluZyk7XG52YXIgdW5pdGxlc3NfX2RlZmF1bHQgPSAvKiNfX1BVUkVfXyovX2ludGVyb3BEZWZhdWx0KHVuaXRsZXNzKTtcbnZhciBtZW1vaXplX19kZWZhdWx0ID0gLyojX19QVVJFX18qL19pbnRlcm9wRGVmYXVsdChtZW1vaXplKTtcblxudmFyIElMTEVHQUxfRVNDQVBFX1NFUVVFTkNFX0VSUk9SID0gXCJZb3UgaGF2ZSBpbGxlZ2FsIGVzY2FwZSBzZXF1ZW5jZSBpbiB5b3VyIHRlbXBsYXRlIGxpdGVyYWwsIG1vc3QgbGlrZWx5IGluc2lkZSBjb250ZW50J3MgcHJvcGVydHkgdmFsdWUuXFxuQmVjYXVzZSB5b3Ugd3JpdGUgeW91ciBDU1MgaW5zaWRlIGEgSmF2YVNjcmlwdCBzdHJpbmcgeW91IGFjdHVhbGx5IGhhdmUgdG8gZG8gZG91YmxlIGVzY2FwaW5nLCBzbyBmb3IgZXhhbXBsZSBcXFwiY29udGVudDogJ1xcXFwwMGQ3JztcXFwiIHNob3VsZCBiZWNvbWUgXFxcImNvbnRlbnQ6ICdcXFxcXFxcXDAwZDcnO1xcXCIuXFxuWW91IGNhbiByZWFkIG1vcmUgYWJvdXQgdGhpcyBoZXJlOlxcbmh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL1RlbXBsYXRlX2xpdGVyYWxzI0VTMjAxOF9yZXZpc2lvbl9vZl9pbGxlZ2FsX2VzY2FwZV9zZXF1ZW5jZXNcIjtcbnZhciBVTkRFRklORURfQVNfT0JKRUNUX0tFWV9FUlJPUiA9IFwiWW91IGhhdmUgcGFzc2VkIGluIGZhbHN5IHZhbHVlIGFzIHN0eWxlIG9iamVjdCdzIGtleSAoY2FuIGhhcHBlbiB3aGVuIGluIGV4YW1wbGUgeW91IHBhc3MgdW5leHBvcnRlZCBjb21wb25lbnQgYXMgY29tcHV0ZWQga2V5KS5cIjtcbnZhciBoeXBoZW5hdGVSZWdleCA9IC9bQS1aXXxebXMvZztcbnZhciBhbmltYXRpb25SZWdleCA9IC9fRU1PXyhbXl9dKz8pXyhbXl0qPylfRU1PXy9nO1xuXG52YXIgaXNDdXN0b21Qcm9wZXJ0eSA9IGZ1bmN0aW9uIGlzQ3VzdG9tUHJvcGVydHkocHJvcGVydHkpIHtcbiAgcmV0dXJuIHByb3BlcnR5LmNoYXJDb2RlQXQoMSkgPT09IDQ1O1xufTtcblxudmFyIGlzUHJvY2Vzc2FibGVWYWx1ZSA9IGZ1bmN0aW9uIGlzUHJvY2Vzc2FibGVWYWx1ZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgIT09ICdib29sZWFuJztcbn07XG5cbnZhciBwcm9jZXNzU3R5bGVOYW1lID0gLyogI19fUFVSRV9fICovbWVtb2l6ZV9fZGVmYXVsdFsnZGVmYXVsdCddKGZ1bmN0aW9uIChzdHlsZU5hbWUpIHtcbiAgcmV0dXJuIGlzQ3VzdG9tUHJvcGVydHkoc3R5bGVOYW1lKSA/IHN0eWxlTmFtZSA6IHN0eWxlTmFtZS5yZXBsYWNlKGh5cGhlbmF0ZVJlZ2V4LCAnLSQmJykudG9Mb3dlckNhc2UoKTtcbn0pO1xuXG52YXIgcHJvY2Vzc1N0eWxlVmFsdWUgPSBmdW5jdGlvbiBwcm9jZXNzU3R5bGVWYWx1ZShrZXksIHZhbHVlKSB7XG4gIHN3aXRjaCAoa2V5KSB7XG4gICAgY2FzZSAnYW5pbWF0aW9uJzpcbiAgICBjYXNlICdhbmltYXRpb25OYW1lJzpcbiAgICAgIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWUucmVwbGFjZShhbmltYXRpb25SZWdleCwgZnVuY3Rpb24gKG1hdGNoLCBwMSwgcDIpIHtcbiAgICAgICAgICAgIGN1cnNvciA9IHtcbiAgICAgICAgICAgICAgbmFtZTogcDEsXG4gICAgICAgICAgICAgIHN0eWxlczogcDIsXG4gICAgICAgICAgICAgIG5leHQ6IGN1cnNvclxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBwMTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICB9XG5cbiAgaWYgKHVuaXRsZXNzX19kZWZhdWx0WydkZWZhdWx0J11ba2V5XSAhPT0gMSAmJiAhaXNDdXN0b21Qcm9wZXJ0eShrZXkpICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgdmFsdWUgIT09IDApIHtcbiAgICByZXR1cm4gdmFsdWUgKyAncHgnO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIGNvbnRlbnRWYWx1ZVBhdHRlcm4gPSAvKGF0dHJ8Y291bnRlcnM/fHVybHwoKChyZXBlYXRpbmctKT8obGluZWFyfHJhZGlhbCkpfGNvbmljKS1ncmFkaWVudClcXCh8KG5vLSk/KG9wZW58Y2xvc2UpLXF1b3RlLztcbiAgdmFyIGNvbnRlbnRWYWx1ZXMgPSBbJ25vcm1hbCcsICdub25lJywgJ2luaXRpYWwnLCAnaW5oZXJpdCcsICd1bnNldCddO1xuICB2YXIgb2xkUHJvY2Vzc1N0eWxlVmFsdWUgPSBwcm9jZXNzU3R5bGVWYWx1ZTtcbiAgdmFyIG1zUGF0dGVybiA9IC9eLW1zLS87XG4gIHZhciBoeXBoZW5QYXR0ZXJuID0gLy0oLikvZztcbiAgdmFyIGh5cGhlbmF0ZWRDYWNoZSA9IHt9O1xuXG4gIHByb2Nlc3NTdHlsZVZhbHVlID0gZnVuY3Rpb24gcHJvY2Vzc1N0eWxlVmFsdWUoa2V5LCB2YWx1ZSkge1xuICAgIGlmIChrZXkgPT09ICdjb250ZW50Jykge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycgfHwgY29udGVudFZhbHVlcy5pbmRleE9mKHZhbHVlKSA9PT0gLTEgJiYgIWNvbnRlbnRWYWx1ZVBhdHRlcm4udGVzdCh2YWx1ZSkgJiYgKHZhbHVlLmNoYXJBdCgwKSAhPT0gdmFsdWUuY2hhckF0KHZhbHVlLmxlbmd0aCAtIDEpIHx8IHZhbHVlLmNoYXJBdCgwKSAhPT0gJ1wiJyAmJiB2YWx1ZS5jaGFyQXQoMCkgIT09IFwiJ1wiKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJZb3Ugc2VlbSB0byBiZSB1c2luZyBhIHZhbHVlIGZvciAnY29udGVudCcgd2l0aG91dCBxdW90ZXMsIHRyeSByZXBsYWNpbmcgaXQgd2l0aCBgY29udGVudDogJ1xcXCJcIiArIHZhbHVlICsgXCJcXFwiJ2BcIik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHByb2Nlc3NlZCA9IG9sZFByb2Nlc3NTdHlsZVZhbHVlKGtleSwgdmFsdWUpO1xuXG4gICAgaWYgKHByb2Nlc3NlZCAhPT0gJycgJiYgIWlzQ3VzdG9tUHJvcGVydHkoa2V5KSAmJiBrZXkuaW5kZXhPZignLScpICE9PSAtMSAmJiBoeXBoZW5hdGVkQ2FjaGVba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBoeXBoZW5hdGVkQ2FjaGVba2V5XSA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKFwiVXNpbmcga2ViYWItY2FzZSBmb3IgY3NzIHByb3BlcnRpZXMgaW4gb2JqZWN0cyBpcyBub3Qgc3VwcG9ydGVkLiBEaWQgeW91IG1lYW4gXCIgKyBrZXkucmVwbGFjZShtc1BhdHRlcm4sICdtcy0nKS5yZXBsYWNlKGh5cGhlblBhdHRlcm4sIGZ1bmN0aW9uIChzdHIsIF9jaGFyKSB7XG4gICAgICAgIHJldHVybiBfY2hhci50b1VwcGVyQ2FzZSgpO1xuICAgICAgfSkgKyBcIj9cIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb2Nlc3NlZDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlSW50ZXJwb2xhdGlvbihtZXJnZWRQcm9wcywgcmVnaXN0ZXJlZCwgaW50ZXJwb2xhdGlvbikge1xuICBpZiAoaW50ZXJwb2xhdGlvbiA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgaWYgKGludGVycG9sYXRpb24uX19lbW90aW9uX3N0eWxlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgaW50ZXJwb2xhdGlvbi50b1N0cmluZygpID09PSAnTk9fQ09NUE9ORU5UX1NFTEVDVE9SJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21wb25lbnQgc2VsZWN0b3JzIGNhbiBvbmx5IGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBAZW1vdGlvbi9iYWJlbC1wbHVnaW4uJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGludGVycG9sYXRpb247XG4gIH1cblxuICBzd2l0Y2ggKHR5cGVvZiBpbnRlcnBvbGF0aW9uKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICAgIH1cblxuICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICB7XG4gICAgICAgIGlmIChpbnRlcnBvbGF0aW9uLmFuaW0gPT09IDEpIHtcbiAgICAgICAgICBjdXJzb3IgPSB7XG4gICAgICAgICAgICBuYW1lOiBpbnRlcnBvbGF0aW9uLm5hbWUsXG4gICAgICAgICAgICBzdHlsZXM6IGludGVycG9sYXRpb24uc3R5bGVzLFxuICAgICAgICAgICAgbmV4dDogY3Vyc29yXG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXR1cm4gaW50ZXJwb2xhdGlvbi5uYW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGludGVycG9sYXRpb24uc3R5bGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB2YXIgbmV4dCA9IGludGVycG9sYXRpb24ubmV4dDtcblxuICAgICAgICAgIGlmIChuZXh0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIG5vdCB0aGUgbW9zdCBlZmZpY2llbnQgdGhpbmcgZXZlciBidXQgdGhpcyBpcyBhIHByZXR0eSByYXJlIGNhc2VcbiAgICAgICAgICAgIC8vIGFuZCB0aGVyZSB3aWxsIGJlIHZlcnkgZmV3IGl0ZXJhdGlvbnMgb2YgdGhpcyBnZW5lcmFsbHlcbiAgICAgICAgICAgIHdoaWxlIChuZXh0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY3Vyc29yID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IG5leHQubmFtZSxcbiAgICAgICAgICAgICAgICBzdHlsZXM6IG5leHQuc3R5bGVzLFxuICAgICAgICAgICAgICAgIG5leHQ6IGN1cnNvclxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBuZXh0ID0gbmV4dC5uZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBzdHlsZXMgPSBpbnRlcnBvbGF0aW9uLnN0eWxlcyArIFwiO1wiO1xuXG4gICAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgaW50ZXJwb2xhdGlvbi5tYXAgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3R5bGVzICs9IGludGVycG9sYXRpb24ubWFwO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBzdHlsZXM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3JlYXRlU3RyaW5nRnJvbU9iamVjdChtZXJnZWRQcm9wcywgcmVnaXN0ZXJlZCwgaW50ZXJwb2xhdGlvbik7XG4gICAgICB9XG5cbiAgICBjYXNlICdmdW5jdGlvbic6XG4gICAgICB7XG4gICAgICAgIGlmIChtZXJnZWRQcm9wcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFyIHByZXZpb3VzQ3Vyc29yID0gY3Vyc29yO1xuICAgICAgICAgIHZhciByZXN1bHQgPSBpbnRlcnBvbGF0aW9uKG1lcmdlZFByb3BzKTtcbiAgICAgICAgICBjdXJzb3IgPSBwcmV2aW91c0N1cnNvcjtcbiAgICAgICAgICByZXR1cm4gaGFuZGxlSW50ZXJwb2xhdGlvbihtZXJnZWRQcm9wcywgcmVnaXN0ZXJlZCwgcmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignRnVuY3Rpb25zIHRoYXQgYXJlIGludGVycG9sYXRlZCBpbiBjc3MgY2FsbHMgd2lsbCBiZSBzdHJpbmdpZmllZC5cXG4nICsgJ0lmIHlvdSB3YW50IHRvIGhhdmUgYSBjc3MgY2FsbCBiYXNlZCBvbiBwcm9wcywgY3JlYXRlIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgY3NzIGNhbGwgbGlrZSB0aGlzXFxuJyArICdsZXQgZHluYW1pY1N0eWxlID0gKHByb3BzKSA9PiBjc3NgY29sb3I6ICR7cHJvcHMuY29sb3J9YFxcbicgKyAnSXQgY2FuIGJlIGNhbGxlZCBkaXJlY3RseSB3aXRoIHByb3BzIG9yIGludGVycG9sYXRlZCBpbiBhIHN0eWxlZCBjYWxsIGxpa2UgdGhpc1xcbicgKyBcImxldCBTb21lQ29tcG9uZW50ID0gc3R5bGVkKCdkaXYnKWAke2R5bmFtaWNTdHlsZX1gXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgdmFyIG1hdGNoZWQgPSBbXTtcbiAgICAgICAgdmFyIHJlcGxhY2VkID0gaW50ZXJwb2xhdGlvbi5yZXBsYWNlKGFuaW1hdGlvblJlZ2V4LCBmdW5jdGlvbiAobWF0Y2gsIHAxLCBwMikge1xuICAgICAgICAgIHZhciBmYWtlVmFyTmFtZSA9IFwiYW5pbWF0aW9uXCIgKyBtYXRjaGVkLmxlbmd0aDtcbiAgICAgICAgICBtYXRjaGVkLnB1c2goXCJjb25zdCBcIiArIGZha2VWYXJOYW1lICsgXCIgPSBrZXlmcmFtZXNgXCIgKyBwMi5yZXBsYWNlKC9eQGtleWZyYW1lcyBhbmltYXRpb24tXFx3Ky8sICcnKSArIFwiYFwiKTtcbiAgICAgICAgICByZXR1cm4gXCIke1wiICsgZmFrZVZhck5hbWUgKyBcIn1cIjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKG1hdGNoZWQubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignYGtleWZyYW1lc2Agb3V0cHV0IGdvdCBpbnRlcnBvbGF0ZWQgaW50byBwbGFpbiBzdHJpbmcsIHBsZWFzZSB3cmFwIGl0IHdpdGggYGNzc2AuXFxuXFxuJyArICdJbnN0ZWFkIG9mIGRvaW5nIHRoaXM6XFxuXFxuJyArIFtdLmNvbmNhdChtYXRjaGVkLCBbXCJgXCIgKyByZXBsYWNlZCArIFwiYFwiXSkuam9pbignXFxuJykgKyAnXFxuXFxuWW91IHNob3VsZCB3cmFwIGl0IHdpdGggYGNzc2AgbGlrZSB0aGlzOlxcblxcbicgKyAoXCJjc3NgXCIgKyByZXBsYWNlZCArIFwiYFwiKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgYnJlYWs7XG4gIH0gLy8gZmluYWxpemUgc3RyaW5nIHZhbHVlcyAocmVndWxhciBzdHJpbmdzIGFuZCBmdW5jdGlvbnMgaW50ZXJwb2xhdGVkIGludG8gY3NzIGNhbGxzKVxuXG5cbiAgaWYgKHJlZ2lzdGVyZWQgPT0gbnVsbCkge1xuICAgIHJldHVybiBpbnRlcnBvbGF0aW9uO1xuICB9XG5cbiAgdmFyIGNhY2hlZCA9IHJlZ2lzdGVyZWRbaW50ZXJwb2xhdGlvbl07XG4gIHJldHVybiBjYWNoZWQgIT09IHVuZGVmaW5lZCA/IGNhY2hlZCA6IGludGVycG9sYXRpb247XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVN0cmluZ0Zyb21PYmplY3QobWVyZ2VkUHJvcHMsIHJlZ2lzdGVyZWQsIG9iaikge1xuICB2YXIgc3RyaW5nID0gJyc7XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzdHJpbmcgKz0gaGFuZGxlSW50ZXJwb2xhdGlvbihtZXJnZWRQcm9wcywgcmVnaXN0ZXJlZCwgb2JqW2ldKSArIFwiO1wiO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmb3IgKHZhciBfa2V5IGluIG9iaikge1xuICAgICAgdmFyIHZhbHVlID0gb2JqW19rZXldO1xuXG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAocmVnaXN0ZXJlZCAhPSBudWxsICYmIHJlZ2lzdGVyZWRbdmFsdWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBzdHJpbmcgKz0gX2tleSArIFwie1wiICsgcmVnaXN0ZXJlZFt2YWx1ZV0gKyBcIn1cIjtcbiAgICAgICAgfSBlbHNlIGlmIChpc1Byb2Nlc3NhYmxlVmFsdWUodmFsdWUpKSB7XG4gICAgICAgICAgc3RyaW5nICs9IHByb2Nlc3NTdHlsZU5hbWUoX2tleSkgKyBcIjpcIiArIHByb2Nlc3NTdHlsZVZhbHVlKF9rZXksIHZhbHVlKSArIFwiO1wiO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoX2tleSA9PT0gJ05PX0NPTVBPTkVOVF9TRUxFQ1RPUicgJiYgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29tcG9uZW50IHNlbGVjdG9ycyBjYW4gb25seSBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggQGVtb3Rpb24vYmFiZWwtcGx1Z2luLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIHR5cGVvZiB2YWx1ZVswXSA9PT0gJ3N0cmluZycgJiYgKHJlZ2lzdGVyZWQgPT0gbnVsbCB8fCByZWdpc3RlcmVkW3ZhbHVlWzBdXSA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCB2YWx1ZS5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgIGlmIChpc1Byb2Nlc3NhYmxlVmFsdWUodmFsdWVbX2ldKSkge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gcHJvY2Vzc1N0eWxlTmFtZShfa2V5KSArIFwiOlwiICsgcHJvY2Vzc1N0eWxlVmFsdWUoX2tleSwgdmFsdWVbX2ldKSArIFwiO1wiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgaW50ZXJwb2xhdGVkID0gaGFuZGxlSW50ZXJwb2xhdGlvbihtZXJnZWRQcm9wcywgcmVnaXN0ZXJlZCwgdmFsdWUpO1xuXG4gICAgICAgICAgc3dpdGNoIChfa2V5KSB7XG4gICAgICAgICAgICBjYXNlICdhbmltYXRpb24nOlxuICAgICAgICAgICAgY2FzZSAnYW5pbWF0aW9uTmFtZSc6XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBzdHJpbmcgKz0gcHJvY2Vzc1N0eWxlTmFtZShfa2V5KSArIFwiOlwiICsgaW50ZXJwb2xhdGVkICsgXCI7XCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIF9rZXkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFVOREVGSU5FRF9BU19PQkpFQ1RfS0VZX0VSUk9SKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzdHJpbmcgKz0gX2tleSArIFwie1wiICsgaW50ZXJwb2xhdGVkICsgXCJ9XCI7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gc3RyaW5nO1xufVxuXG52YXIgbGFiZWxQYXR0ZXJuID0gL2xhYmVsOlxccyooW15cXHM7XFxue10rKVxccyooO3wkKS9nO1xudmFyIHNvdXJjZU1hcFBhdHRlcm47XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHNvdXJjZU1hcFBhdHRlcm4gPSAvXFwvXFwqI1xcc3NvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvblxcL2pzb247XFxTK1xccytcXCpcXC8vZztcbn0gLy8gdGhpcyBpcyB0aGUgY3Vyc29yIGZvciBrZXlmcmFtZXNcbi8vIGtleWZyYW1lcyBhcmUgc3RvcmVkIG9uIHRoZSBTZXJpYWxpemVkU3R5bGVzIG9iamVjdCBhcyBhIGxpbmtlZCBsaXN0XG5cblxudmFyIGN1cnNvcjtcbnZhciBzZXJpYWxpemVTdHlsZXMgPSBmdW5jdGlvbiBzZXJpYWxpemVTdHlsZXMoYXJncywgcmVnaXN0ZXJlZCwgbWVyZ2VkUHJvcHMpIHtcbiAgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdID09PSAnb2JqZWN0JyAmJiBhcmdzWzBdICE9PSBudWxsICYmIGFyZ3NbMF0uc3R5bGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gYXJnc1swXTtcbiAgfVxuXG4gIHZhciBzdHJpbmdNb2RlID0gdHJ1ZTtcbiAgdmFyIHN0eWxlcyA9ICcnO1xuICBjdXJzb3IgPSB1bmRlZmluZWQ7XG4gIHZhciBzdHJpbmdzID0gYXJnc1swXTtcblxuICBpZiAoc3RyaW5ncyA9PSBudWxsIHx8IHN0cmluZ3MucmF3ID09PSB1bmRlZmluZWQpIHtcbiAgICBzdHJpbmdNb2RlID0gZmFsc2U7XG4gICAgc3R5bGVzICs9IGhhbmRsZUludGVycG9sYXRpb24obWVyZ2VkUHJvcHMsIHJlZ2lzdGVyZWQsIHN0cmluZ3MpO1xuICB9IGVsc2Uge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHN0cmluZ3NbMF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc29sZS5lcnJvcihJTExFR0FMX0VTQ0FQRV9TRVFVRU5DRV9FUlJPUik7XG4gICAgfVxuXG4gICAgc3R5bGVzICs9IHN0cmluZ3NbMF07XG4gIH0gLy8gd2Ugc3RhcnQgYXQgMSBzaW5jZSB3ZSd2ZSBhbHJlYWR5IGhhbmRsZWQgdGhlIGZpcnN0IGFyZ1xuXG5cbiAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgc3R5bGVzICs9IGhhbmRsZUludGVycG9sYXRpb24obWVyZ2VkUHJvcHMsIHJlZ2lzdGVyZWQsIGFyZ3NbaV0pO1xuXG4gICAgaWYgKHN0cmluZ01vZGUpIHtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHN0cmluZ3NbaV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKElMTEVHQUxfRVNDQVBFX1NFUVVFTkNFX0VSUk9SKTtcbiAgICAgIH1cblxuICAgICAgc3R5bGVzICs9IHN0cmluZ3NbaV07XG4gICAgfVxuICB9XG5cbiAgdmFyIHNvdXJjZU1hcDtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIHN0eWxlcyA9IHN0eWxlcy5yZXBsYWNlKHNvdXJjZU1hcFBhdHRlcm4sIGZ1bmN0aW9uIChtYXRjaCkge1xuICAgICAgc291cmNlTWFwID0gbWF0Y2g7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfSk7XG4gIH0gLy8gdXNpbmcgYSBnbG9iYWwgcmVnZXggd2l0aCAuZXhlYyBpcyBzdGF0ZWZ1bCBzbyBsYXN0SW5kZXggaGFzIHRvIGJlIHJlc2V0IGVhY2ggdGltZVxuXG5cbiAgbGFiZWxQYXR0ZXJuLmxhc3RJbmRleCA9IDA7XG4gIHZhciBpZGVudGlmaWVyTmFtZSA9ICcnO1xuICB2YXIgbWF0Y2g7IC8vIGh0dHBzOi8vZXNiZW5jaC5jb20vYmVuY2gvNWI4MDljMmNmMjk0OTgwMGEwZjYxZmI1XG5cbiAgd2hpbGUgKChtYXRjaCA9IGxhYmVsUGF0dGVybi5leGVjKHN0eWxlcykpICE9PSBudWxsKSB7XG4gICAgaWRlbnRpZmllck5hbWUgKz0gJy0nICsgLy8gJEZsb3dGaXhNZSB3ZSBrbm93IGl0J3Mgbm90IG51bGxcbiAgICBtYXRjaFsxXTtcbiAgfVxuXG4gIHZhciBuYW1lID0gaGFzaFN0cmluZ19fZGVmYXVsdFsnZGVmYXVsdCddKHN0eWxlcykgKyBpZGVudGlmaWVyTmFtZTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIC8vICRGbG93Rml4TWUgU2VyaWFsaXplZFN0eWxlcyB0eXBlIGRvZXNuJ3QgaGF2ZSB0b1N0cmluZyBwcm9wZXJ0eSAoYW5kIHdlIGRvbid0IHdhbnQgdG8gYWRkIGl0KVxuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiBuYW1lLFxuICAgICAgc3R5bGVzOiBzdHlsZXMsXG4gICAgICBtYXA6IHNvdXJjZU1hcCxcbiAgICAgIG5leHQ6IGN1cnNvcixcbiAgICAgIHRvU3RyaW5nOiBmdW5jdGlvbiB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIFwiWW91IGhhdmUgdHJpZWQgdG8gc3RyaW5naWZ5IG9iamVjdCByZXR1cm5lZCBmcm9tIGBjc3NgIGZ1bmN0aW9uLiBJdCBpc24ndCBzdXBwb3NlZCB0byBiZSB1c2VkIGRpcmVjdGx5IChlLmcuIGFzIHZhbHVlIG9mIHRoZSBgY2xhc3NOYW1lYCBwcm9wKSwgYnV0IHJhdGhlciBoYW5kZWQgdG8gZW1vdGlvbiBzbyBpdCBjYW4gaGFuZGxlIGl0IChlLmcuIGFzIHZhbHVlIG9mIGBjc3NgIHByb3ApLlwiO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5hbWU6IG5hbWUsXG4gICAgc3R5bGVzOiBzdHlsZXMsXG4gICAgbmV4dDogY3Vyc29yXG4gIH07XG59O1xuXG5leHBvcnRzLnNlcmlhbGl6ZVN0eWxlcyA9IHNlcmlhbGl6ZVN0eWxlcztcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcblxuLypcblxuQmFzZWQgb2ZmIGdsYW1vcidzIFN0eWxlU2hlZXQsIHRoYW5rcyBTdW5pbCDinaTvuI9cblxuaGlnaCBwZXJmb3JtYW5jZSBTdHlsZVNoZWV0IGZvciBjc3MtaW4tanMgc3lzdGVtc1xuXG4tIHVzZXMgbXVsdGlwbGUgc3R5bGUgdGFncyBiZWhpbmQgdGhlIHNjZW5lcyBmb3IgbWlsbGlvbnMgb2YgcnVsZXNcbi0gdXNlcyBgaW5zZXJ0UnVsZWAgZm9yIGFwcGVuZGluZyBpbiBwcm9kdWN0aW9uIGZvciAqbXVjaCogZmFzdGVyIHBlcmZvcm1hbmNlXG5cbi8vIHVzYWdlXG5cbmltcG9ydCB7IFN0eWxlU2hlZXQgfSBmcm9tICdAZW1vdGlvbi9zaGVldCdcblxubGV0IHN0eWxlU2hlZXQgPSBuZXcgU3R5bGVTaGVldCh7IGtleTogJycsIGNvbnRhaW5lcjogZG9jdW1lbnQuaGVhZCB9KVxuXG5zdHlsZVNoZWV0Lmluc2VydCgnI2JveCB7IGJvcmRlcjogMXB4IHNvbGlkIHJlZDsgfScpXG4tIGFwcGVuZHMgYSBjc3MgcnVsZSBpbnRvIHRoZSBzdHlsZXNoZWV0XG5cbnN0eWxlU2hlZXQuZmx1c2goKVxuLSBlbXB0aWVzIHRoZSBzdHlsZXNoZWV0IG9mIGFsbCBpdHMgY29udGVudHNcblxuKi9cbi8vICRGbG93Rml4TWVcbmZ1bmN0aW9uIHNoZWV0Rm9yVGFnKHRhZykge1xuICBpZiAodGFnLnNoZWV0KSB7XG4gICAgLy8gJEZsb3dGaXhNZVxuICAgIHJldHVybiB0YWcuc2hlZXQ7XG4gIH0gLy8gdGhpcyB3ZWlyZG5lc3MgYnJvdWdodCB0byB5b3UgYnkgZmlyZWZveFxuXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGRvY3VtZW50LnN0eWxlU2hlZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGRvY3VtZW50LnN0eWxlU2hlZXRzW2ldLm93bmVyTm9kZSA9PT0gdGFnKSB7XG4gICAgICAvLyAkRmxvd0ZpeE1lXG4gICAgICByZXR1cm4gZG9jdW1lbnQuc3R5bGVTaGVldHNbaV07XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVN0eWxlRWxlbWVudChvcHRpb25zKSB7XG4gIHZhciB0YWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICB0YWcuc2V0QXR0cmlidXRlKCdkYXRhLWVtb3Rpb24nLCBvcHRpb25zLmtleSk7XG5cbiAgaWYgKG9wdGlvbnMubm9uY2UgIT09IHVuZGVmaW5lZCkge1xuICAgIHRhZy5zZXRBdHRyaWJ1dGUoJ25vbmNlJywgb3B0aW9ucy5ub25jZSk7XG4gIH1cblxuICB0YWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpKTtcbiAgdGFnLnNldEF0dHJpYnV0ZSgnZGF0YS1zJywgJycpO1xuICByZXR1cm4gdGFnO1xufVxuXG52YXIgU3R5bGVTaGVldCA9IC8qI19fUFVSRV9fKi9mdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIFN0eWxlU2hlZXQob3B0aW9ucykge1xuICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICB0aGlzLl9pbnNlcnRUYWcgPSBmdW5jdGlvbiAodGFnKSB7XG4gICAgICB2YXIgYmVmb3JlO1xuXG4gICAgICBpZiAoX3RoaXMudGFncy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgaWYgKF90aGlzLmluc2VydGlvblBvaW50KSB7XG4gICAgICAgICAgYmVmb3JlID0gX3RoaXMuaW5zZXJ0aW9uUG9pbnQubmV4dFNpYmxpbmc7XG4gICAgICAgIH0gZWxzZSBpZiAoX3RoaXMucHJlcGVuZCkge1xuICAgICAgICAgIGJlZm9yZSA9IF90aGlzLmNvbnRhaW5lci5maXJzdENoaWxkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJlZm9yZSA9IF90aGlzLmJlZm9yZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmVmb3JlID0gX3RoaXMudGFnc1tfdGhpcy50YWdzLmxlbmd0aCAtIDFdLm5leHRTaWJsaW5nO1xuICAgICAgfVxuXG4gICAgICBfdGhpcy5jb250YWluZXIuaW5zZXJ0QmVmb3JlKHRhZywgYmVmb3JlKTtcblxuICAgICAgX3RoaXMudGFncy5wdXNoKHRhZyk7XG4gICAgfTtcblxuICAgIHRoaXMuaXNTcGVlZHkgPSBvcHRpb25zLnNwZWVkeSA9PT0gdW5kZWZpbmVkID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJyA6IG9wdGlvbnMuc3BlZWR5O1xuICAgIHRoaXMudGFncyA9IFtdO1xuICAgIHRoaXMuY3RyID0gMDtcbiAgICB0aGlzLm5vbmNlID0gb3B0aW9ucy5ub25jZTsgLy8ga2V5IGlzIHRoZSB2YWx1ZSBvZiB0aGUgZGF0YS1lbW90aW9uIGF0dHJpYnV0ZSwgaXQncyB1c2VkIHRvIGlkZW50aWZ5IGRpZmZlcmVudCBzaGVldHNcblxuICAgIHRoaXMua2V5ID0gb3B0aW9ucy5rZXk7XG4gICAgdGhpcy5jb250YWluZXIgPSBvcHRpb25zLmNvbnRhaW5lcjtcbiAgICB0aGlzLnByZXBlbmQgPSBvcHRpb25zLnByZXBlbmQ7XG4gICAgdGhpcy5pbnNlcnRpb25Qb2ludCA9IG9wdGlvbnMuaW5zZXJ0aW9uUG9pbnQ7XG4gICAgdGhpcy5iZWZvcmUgPSBudWxsO1xuICB9XG5cbiAgdmFyIF9wcm90byA9IFN0eWxlU2hlZXQucHJvdG90eXBlO1xuXG4gIF9wcm90by5oeWRyYXRlID0gZnVuY3Rpb24gaHlkcmF0ZShub2Rlcykge1xuICAgIG5vZGVzLmZvckVhY2godGhpcy5faW5zZXJ0VGFnKTtcbiAgfTtcblxuICBfcHJvdG8uaW5zZXJ0ID0gZnVuY3Rpb24gaW5zZXJ0KHJ1bGUpIHtcbiAgICAvLyB0aGUgbWF4IGxlbmd0aCBpcyBob3cgbWFueSBydWxlcyB3ZSBoYXZlIHBlciBzdHlsZSB0YWcsIGl0J3MgNjUwMDAgaW4gc3BlZWR5IG1vZGVcbiAgICAvLyBpdCdzIDEgaW4gZGV2IGJlY2F1c2Ugd2UgaW5zZXJ0IHNvdXJjZSBtYXBzIHRoYXQgbWFwIGEgc2luZ2xlIHJ1bGUgdG8gYSBsb2NhdGlvblxuICAgIC8vIGFuZCB5b3UgY2FuIG9ubHkgaGF2ZSBvbmUgc291cmNlIG1hcCBwZXIgc3R5bGUgdGFnXG4gICAgaWYgKHRoaXMuY3RyICUgKHRoaXMuaXNTcGVlZHkgPyA2NTAwMCA6IDEpID09PSAwKSB7XG4gICAgICB0aGlzLl9pbnNlcnRUYWcoY3JlYXRlU3R5bGVFbGVtZW50KHRoaXMpKTtcbiAgICB9XG5cbiAgICB2YXIgdGFnID0gdGhpcy50YWdzW3RoaXMudGFncy5sZW5ndGggLSAxXTtcblxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICB2YXIgaXNJbXBvcnRSdWxlID0gcnVsZS5jaGFyQ29kZUF0KDApID09PSA2NCAmJiBydWxlLmNoYXJDb2RlQXQoMSkgPT09IDEwNTtcblxuICAgICAgaWYgKGlzSW1wb3J0UnVsZSAmJiB0aGlzLl9hbHJlYWR5SW5zZXJ0ZWRPcmRlckluc2Vuc2l0aXZlUnVsZSkge1xuICAgICAgICAvLyB0aGlzIHdvdWxkIG9ubHkgY2F1c2UgcHJvYmxlbSBpbiBzcGVlZHkgbW9kZVxuICAgICAgICAvLyBidXQgd2UgZG9uJ3Qgd2FudCBlbmFibGluZyBzcGVlZHkgdG8gYWZmZWN0IHRoZSBvYnNlcnZhYmxlIGJlaGF2aW9yXG4gICAgICAgIC8vIHNvIHdlIHJlcG9ydCB0aGlzIGVycm9yIGF0IGFsbCB0aW1lc1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiWW91J3JlIGF0dGVtcHRpbmcgdG8gaW5zZXJ0IHRoZSBmb2xsb3dpbmcgcnVsZTpcXG5cIiArIHJ1bGUgKyAnXFxuXFxuYEBpbXBvcnRgIHJ1bGVzIG11c3QgYmUgYmVmb3JlIGFsbCBvdGhlciB0eXBlcyBvZiBydWxlcyBpbiBhIHN0eWxlc2hlZXQgYnV0IG90aGVyIHJ1bGVzIGhhdmUgYWxyZWFkeSBiZWVuIGluc2VydGVkLiBQbGVhc2UgZW5zdXJlIHRoYXQgYEBpbXBvcnRgIHJ1bGVzIGFyZSBiZWZvcmUgYWxsIG90aGVyIHJ1bGVzLicpO1xuICAgICAgfVxuICAgICAgdGhpcy5fYWxyZWFkeUluc2VydGVkT3JkZXJJbnNlbnNpdGl2ZVJ1bGUgPSB0aGlzLl9hbHJlYWR5SW5zZXJ0ZWRPcmRlckluc2Vuc2l0aXZlUnVsZSB8fCAhaXNJbXBvcnRSdWxlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmlzU3BlZWR5KSB7XG4gICAgICB2YXIgc2hlZXQgPSBzaGVldEZvclRhZyh0YWcpO1xuXG4gICAgICB0cnkge1xuICAgICAgICAvLyB0aGlzIGlzIHRoZSB1bHRyYWZhc3QgdmVyc2lvbiwgd29ya3MgYWNyb3NzIGJyb3dzZXJzXG4gICAgICAgIC8vIHRoZSBiaWcgZHJhd2JhY2sgaXMgdGhhdCB0aGUgY3NzIHdvbid0IGJlIGVkaXRhYmxlIGluIGRldnRvb2xzXG4gICAgICAgIHNoZWV0Lmluc2VydFJ1bGUocnVsZSwgc2hlZXQuY3NzUnVsZXMubGVuZ3RoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgIS86KC1tb3otcGxhY2Vob2xkZXJ8LW1vei1mb2N1cy1pbm5lcnwtbW96LWZvY3VzcmluZ3wtbXMtaW5wdXQtcGxhY2Vob2xkZXJ8LW1vei1yZWFkLXdyaXRlfC1tb3otcmVhZC1vbmx5fC1tcy1jbGVhcil7Ly50ZXN0KHJ1bGUpKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIlRoZXJlIHdhcyBhIHByb2JsZW0gaW5zZXJ0aW5nIHRoZSBmb2xsb3dpbmcgcnVsZTogXFxcIlwiICsgcnVsZSArIFwiXFxcIlwiLCBlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0YWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUocnVsZSkpO1xuICAgIH1cblxuICAgIHRoaXMuY3RyKys7XG4gIH07XG5cbiAgX3Byb3RvLmZsdXNoID0gZnVuY3Rpb24gZmx1c2goKSB7XG4gICAgLy8gJEZsb3dGaXhNZVxuICAgIHRoaXMudGFncy5mb3JFYWNoKGZ1bmN0aW9uICh0YWcpIHtcbiAgICAgIHJldHVybiB0YWcucGFyZW50Tm9kZSAmJiB0YWcucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0YWcpO1xuICAgIH0pO1xuICAgIHRoaXMudGFncyA9IFtdO1xuICAgIHRoaXMuY3RyID0gMDtcblxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICB0aGlzLl9hbHJlYWR5SW5zZXJ0ZWRPcmRlckluc2Vuc2l0aXZlUnVsZSA9IGZhbHNlO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gU3R5bGVTaGVldDtcbn0oKTtcblxuZXhwb3J0cy5TdHlsZVNoZWV0ID0gU3R5bGVTaGVldDtcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcblxudmFyIHVuaXRsZXNzS2V5cyA9IHtcbiAgYW5pbWF0aW9uSXRlcmF0aW9uQ291bnQ6IDEsXG4gIGJvcmRlckltYWdlT3V0c2V0OiAxLFxuICBib3JkZXJJbWFnZVNsaWNlOiAxLFxuICBib3JkZXJJbWFnZVdpZHRoOiAxLFxuICBib3hGbGV4OiAxLFxuICBib3hGbGV4R3JvdXA6IDEsXG4gIGJveE9yZGluYWxHcm91cDogMSxcbiAgY29sdW1uQ291bnQ6IDEsXG4gIGNvbHVtbnM6IDEsXG4gIGZsZXg6IDEsXG4gIGZsZXhHcm93OiAxLFxuICBmbGV4UG9zaXRpdmU6IDEsXG4gIGZsZXhTaHJpbms6IDEsXG4gIGZsZXhOZWdhdGl2ZTogMSxcbiAgZmxleE9yZGVyOiAxLFxuICBncmlkUm93OiAxLFxuICBncmlkUm93RW5kOiAxLFxuICBncmlkUm93U3BhbjogMSxcbiAgZ3JpZFJvd1N0YXJ0OiAxLFxuICBncmlkQ29sdW1uOiAxLFxuICBncmlkQ29sdW1uRW5kOiAxLFxuICBncmlkQ29sdW1uU3BhbjogMSxcbiAgZ3JpZENvbHVtblN0YXJ0OiAxLFxuICBtc0dyaWRSb3c6IDEsXG4gIG1zR3JpZFJvd1NwYW46IDEsXG4gIG1zR3JpZENvbHVtbjogMSxcbiAgbXNHcmlkQ29sdW1uU3BhbjogMSxcbiAgZm9udFdlaWdodDogMSxcbiAgbGluZUhlaWdodDogMSxcbiAgb3BhY2l0eTogMSxcbiAgb3JkZXI6IDEsXG4gIG9ycGhhbnM6IDEsXG4gIHRhYlNpemU6IDEsXG4gIHdpZG93czogMSxcbiAgekluZGV4OiAxLFxuICB6b29tOiAxLFxuICBXZWJraXRMaW5lQ2xhbXA6IDEsXG4gIC8vIFNWRy1yZWxhdGVkIHByb3BlcnRpZXNcbiAgZmlsbE9wYWNpdHk6IDEsXG4gIGZsb29kT3BhY2l0eTogMSxcbiAgc3RvcE9wYWNpdHk6IDEsXG4gIHN0cm9rZURhc2hhcnJheTogMSxcbiAgc3Ryb2tlRGFzaG9mZnNldDogMSxcbiAgc3Ryb2tlTWl0ZXJsaW1pdDogMSxcbiAgc3Ryb2tlT3BhY2l0eTogMSxcbiAgc3Ryb2tlV2lkdGg6IDFcbn07XG5cbmV4cG9ydHMuZGVmYXVsdCA9IHVuaXRsZXNzS2V5cztcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcblxudmFyIGlzQnJvd3NlciA9IFwib2JqZWN0XCIgIT09ICd1bmRlZmluZWQnO1xuZnVuY3Rpb24gZ2V0UmVnaXN0ZXJlZFN0eWxlcyhyZWdpc3RlcmVkLCByZWdpc3RlcmVkU3R5bGVzLCBjbGFzc05hbWVzKSB7XG4gIHZhciByYXdDbGFzc05hbWUgPSAnJztcbiAgY2xhc3NOYW1lcy5zcGxpdCgnICcpLmZvckVhY2goZnVuY3Rpb24gKGNsYXNzTmFtZSkge1xuICAgIGlmIChyZWdpc3RlcmVkW2NsYXNzTmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVnaXN0ZXJlZFN0eWxlcy5wdXNoKHJlZ2lzdGVyZWRbY2xhc3NOYW1lXSArIFwiO1wiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmF3Q2xhc3NOYW1lICs9IGNsYXNzTmFtZSArIFwiIFwiO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiByYXdDbGFzc05hbWU7XG59XG52YXIgcmVnaXN0ZXJTdHlsZXMgPSBmdW5jdGlvbiByZWdpc3RlclN0eWxlcyhjYWNoZSwgc2VyaWFsaXplZCwgaXNTdHJpbmdUYWcpIHtcbiAgdmFyIGNsYXNzTmFtZSA9IGNhY2hlLmtleSArIFwiLVwiICsgc2VyaWFsaXplZC5uYW1lO1xuXG4gIGlmICggLy8gd2Ugb25seSBuZWVkIHRvIGFkZCB0aGUgc3R5bGVzIHRvIHRoZSByZWdpc3RlcmVkIGNhY2hlIGlmIHRoZVxuICAvLyBjbGFzcyBuYW1lIGNvdWxkIGJlIHVzZWQgZnVydGhlciBkb3duXG4gIC8vIHRoZSB0cmVlIGJ1dCBpZiBpdCdzIGEgc3RyaW5nIHRhZywgd2Uga25vdyBpdCB3b24ndFxuICAvLyBzbyB3ZSBkb24ndCBoYXZlIHRvIGFkZCBpdCB0byByZWdpc3RlcmVkIGNhY2hlLlxuICAvLyB0aGlzIGltcHJvdmVzIG1lbW9yeSB1c2FnZSBzaW5jZSB3ZSBjYW4gYXZvaWQgc3RvcmluZyB0aGUgd2hvbGUgc3R5bGUgc3RyaW5nXG4gIChpc1N0cmluZ1RhZyA9PT0gZmFsc2UgfHwgLy8gd2UgbmVlZCB0byBhbHdheXMgc3RvcmUgaXQgaWYgd2UncmUgaW4gY29tcGF0IG1vZGUgYW5kXG4gIC8vIGluIG5vZGUgc2luY2UgZW1vdGlvbi1zZXJ2ZXIgcmVsaWVzIG9uIHdoZXRoZXIgYSBzdHlsZSBpcyBpblxuICAvLyB0aGUgcmVnaXN0ZXJlZCBjYWNoZSB0byBrbm93IHdoZXRoZXIgYSBzdHlsZSBpcyBnbG9iYWwgb3Igbm90XG4gIC8vIGFsc28sIG5vdGUgdGhhdCB0aGlzIGNoZWNrIHdpbGwgYmUgZGVhZCBjb2RlIGVsaW1pbmF0ZWQgaW4gdGhlIGJyb3dzZXJcbiAgaXNCcm93c2VyID09PSBmYWxzZSApICYmIGNhY2hlLnJlZ2lzdGVyZWRbY2xhc3NOYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY2FjaGUucmVnaXN0ZXJlZFtjbGFzc05hbWVdID0gc2VyaWFsaXplZC5zdHlsZXM7XG4gIH1cbn07XG52YXIgaW5zZXJ0U3R5bGVzID0gZnVuY3Rpb24gaW5zZXJ0U3R5bGVzKGNhY2hlLCBzZXJpYWxpemVkLCBpc1N0cmluZ1RhZykge1xuICByZWdpc3RlclN0eWxlcyhjYWNoZSwgc2VyaWFsaXplZCwgaXNTdHJpbmdUYWcpO1xuICB2YXIgY2xhc3NOYW1lID0gY2FjaGUua2V5ICsgXCItXCIgKyBzZXJpYWxpemVkLm5hbWU7XG5cbiAgaWYgKGNhY2hlLmluc2VydGVkW3NlcmlhbGl6ZWQubmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBjdXJyZW50ID0gc2VyaWFsaXplZDtcblxuICAgIGRvIHtcbiAgICAgIHZhciBtYXliZVN0eWxlcyA9IGNhY2hlLmluc2VydChzZXJpYWxpemVkID09PSBjdXJyZW50ID8gXCIuXCIgKyBjbGFzc05hbWUgOiAnJywgY3VycmVudCwgY2FjaGUuc2hlZXQsIHRydWUpO1xuXG4gICAgICBjdXJyZW50ID0gY3VycmVudC5uZXh0O1xuICAgIH0gd2hpbGUgKGN1cnJlbnQgIT09IHVuZGVmaW5lZCk7XG4gIH1cbn07XG5cbmV4cG9ydHMuZ2V0UmVnaXN0ZXJlZFN0eWxlcyA9IGdldFJlZ2lzdGVyZWRTdHlsZXM7XG5leHBvcnRzLmluc2VydFN0eWxlcyA9IGluc2VydFN0eWxlcztcbmV4cG9ydHMucmVnaXN0ZXJTdHlsZXMgPSByZWdpc3RlclN0eWxlcztcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcblxudmFyIHdlYWtNZW1vaXplID0gZnVuY3Rpb24gd2Vha01lbW9pemUoZnVuYykge1xuICAvLyAkRmxvd0ZpeE1lIGZsb3cgZG9lc24ndCBpbmNsdWRlIGFsbCBub24tcHJpbWl0aXZlIHR5cGVzIGFzIGFsbG93ZWQgZm9yIHdlYWttYXBzXG4gIHZhciBjYWNoZSA9IG5ldyBXZWFrTWFwKCk7XG4gIHJldHVybiBmdW5jdGlvbiAoYXJnKSB7XG4gICAgaWYgKGNhY2hlLmhhcyhhcmcpKSB7XG4gICAgICAvLyAkRmxvd0ZpeE1lXG4gICAgICByZXR1cm4gY2FjaGUuZ2V0KGFyZyk7XG4gICAgfVxuXG4gICAgdmFyIHJldCA9IGZ1bmMoYXJnKTtcbiAgICBjYWNoZS5zZXQoYXJnLCByZXQpO1xuICAgIHJldHVybiByZXQ7XG4gIH07XG59O1xuXG5leHBvcnRzLmRlZmF1bHQgPSB3ZWFrTWVtb2l6ZTtcbiIsIlwidXNlIHN0cmljdFwiO1xudmFyIF9faW1wb3J0RGVmYXVsdCA9ICh0aGlzICYmIHRoaXMuX19pbXBvcnREZWZhdWx0KSB8fCBmdW5jdGlvbiAobW9kKSB7XG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBcImRlZmF1bHRcIjogbW9kIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5DdXN0b21TY3JvbGxiYXIgPSB2b2lkIDA7XG5jb25zdCB1dGlsXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vdXRpbFwiKSk7XG5jb25zdCBkZWZhdWx0T3B0aW9uID0ge1xuICAgIGNvbnRlbnRzOiBcIi5jdXN0b20tc2Nyb2xsLWNvbnRlbnRzXCIsXG4gICAgd3JhcDogXCIuY3VzdG9tLXNjcm9sbC13cmFwXCIsXG4gICAgYmFyOiBcIi5jdXN0b20tc2Nyb2xsLWJhclwiLFxuICAgIGRpcmVjdGlvbjogXCJ2ZXJ0aWNhbFwiXG59O1xuY2xhc3MgQ3VzdG9tU2Nyb2xsYmFyIHtcbiAgICBjb25zdHJ1Y3Rvcih0YXJnZXQsIG9wdGlvbiA9IHt9KSB7XG4gICAgICAgIHRoaXMud2F0Y2hTY3JvbGwgPSAoKSA9PiB7XG4gICAgICAgICAgICBzd2l0Y2ggKHRoaXMub3B0aW9uLmRpcmVjdGlvbikge1xuICAgICAgICAgICAgICAgIGNhc2UgXCJob3Jpem9udGFsXCI6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnRlbnRzLnNjcm9sbExlZnQ7XG4gICAgICAgICAgICAgICAgY2FzZSBcInZlcnRpY2FsXCI6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnRlbnRzLnNjcm9sbFRvcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jcmVhdGVXcmFwcGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgY29udGVudHNIVE1MID0gdGhpcy5jb250ZW50cy5pbm5lckhUTUw7XG4gICAgICAgICAgICB0aGlzLmNvbnRlbnRzLmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwiY3VzdG9tLXNjcm9sbGJhci1jb250ZW50LXdyYXBwZXJcIj4ke2NvbnRlbnRzSFRNTH08L2Rpdj5gO1xuICAgICAgICAgICAgdGhpcy5jb250ZW50c0lubmVyID0gdGhpcy50YXJnZXQucXVlcnlTZWxlY3RvcihcIi5jdXN0b20tc2Nyb2xsYmFyLWNvbnRlbnQtd3JhcHBlclwiKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5tb3ZlU2Nyb2xsYmFyID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2Nyb2xsVmFsID0gdGhpcy53YXRjaFNjcm9sbCgpO1xuICAgICAgICAgICAgY29uc3QgY29udGVudHNIZWlnaHQgPSB0aGlzLmNvbnRlbnRzLmNsaWVudEhlaWdodDtcbiAgICAgICAgICAgIGxldCBzY3JvbGxSYW5nZSA9IDA7XG4gICAgICAgICAgICBpZiAodGhpcy5jb250ZW50c0lubmVyKSB7XG4gICAgICAgICAgICAgICAgc2Nyb2xsUmFuZ2UgPSB0aGlzLmNvbnRlbnRzSW5uZXIuY2xpZW50SGVpZ2h0IC0gY29udGVudHNIZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBiYXJIZWlnaHQgPSB0aGlzLmJhci5jbGllbnRIZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCByYW5nZSA9IHRoaXMud3JhcC5jbGllbnRIZWlnaHQgLSBiYXJIZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCBiYXJQb3NpdGlvbiA9IHV0aWxfMS5kZWZhdWx0Lm1hcHBpbmcoc2Nyb2xsVmFsLCAwLCBzY3JvbGxSYW5nZSwgMCwgcmFuZ2UpO1xuICAgICAgICAgICAgdGhpcy5iYXIuc3R5bGUudG9wID0gYCR7TWF0aC5hYnMoYmFyUG9zaXRpb24pfXB4YDtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5uZWVkU2Nyb2xsQmFyID0gKCkgPT4ge1xuICAgICAgICAgICAgdmFyIF9hO1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgaWYgKHRoaXMuY29udGVudHMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0ID49ICgoX2EgPSB0aGlzLmNvbnRlbnRzSW5uZXIpID09PSBudWxsIHx8IF9hID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfYS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cmFwLmNsYXNzTGlzdC5hZGQoXCJpcy1ub1Njcm9sbFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5vbkJhckNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5jbGlja0ZsYWcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5jb250ZW50cy5zdHlsZS51c2VyU2VsZWN0ID0gXCJub25lXCI7XG4gICAgICAgICAgICB0aGlzLmJhci5jbGFzc0xpc3QuYWRkKFwiaXMtZ3JhYmJpbmdcIik7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMub25CYXJVbkNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5jbGlja0ZsYWcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuY29udGVudHMuc3R5bGUudXNlclNlbGVjdCA9IFwiXCI7XG4gICAgICAgICAgICB0aGlzLmJhci5jbGFzc0xpc3QucmVtb3ZlKFwiaXMtZ3JhYmJpbmdcIik7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZm9sbG93U2Nyb2xsQmFyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNsaWNrRmxhZykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vdXNlWSA9IGUucGFnZVk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2Nyb2xsV3JhcFBvc1kgPSB0aGlzLndyYXAuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhclBvcyA9IG1vdXNlWSAtIHNjcm9sbFdyYXBQb3NZO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJhbmdlID0gdGhpcy53cmFwLmNsaWVudEhlaWdodCAtIHRoaXMuYmFyLmNsaWVudEhlaWdodDtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50c0hlaWdodCA9IHRoaXMuY29udGVudHMuY2xpZW50SGVpZ2h0O1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjcm9sbFJhbmdlID0gdGhpcy5jb250ZW50c0lubmVyID8gdGhpcy5jb250ZW50c0lubmVyLmNsaWVudEhlaWdodCAtIGNvbnRlbnRzSGVpZ2h0IDogMDtcbiAgICAgICAgICAgICAgICBpZiAoYmFyUG9zID49IDAgJiYgYmFyUG9zIDw9IHJhbmdlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYmFyLnN0eWxlLnRvcCA9IGAke2JhclBvc31weGA7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjcm9sbFBvcyA9IHV0aWxfMS5kZWZhdWx0Lm1hcHBpbmcoYmFyUG9zLCAwLCByYW5nZSwgMCwgc2Nyb2xsUmFuZ2UpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnRzLnNjcm9sbFRvKDAsIHNjcm9sbFBvcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmFkZEV2ZW50ID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5jb250ZW50cy5hZGRFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHRoaXMubW92ZVNjcm9sbGJhcik7XG4gICAgICAgICAgICB0aGlzLmJhci5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMub25CYXJDbGljayk7XG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgdGhpcy5vbkJhclVuQ2xpY2spO1xuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgdGhpcy5mb2xsb3dTY3JvbGxCYXIpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmRlc3Ryb3kgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmNvbnRlbnRzLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5tb3ZlU2Nyb2xsYmFyKTtcbiAgICAgICAgICAgIHRoaXMuYmFyLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCB0aGlzLm9uQmFyQ2xpY2spO1xuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIHRoaXMub25CYXJVbkNsaWNrKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy50YXJnZXQgPSB0eXBlb2YgdGFyZ2V0ID09PSBcInN0cmluZ1wiID8gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0YXJnZXQpIDogdGFyZ2V0O1xuICAgICAgICB0aGlzLm9wdGlvbiA9IE9iamVjdC5hc3NpZ24oZGVmYXVsdE9wdGlvbiwgb3B0aW9uKTtcbiAgICAgICAgdGhpcy5jb250ZW50cyA9IHRoaXMudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRpb24uY29udGVudHMpO1xuICAgICAgICB0aGlzLmJhciA9IHRoaXMudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRpb24uYmFyKTtcbiAgICAgICAgdGhpcy53cmFwID0gdGhpcy50YXJnZXQucXVlcnlTZWxlY3Rvcih0aGlzLm9wdGlvbi53cmFwKTtcbiAgICAgICAgdGhpcy5jb250ZW50c0lubmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5jbGlja0ZsYWcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jcmVhdGVXcmFwcGVyKCk7XG4gICAgICAgIHRoaXMuYWRkRXZlbnQoKTtcbiAgICAgICAgdGhpcy5uZWVkU2Nyb2xsQmFyKCk7XG4gICAgfVxufVxuZXhwb3J0cy5DdXN0b21TY3JvbGxiYXIgPSBDdXN0b21TY3JvbGxiYXI7XG4iLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmNsYXNzIFV0aWwge1xuICAgIHN0YXRpYyBtYXBwaW5nKHZhbHVlLCBtaW5WYWwsIG1heFZhbCwgdHJhbnNmb3JtTWluVmFsLCB0cmFuc2Zvcm1NYXhWYWwpIHtcbiAgICAgICAgY29uc3QgdHJhbnNmb3JtRGlmZiA9IHRyYW5zZm9ybU1heFZhbCAtIHRyYW5zZm9ybU1pblZhbDtcbiAgICAgICAgY29uc3QgZGlmZiA9IG1heFZhbCAtIG1pblZhbDtcbiAgICAgICAgY29uc3QgcGVyY2VudGFnZSA9IHZhbHVlIC8gZGlmZjtcbiAgICAgICAgcmV0dXJuIHRyYW5zZm9ybURpZmYgKiBwZXJjZW50YWdlICsgdHJhbnNmb3JtTWluVmFsO1xuICAgIH1cbn1cbmV4cG9ydHMuZGVmYXVsdCA9IFV0aWw7XG4iLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmV4cG9ydHMuY3JlYXRlQ29tcG9uZW50ID0gZXhwb3J0cy5Db21wb25lbnQgPSBleHBvcnRzLlBhZ2UgPSB2b2lkIDA7XG5jbGFzcyBCYXNlIHtcbiAgICBjb25zdHJ1Y3RvcihfdGFnKSB7XG4gICAgICAgIHRoaXMuc2V0RW1vdGlvbiA9ICgpID0+IHtcbiAgICAgICAgICAgIHZhciBfYTtcbiAgICAgICAgICAgIGxldCBzdHlsZSA9IG51bGw7XG4gICAgICAgICAgICBpZiAodGhpcy5zdHlsZSkge1xuICAgICAgICAgICAgICAgIHN0eWxlID0gdGhpcy5zdHlsZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0eWxlKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VsZWN0b3IgPSBgWyR7dGhpcy50YWd9LWNzc11gO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0eWxlVGFyZ2V0cyA9IChfYSA9IHRoaXMuc2VjdGlvbikgPT09IG51bGwgfHwgX2EgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9hLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgICAgICAgICAgICAgIGlmIChzdHlsZVRhcmdldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2Ygc3R5bGVUYXJnZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWxlY3RvciA9IHRhcmdldC5nZXRBdHRyaWJ1dGUoYCR7dGhpcy50YWd9LWNzc2ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LmNsYXNzTGlzdC5hZGQoc3R5bGVbc2VsZWN0b3JdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zdGFydFdhdGNoZXIgPSAoa2V5cykgPT4ge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMoa2V5cykuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgIGxldCBsYXN0VmFsID0gdGhpc1trZXldO1xuICAgICAgICAgICAgICAgIHRoaXMud2F0Y2hGdW5jc1trZXldID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzW2tleV0gIT09IGxhc3RWYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RWYWwgPSB0aGlzW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICBrZXlzW2tleV0oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy53YXRjaEZ1bmNzW2tleV0pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgdGhpcy53YXRjaEZ1bmNzW2tleV0oKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLl9hZGRFdmVudHMgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBldmVudHMgPSBbXCJjbGlja1wiLCBcInNjcm9sbFwiLCBcImxvYWRcIiwgXCJtb3VzZWVudGVyXCIsIFwibW91c2VsZWF2ZVwiLCBcIm1vdXNlb3ZlclwiLCBcImNoYW5nZVwiXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXZlbnROYW1lID0gYCR7dGhpcy50YWd9LSR7ZXZlbnR9YDtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zZWN0aW9uICE9PSB1bmRlZmluZWQgJiYgdGhpcy5zZWN0aW9uICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldHMgPSB0aGlzLnNlY3Rpb24ucXVlcnlTZWxlY3RvckFsbChcIltcIiArIGV2ZW50TmFtZSArIFwiXVwiKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZnVuYyA9IHRhcmdldC5nZXRBdHRyaWJ1dGUoZXZlbnROYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFkZEZ1bmMgPSAoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmdW5jICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1tmdW5jXShlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGFkZEZ1bmMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnRhZyA9IF90YWc7XG4gICAgICAgIHRoaXMucmVmcyA9IHt9O1xuICAgICAgICB0aGlzLndhdGNoRnVuY3MgPSB7fTtcbiAgICB9XG4gICAgaW5pdChjYikge1xuICAgICAgICBpZiAodGhpcy5zZWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRFdmVudHMoKTtcbiAgICAgICAgICAgIHRoaXMuZ2V0UmVmZXJlbmNlKCk7XG4gICAgICAgICAgICB0aGlzLnNldFdhdGNoKCk7XG4gICAgICAgICAgICB0aGlzLnNldEVtb3Rpb24oKTtcbiAgICAgICAgICAgIGlmIChjYikge1xuICAgICAgICAgICAgICAgIGNiKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgc2V0V2F0Y2goKSB7XG4gICAgICAgIGlmICh0aGlzLndhdGNoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrID0gdGhpcy53YXRjaCgpO1xuICAgICAgICAgICAgdGhpcy5zdGFydFdhdGNoZXIoY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJlbW92ZVdhdGNoKCkge1xuICAgICAgICBPYmplY3Qua2V5cyh0aGlzLndhdGNoRnVuY3MpLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLndhdGNoRnVuY3Nba2V5XSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBnZXRSZWZlcmVuY2UoKSB7XG4gICAgICAgIGNvbnN0IHRhZyA9IGAke3RoaXMudGFnfS1yZWZgO1xuICAgICAgICBpZiAodGhpcy5zZWN0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCByZWZzID0gdGhpcy5zZWN0aW9uLnF1ZXJ5U2VsZWN0b3JBbGwoYFske3RhZ31dYCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlZiBvZiByZWZzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlID0gcmVmLmdldEF0dHJpYnV0ZSh0YWcpO1xuICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWZzW2F0dHJpYnV0ZV0gPSByZWY7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgaWYgKHRoaXMuYmVmb3JlRGVzdHJveSkge1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgdGhpcy5iZWZvcmVEZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5jbGFzcyBQYWdlIGV4dGVuZHMgQmFzZSB7XG4gICAgY29uc3RydWN0b3IoX3RhZywgbnVtID0gbnVsbCkge1xuICAgICAgICBzdXBlcihfdGFnKTtcbiAgICAgICAgdGhpcy50YWcgPSBfdGFnO1xuICAgICAgICB0aGlzLnNlY3Rpb24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChfdGFnKTtcbiAgICB9XG59XG5leHBvcnRzLlBhZ2UgPSBQYWdlO1xuY2xhc3MgQ29tcG9uZW50IGV4dGVuZHMgQmFzZSB7XG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMudGFnKTtcbiAgICAgICAgdGhpcy5zZWN0aW9uID0gcHJvcHMuY29tcG9uZW50O1xuICAgIH1cbn1cbmV4cG9ydHMuQ29tcG9uZW50ID0gQ29tcG9uZW50O1xuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KF90YWdOYW1lLCBfY2xhc3MpIHtcbiAgICBjb25zdCB0YXJnZXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChfdGFnTmFtZSk7XG4gICAgY29uc3QgcmVmYWN0b3JUYWcgPSBfdGFnTmFtZS5yZXBsYWNlKFwiI1wiLCBcIlwiKS5yZXBsYWNlKFwiLlwiLCBcIlwiKTtcbiAgICBjb25zdCBjbGFzc2VzID0gW107XG4gICAgaWYgKF90YWdOYW1lLmluY2x1ZGVzKFwiI1wiKSkge1xuICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgICBjbGFzc2VzLnB1c2gobmV3IF9jbGFzcyhyZWZhY3RvclRhZykpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKF90YWdOYW1lLmluY2x1ZGVzKFwiLlwiKSkge1xuICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgICBjbGFzc2VzLnB1c2gobmV3IF9jbGFzcyh7IGNvbXBvbmVudDogdGFyZ2V0LCB0YWc6IHJlZmFjdG9yVGFnIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY2xhc3Nlcztcbn1cbmV4cG9ydHMuY3JlYXRlQ29tcG9uZW50ID0gY3JlYXRlQ29tcG9uZW50O1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIihmdW5jdGlvbihlLHIpe3R5cGVvZiBleHBvcnRzPT09XCJvYmplY3RcIiYmdHlwZW9mIG1vZHVsZSE9PVwidW5kZWZpbmVkXCI/cihleHBvcnRzKTp0eXBlb2YgZGVmaW5lPT09XCJmdW5jdGlvblwiJiZkZWZpbmUuYW1kP2RlZmluZShbXCJleHBvcnRzXCJdLHIpOihlPWV8fHNlbGYscihlLnN0eWxpcz17fSkpfSkodGhpcywoZnVuY3Rpb24oZSl7XCJ1c2Ugc3RyaWN0XCI7dmFyIHI9XCItbXMtXCI7dmFyIGE9XCItbW96LVwiO3ZhciBjPVwiLXdlYmtpdC1cIjt2YXIgdD1cImNvbW1cIjt2YXIgbj1cInJ1bGVcIjt2YXIgcz1cImRlY2xcIjt2YXIgaT1cIkBwYWdlXCI7dmFyIHU9XCJAbWVkaWFcIjt2YXIgbz1cIkBpbXBvcnRcIjt2YXIgZj1cIkBjaGFyc2V0XCI7dmFyIGw9XCJAdmlld3BvcnRcIjt2YXIgaD1cIkBzdXBwb3J0c1wiO3ZhciBwPVwiQGRvY3VtZW50XCI7dmFyIHY9XCJAbmFtZXNwYWNlXCI7dmFyIGI9XCJAa2V5ZnJhbWVzXCI7dmFyIGQ9XCJAZm9udC1mYWNlXCI7dmFyIG09XCJAY291bnRlci1zdHlsZVwiO3ZhciB3PVwiQGZvbnQtZmVhdHVyZS12YWx1ZXNcIjt2YXIgaz1NYXRoLmFiczt2YXIgJD1TdHJpbmcuZnJvbUNoYXJDb2RlO3ZhciBnPU9iamVjdC5hc3NpZ247ZnVuY3Rpb24geChlLHIpe3JldHVybigoKHI8PDJeTyhlLDApKTw8Ml5PKGUsMSkpPDwyXk8oZSwyKSk8PDJeTyhlLDMpfWZ1bmN0aW9uIEUoZSl7cmV0dXJuIGUudHJpbSgpfWZ1bmN0aW9uIHkoZSxyKXtyZXR1cm4oZT1yLmV4ZWMoZSkpP2VbMF06ZX1mdW5jdGlvbiBUKGUscixhKXtyZXR1cm4gZS5yZXBsYWNlKHIsYSl9ZnVuY3Rpb24gQShlLHIpe3JldHVybiBlLmluZGV4T2Yocil9ZnVuY3Rpb24gTyhlLHIpe3JldHVybiBlLmNoYXJDb2RlQXQocil8MH1mdW5jdGlvbiBDKGUscixhKXtyZXR1cm4gZS5zbGljZShyLGEpfWZ1bmN0aW9uIE0oZSl7cmV0dXJuIGUubGVuZ3RofWZ1bmN0aW9uIFMoZSl7cmV0dXJuIGUubGVuZ3RofWZ1bmN0aW9uIFIoZSxyKXtyZXR1cm4gci5wdXNoKGUpLGV9ZnVuY3Rpb24geihlLHIpe3JldHVybiBlLm1hcChyKS5qb2luKFwiXCIpfWUubGluZT0xO2UuY29sdW1uPTE7ZS5sZW5ndGg9MDtlLnBvc2l0aW9uPTA7ZS5jaGFyYWN0ZXI9MDtlLmNoYXJhY3RlcnM9XCJcIjtmdW5jdGlvbiBOKHIsYSxjLHQsbixzLGkpe3JldHVybnt2YWx1ZTpyLHJvb3Q6YSxwYXJlbnQ6Yyx0eXBlOnQscHJvcHM6bixjaGlsZHJlbjpzLGxpbmU6ZS5saW5lLGNvbHVtbjplLmNvbHVtbixsZW5ndGg6aSxyZXR1cm46XCJcIn19ZnVuY3Rpb24gUChlLHIpe3JldHVybiBnKE4oXCJcIixudWxsLG51bGwsXCJcIixudWxsLG51bGwsMCksZSx7bGVuZ3RoOi1lLmxlbmd0aH0scil9ZnVuY3Rpb24gaigpe3JldHVybiBlLmNoYXJhY3Rlcn1mdW5jdGlvbiBVKCl7ZS5jaGFyYWN0ZXI9ZS5wb3NpdGlvbj4wP08oZS5jaGFyYWN0ZXJzLC0tZS5wb3NpdGlvbik6MDtpZihlLmNvbHVtbi0tLGUuY2hhcmFjdGVyPT09MTApZS5jb2x1bW49MSxlLmxpbmUtLTtyZXR1cm4gZS5jaGFyYWN0ZXJ9ZnVuY3Rpb24gXygpe2UuY2hhcmFjdGVyPWUucG9zaXRpb248ZS5sZW5ndGg/TyhlLmNoYXJhY3RlcnMsZS5wb3NpdGlvbisrKTowO2lmKGUuY29sdW1uKyssZS5jaGFyYWN0ZXI9PT0xMCllLmNvbHVtbj0xLGUubGluZSsrO3JldHVybiBlLmNoYXJhY3Rlcn1mdW5jdGlvbiBGKCl7cmV0dXJuIE8oZS5jaGFyYWN0ZXJzLGUucG9zaXRpb24pfWZ1bmN0aW9uIEkoKXtyZXR1cm4gZS5wb3NpdGlvbn1mdW5jdGlvbiBMKHIsYSl7cmV0dXJuIEMoZS5jaGFyYWN0ZXJzLHIsYSl9ZnVuY3Rpb24gRChlKXtzd2l0Y2goZSl7Y2FzZSAwOmNhc2UgOTpjYXNlIDEwOmNhc2UgMTM6Y2FzZSAzMjpyZXR1cm4gNTtjYXNlIDMzOmNhc2UgNDM6Y2FzZSA0NDpjYXNlIDQ3OmNhc2UgNjI6Y2FzZSA2NDpjYXNlIDEyNjpjYXNlIDU5OmNhc2UgMTIzOmNhc2UgMTI1OnJldHVybiA0O2Nhc2UgNTg6cmV0dXJuIDM7Y2FzZSAzNDpjYXNlIDM5OmNhc2UgNDA6Y2FzZSA5MTpyZXR1cm4gMjtjYXNlIDQxOmNhc2UgOTM6cmV0dXJuIDF9cmV0dXJuIDB9ZnVuY3Rpb24gSyhyKXtyZXR1cm4gZS5saW5lPWUuY29sdW1uPTEsZS5sZW5ndGg9TShlLmNoYXJhY3RlcnM9ciksZS5wb3NpdGlvbj0wLFtdfWZ1bmN0aW9uIFYocil7cmV0dXJuIGUuY2hhcmFjdGVycz1cIlwiLHJ9ZnVuY3Rpb24gVyhyKXtyZXR1cm4gRShMKGUucG9zaXRpb24tMSxaKHI9PT05MT9yKzI6cj09PTQwP3IrMTpyKSkpfWZ1bmN0aW9uIFkoZSl7cmV0dXJuIFYoRyhLKGUpKSl9ZnVuY3Rpb24gQihyKXt3aGlsZShlLmNoYXJhY3Rlcj1GKCkpaWYoZS5jaGFyYWN0ZXI8MzMpXygpO2Vsc2UgYnJlYWs7cmV0dXJuIEQocik+Mnx8RChlLmNoYXJhY3Rlcik+Mz9cIlwiOlwiIFwifWZ1bmN0aW9uIEcocil7d2hpbGUoXygpKXN3aXRjaChEKGUuY2hhcmFjdGVyKSl7Y2FzZSAwOlIoSihlLnBvc2l0aW9uLTEpLHIpO2JyZWFrO2Nhc2UgMjpSKFcoZS5jaGFyYWN0ZXIpLHIpO2JyZWFrO2RlZmF1bHQ6UigkKGUuY2hhcmFjdGVyKSxyKX1yZXR1cm4gcn1mdW5jdGlvbiBIKHIsYSl7d2hpbGUoLS1hJiZfKCkpaWYoZS5jaGFyYWN0ZXI8NDh8fGUuY2hhcmFjdGVyPjEwMnx8ZS5jaGFyYWN0ZXI+NTcmJmUuY2hhcmFjdGVyPDY1fHxlLmNoYXJhY3Rlcj43MCYmZS5jaGFyYWN0ZXI8OTcpYnJlYWs7cmV0dXJuIEwocixJKCkrKGE8NiYmRigpPT0zMiYmXygpPT0zMikpfWZ1bmN0aW9uIFoocil7d2hpbGUoXygpKXN3aXRjaChlLmNoYXJhY3Rlcil7Y2FzZSByOnJldHVybiBlLnBvc2l0aW9uO2Nhc2UgMzQ6Y2FzZSAzOTppZihyIT09MzQmJnIhPT0zOSlaKGUuY2hhcmFjdGVyKTticmVhaztjYXNlIDQwOmlmKHI9PT00MSlaKHIpO2JyZWFrO2Nhc2UgOTI6XygpO2JyZWFrfXJldHVybiBlLnBvc2l0aW9ufWZ1bmN0aW9uIHEocixhKXt3aGlsZShfKCkpaWYocitlLmNoYXJhY3Rlcj09PTQ3KzEwKWJyZWFrO2Vsc2UgaWYocitlLmNoYXJhY3Rlcj09PTQyKzQyJiZGKCk9PT00NylicmVhaztyZXR1cm5cIi8qXCIrTChhLGUucG9zaXRpb24tMSkrXCIqXCIrJChyPT09NDc/cjpfKCkpfWZ1bmN0aW9uIEoocil7d2hpbGUoIUQoRigpKSlfKCk7cmV0dXJuIEwocixlLnBvc2l0aW9uKX1mdW5jdGlvbiBRKGUpe3JldHVybiBWKFgoXCJcIixudWxsLG51bGwsbnVsbCxbXCJcIl0sZT1LKGUpLDAsWzBdLGUpKX1mdW5jdGlvbiBYKGUscixhLGMsdCxuLHMsaSx1KXt2YXIgbz0wO3ZhciBmPTA7dmFyIGw9czt2YXIgaD0wO3ZhciBwPTA7dmFyIHY9MDt2YXIgYj0xO3ZhciBkPTE7dmFyIG09MTt2YXIgdz0wO3ZhciBrPVwiXCI7dmFyIGc9dDt2YXIgeD1uO3ZhciBFPWM7dmFyIHk9azt3aGlsZShkKXN3aXRjaCh2PXcsdz1fKCkpe2Nhc2UgNDA6aWYodiE9MTA4JiZ5LmNoYXJDb2RlQXQobC0xKT09NTgpe2lmKEEoeSs9VChXKHcpLFwiJlwiLFwiJlxcZlwiKSxcIiZcXGZcIikhPS0xKW09LTE7YnJlYWt9Y2FzZSAzNDpjYXNlIDM5OmNhc2UgOTE6eSs9Vyh3KTticmVhaztjYXNlIDk6Y2FzZSAxMDpjYXNlIDEzOmNhc2UgMzI6eSs9Qih2KTticmVhaztjYXNlIDkyOnkrPUgoSSgpLTEsNyk7Y29udGludWU7Y2FzZSA0Nzpzd2l0Y2goRigpKXtjYXNlIDQyOmNhc2UgNDc6UihyZShxKF8oKSxJKCkpLHIsYSksdSk7YnJlYWs7ZGVmYXVsdDp5Kz1cIi9cIn1icmVhaztjYXNlIDEyMypiOmlbbysrXT1NKHkpKm07Y2FzZSAxMjUqYjpjYXNlIDU5OmNhc2UgMDpzd2l0Y2godyl7Y2FzZSAwOmNhc2UgMTI1OmQ9MDtjYXNlIDU5K2Y6aWYocD4wJiZNKHkpLWwpUihwPjMyP2FlKHkrXCI7XCIsYyxhLGwtMSk6YWUoVCh5LFwiIFwiLFwiXCIpK1wiO1wiLGMsYSxsLTIpLHUpO2JyZWFrO2Nhc2UgNTk6eSs9XCI7XCI7ZGVmYXVsdDpSKEU9ZWUoeSxyLGEsbyxmLHQsaSxrLGc9W10seD1bXSxsKSxuKTtpZih3PT09MTIzKWlmKGY9PT0wKVgoeSxyLEUsRSxnLG4sbCxpLHgpO2Vsc2Ugc3dpdGNoKGgpe2Nhc2UgMTAwOmNhc2UgMTA5OmNhc2UgMTE1OlgoZSxFLEUsYyYmUihlZShlLEUsRSwwLDAsdCxpLGssdCxnPVtdLGwpLHgpLHQseCxsLGksYz9nOngpO2JyZWFrO2RlZmF1bHQ6WCh5LEUsRSxFLFtcIlwiXSx4LDAsaSx4KX19bz1mPXA9MCxiPW09MSxrPXk9XCJcIixsPXM7YnJlYWs7Y2FzZSA1ODpsPTErTSh5KSxwPXY7ZGVmYXVsdDppZihiPDEpaWYodz09MTIzKS0tYjtlbHNlIGlmKHc9PTEyNSYmYisrPT0wJiZVKCk9PTEyNSljb250aW51ZTtzd2l0Y2goeSs9JCh3KSx3KmIpe2Nhc2UgMzg6bT1mPjA/MTooeSs9XCJcXGZcIiwtMSk7YnJlYWs7Y2FzZSA0NDppW28rK109KE0oeSktMSkqbSxtPTE7YnJlYWs7Y2FzZSA2NDppZihGKCk9PT00NSl5Kz1XKF8oKSk7aD1GKCksZj1sPU0oaz15Kz1KKEkoKSkpLHcrKzticmVhaztjYXNlIDQ1OmlmKHY9PT00NSYmTSh5KT09MiliPTB9fXJldHVybiBufWZ1bmN0aW9uIGVlKGUscixhLGMsdCxzLGksdSxvLGYsbCl7dmFyIGg9dC0xO3ZhciBwPXQ9PT0wP3M6W1wiXCJdO3ZhciB2PVMocCk7Zm9yKHZhciBiPTAsZD0wLG09MDtiPGM7KytiKWZvcih2YXIgdz0wLCQ9QyhlLGgrMSxoPWsoZD1pW2JdKSksZz1lO3c8djsrK3cpaWYoZz1FKGQ+MD9wW3ddK1wiIFwiKyQ6VCgkLC8mXFxmL2cscFt3XSkpKW9bbSsrXT1nO3JldHVybiBOKGUscixhLHQ9PT0wP246dSxvLGYsbCl9ZnVuY3Rpb24gcmUoZSxyLGEpe3JldHVybiBOKGUscixhLHQsJChqKCkpLEMoZSwyLC0yKSwwKX1mdW5jdGlvbiBhZShlLHIsYSxjKXtyZXR1cm4gTihlLHIsYSxzLEMoZSwwLGMpLEMoZSxjKzEsLTEpLGMpfWZ1bmN0aW9uIGNlKGUsdCl7c3dpdGNoKHgoZSx0KSl7Y2FzZSA1MTAzOnJldHVybiBjK1wicHJpbnQtXCIrZStlO2Nhc2UgNTczNzpjYXNlIDQyMDE6Y2FzZSAzMTc3OmNhc2UgMzQzMzpjYXNlIDE2NDE6Y2FzZSA0NDU3OmNhc2UgMjkyMTpjYXNlIDU1NzI6Y2FzZSA2MzU2OmNhc2UgNTg0NDpjYXNlIDMxOTE6Y2FzZSA2NjQ1OmNhc2UgMzAwNTpjYXNlIDYzOTE6Y2FzZSA1ODc5OmNhc2UgNTYyMzpjYXNlIDYxMzU6Y2FzZSA0NTk5OmNhc2UgNDg1NTpjYXNlIDQyMTU6Y2FzZSA2Mzg5OmNhc2UgNTEwOTpjYXNlIDUzNjU6Y2FzZSA1NjIxOmNhc2UgMzgyOTpyZXR1cm4gYytlK2U7Y2FzZSA1MzQ5OmNhc2UgNDI0NjpjYXNlIDQ4MTA6Y2FzZSA2OTY4OmNhc2UgMjc1NjpyZXR1cm4gYytlK2ErZStyK2UrZTtjYXNlIDY4Mjg6Y2FzZSA0MjY4OnJldHVybiBjK2UrcitlK2U7Y2FzZSA2MTY1OnJldHVybiBjK2UrcitcImZsZXgtXCIrZStlO2Nhc2UgNTE4NzpyZXR1cm4gYytlK1QoZSwvKFxcdyspLisoOlteXSspLyxjK1wiYm94LSQxJDJcIityK1wiZmxleC0kMSQyXCIpK2U7Y2FzZSA1NDQzOnJldHVybiBjK2UrcitcImZsZXgtaXRlbS1cIitUKGUsL2ZsZXgtfC1zZWxmLyxcIlwiKStlO2Nhc2UgNDY3NTpyZXR1cm4gYytlK3IrXCJmbGV4LWxpbmUtcGFja1wiK1QoZSwvYWxpZ24tY29udGVudHxmbGV4LXwtc2VsZi8sXCJcIikrZTtjYXNlIDU1NDg6cmV0dXJuIGMrZStyK1QoZSxcInNocmlua1wiLFwibmVnYXRpdmVcIikrZTtjYXNlIDUyOTI6cmV0dXJuIGMrZStyK1QoZSxcImJhc2lzXCIsXCJwcmVmZXJyZWQtc2l6ZVwiKStlO2Nhc2UgNjA2MDpyZXR1cm4gYytcImJveC1cIitUKGUsXCItZ3Jvd1wiLFwiXCIpK2MrZStyK1QoZSxcImdyb3dcIixcInBvc2l0aXZlXCIpK2U7Y2FzZSA0NTU0OnJldHVybiBjK1QoZSwvKFteLV0pKHRyYW5zZm9ybSkvZyxcIiQxXCIrYytcIiQyXCIpK2U7Y2FzZSA2MTg3OnJldHVybiBUKFQoVChlLC8oem9vbS18Z3JhYikvLGMrXCIkMVwiKSwvKGltYWdlLXNldCkvLGMrXCIkMVwiKSxlLFwiXCIpK2U7Y2FzZSA1NDk1OmNhc2UgMzk1OTpyZXR1cm4gVChlLC8oaW1hZ2Utc2V0XFwoW15dKikvLGMrXCIkMVwiK1wiJGAkMVwiKTtjYXNlIDQ5Njg6cmV0dXJuIFQoVChlLC8oLis6KShmbGV4LSk/KC4qKS8sYytcImJveC1wYWNrOiQzXCIrcitcImZsZXgtcGFjazokM1wiKSwvcy4rLWJbXjtdKy8sXCJqdXN0aWZ5XCIpK2MrZStlO2Nhc2UgNDA5NTpjYXNlIDM1ODM6Y2FzZSA0MDY4OmNhc2UgMjUzMjpyZXR1cm4gVChlLC8oLispLWlubGluZSguKykvLGMrXCIkMSQyXCIpK2U7Y2FzZSA4MTE2OmNhc2UgNzA1OTpjYXNlIDU3NTM6Y2FzZSA1NTM1OmNhc2UgNTQ0NTpjYXNlIDU3MDE6Y2FzZSA0OTMzOmNhc2UgNDY3NzpjYXNlIDU1MzM6Y2FzZSA1Nzg5OmNhc2UgNTAyMTpjYXNlIDQ3NjU6aWYoTShlKS0xLXQ+Nilzd2l0Y2goTyhlLHQrMSkpe2Nhc2UgMTA5OmlmKE8oZSx0KzQpIT09NDUpYnJlYWs7Y2FzZSAxMDI6cmV0dXJuIFQoZSwvKC4rOikoLispLShbXl0rKS8sXCIkMVwiK2MrXCIkMi0kM1wiK1wiJDFcIithKyhPKGUsdCszKT09MTA4P1wiJDNcIjpcIiQyLSQzXCIpKStlO2Nhc2UgMTE1OnJldHVybn5BKGUsXCJzdHJldGNoXCIpP2NlKFQoZSxcInN0cmV0Y2hcIixcImZpbGwtYXZhaWxhYmxlXCIpLHQpK2U6ZX1icmVhaztjYXNlIDQ5NDk6aWYoTyhlLHQrMSkhPT0xMTUpYnJlYWs7Y2FzZSA2NDQ0OnN3aXRjaChPKGUsTShlKS0zLSh+QShlLFwiIWltcG9ydGFudFwiKSYmMTApKSl7Y2FzZSAxMDc6cmV0dXJuIFQoZSxcIjpcIixcIjpcIitjKStlO2Nhc2UgMTAxOnJldHVybiBUKGUsLyguKzopKFteOyFdKykoO3whLispPy8sXCIkMVwiK2MrKE8oZSwxNCk9PT00NT9cImlubGluZS1cIjpcIlwiKStcImJveCQzXCIrXCIkMVwiK2MrXCIkMiQzXCIrXCIkMVwiK3IrXCIkMmJveCQzXCIpK2V9YnJlYWs7Y2FzZSA1OTM2OnN3aXRjaChPKGUsdCsxMSkpe2Nhc2UgMTE0OnJldHVybiBjK2UrcitUKGUsL1tzdmhdXFx3Ky1bdGJscl17Mn0vLFwidGJcIikrZTtjYXNlIDEwODpyZXR1cm4gYytlK3IrVChlLC9bc3ZoXVxcdystW3RibHJdezJ9LyxcInRiLXJsXCIpK2U7Y2FzZSA0NTpyZXR1cm4gYytlK3IrVChlLC9bc3ZoXVxcdystW3RibHJdezJ9LyxcImxyXCIpK2V9cmV0dXJuIGMrZStyK2UrZX1yZXR1cm4gZX1mdW5jdGlvbiB0ZShlLHIpe3ZhciBhPVwiXCI7dmFyIGM9UyhlKTtmb3IodmFyIHQ9MDt0PGM7dCsrKWErPXIoZVt0XSx0LGUscil8fFwiXCI7cmV0dXJuIGF9ZnVuY3Rpb24gbmUoZSxyLGEsYyl7c3dpdGNoKGUudHlwZSl7Y2FzZSBvOmNhc2UgczpyZXR1cm4gZS5yZXR1cm49ZS5yZXR1cm58fGUudmFsdWU7Y2FzZSB0OnJldHVyblwiXCI7Y2FzZSBiOnJldHVybiBlLnJldHVybj1lLnZhbHVlK1wie1wiK3RlKGUuY2hpbGRyZW4sYykrXCJ9XCI7Y2FzZSBuOmUudmFsdWU9ZS5wcm9wcy5qb2luKFwiLFwiKX1yZXR1cm4gTShhPXRlKGUuY2hpbGRyZW4sYykpP2UucmV0dXJuPWUudmFsdWUrXCJ7XCIrYStcIn1cIjpcIlwifWZ1bmN0aW9uIHNlKGUpe3ZhciByPVMoZSk7cmV0dXJuIGZ1bmN0aW9uKGEsYyx0LG4pe3ZhciBzPVwiXCI7Zm9yKHZhciBpPTA7aTxyO2krKylzKz1lW2ldKGEsYyx0LG4pfHxcIlwiO3JldHVybiBzfX1mdW5jdGlvbiBpZShlKXtyZXR1cm4gZnVuY3Rpb24ocil7aWYoIXIucm9vdClpZihyPXIucmV0dXJuKWUocil9fWZ1bmN0aW9uIHVlKGUsdCxpLHUpe2lmKGUubGVuZ3RoPi0xKWlmKCFlLnJldHVybilzd2l0Y2goZS50eXBlKXtjYXNlIHM6ZS5yZXR1cm49Y2UoZS52YWx1ZSxlLmxlbmd0aCk7YnJlYWs7Y2FzZSBiOnJldHVybiB0ZShbUChlLHt2YWx1ZTpUKGUudmFsdWUsXCJAXCIsXCJAXCIrYyl9KV0sdSk7Y2FzZSBuOmlmKGUubGVuZ3RoKXJldHVybiB6KGUucHJvcHMsKGZ1bmN0aW9uKHQpe3N3aXRjaCh5KHQsLyg6OnBsYWNcXHcrfDpyZWFkLVxcdyspLykpe2Nhc2VcIjpyZWFkLW9ubHlcIjpjYXNlXCI6cmVhZC13cml0ZVwiOnJldHVybiB0ZShbUChlLHtwcm9wczpbVCh0LC86KHJlYWQtXFx3KykvLFwiOlwiK2ErXCIkMVwiKV19KV0sdSk7Y2FzZVwiOjpwbGFjZWhvbGRlclwiOnJldHVybiB0ZShbUChlLHtwcm9wczpbVCh0LC86KHBsYWNcXHcrKS8sXCI6XCIrYytcImlucHV0LSQxXCIpXX0pLFAoZSx7cHJvcHM6W1QodCwvOihwbGFjXFx3KykvLFwiOlwiK2ErXCIkMVwiKV19KSxQKGUse3Byb3BzOltUKHQsLzoocGxhY1xcdyspLyxyK1wiaW5wdXQtJDFcIildfSldLHUpfXJldHVyblwiXCJ9KSl9fWZ1bmN0aW9uIG9lKGUpe3N3aXRjaChlLnR5cGUpe2Nhc2UgbjplLnByb3BzPWUucHJvcHMubWFwKChmdW5jdGlvbihyKXtyZXR1cm4geihZKHIpLChmdW5jdGlvbihyLGEsYyl7c3dpdGNoKE8ociwwKSl7Y2FzZSAxMjpyZXR1cm4gQyhyLDEsTShyKSk7Y2FzZSAwOmNhc2UgNDA6Y2FzZSA0MzpjYXNlIDYyOmNhc2UgMTI2OnJldHVybiByO2Nhc2UgNTg6aWYoY1srK2FdPT09XCJnbG9iYWxcIiljW2FdPVwiXCIsY1srK2FdPVwiXFxmXCIrQyhjW2FdLGE9MSwtMSk7Y2FzZSAzMjpyZXR1cm4gYT09PTE/XCJcIjpyO2RlZmF1bHQ6c3dpdGNoKGEpe2Nhc2UgMDplPXI7cmV0dXJuIFMoYyk+MT9cIlwiOnI7Y2FzZSBhPVMoYyktMTpjYXNlIDI6cmV0dXJuIGE9PT0yP3IrZStlOnIrZTtkZWZhdWx0OnJldHVybiByfX19KSl9KSl9fWUuQ0hBUlNFVD1mO2UuQ09NTUVOVD10O2UuQ09VTlRFUl9TVFlMRT1tO2UuREVDTEFSQVRJT049cztlLkRPQ1VNRU5UPXA7ZS5GT05UX0ZBQ0U9ZDtlLkZPTlRfRkVBVFVSRV9WQUxVRVM9dztlLklNUE9SVD1vO2UuS0VZRlJBTUVTPWI7ZS5NRURJQT11O2UuTU9aPWE7ZS5NUz1yO2UuTkFNRVNQQUNFPXY7ZS5QQUdFPWk7ZS5SVUxFU0VUPW47ZS5TVVBQT1JUUz1oO2UuVklFV1BPUlQ9bDtlLldFQktJVD1jO2UuYWJzPWs7ZS5hbGxvYz1LO2UuYXBwZW5kPVI7ZS5hc3NpZ249ZztlLmNhcmV0PUk7ZS5jaGFyPWo7ZS5jaGFyYXQ9TztlLmNvbWJpbmU9ejtlLmNvbW1lbnQ9cmU7ZS5jb21tZW50ZXI9cTtlLmNvbXBpbGU9UTtlLmNvcHk9UDtlLmRlYWxsb2M9VjtlLmRlY2xhcmF0aW9uPWFlO2UuZGVsaW1pdD1XO2UuZGVsaW1pdGVyPVo7ZS5lc2NhcGluZz1IO2UuZnJvbT0kO2UuaGFzaD14O2UuaWRlbnRpZmllcj1KO2UuaW5kZXhvZj1BO2UubWF0Y2g9eTtlLm1pZGRsZXdhcmU9c2U7ZS5uYW1lc3BhY2U9b2U7ZS5uZXh0PV87ZS5ub2RlPU47ZS5wYXJzZT1YO2UucGVlaz1GO2UucHJlZml4PWNlO2UucHJlZml4ZXI9dWU7ZS5wcmV2PVU7ZS5yZXBsYWNlPVQ7ZS5ydWxlc2V0PWVlO2UucnVsZXNoZWV0PWllO2Uuc2VyaWFsaXplPXRlO2Uuc2l6ZW9mPVM7ZS5zbGljZT1MO2Uuc3RyaW5naWZ5PW5lO2Uuc3RybGVuPU07ZS5zdWJzdHI9QztlLnRva2VuPUQ7ZS50b2tlbml6ZT1ZO2UudG9rZW5pemVyPUc7ZS50cmltPUU7ZS53aGl0ZXNwYWNlPUI7T2JqZWN0LmRlZmluZVByb3BlcnR5KGUsXCJfX2VzTW9kdWxlXCIse3ZhbHVlOnRydWV9KX0pKTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN0eWxpcy5qcy5tYXBcbiIsImltcG9ydCAqIGFzIFZpZXcgZnJvbSBcIkBpdGt5ay92aWV3XCI7XG5pbXBvcnQge2Nzc30gZnJvbSBcIkBlbW90aW9uL2Nzc1wiO1xuXG5jbGFzcyBDb2RlIGV4dGVuZHMgVmlldy5Db21wb25lbnQge1xuICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICBjb25zb2xlLmxvZyh0aGlzKVxuICAgIHRoaXMuaW5pdCgoKT0+e1xuXG4gICAgfSlcbiAgfVxuXG4gIHN0eWxlID0gKCkgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICB3cmFwOiBjc3Moe1xuICAgICAgICB3aWR0aDogXCIxMDAlXCJcbiAgICAgIH0pLFxuICAgICAgdGl0bGU6IGNzcyh7XG4gICAgICAgIGZvbnRTaXplOiBcIjIwcHhcIixcbiAgICAgICAgbWFyZ2luQm90dG9tOiBcIi01MHB4XCJcbiAgICAgIH0pXG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0ICgpID0+IFZpZXcuY3JlYXRlQ29tcG9uZW50KFwiLmNvZGVcIiwgQ29kZSk7IiwiaW1wb3J0ICogYXMgVmlldyBmcm9tIFwiQGl0a3lrL3ZpZXdcIjtcbmltcG9ydCB7Y3NzfSBmcm9tIFwiQGVtb3Rpb24vY3NzXCI7XG5cbmNsYXNzIFZpZXdQb3J0IGV4dGVuZHMgVmlldy5Db21wb25lbnQge1xuICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLmluaXQoKCk9PntcblxuICAgIH0pXG4gIH1cblxuICBzdHlsZSA9ICgpID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgd3JhcDogY3NzKHtcbiAgICAgICAgbWFyZ2luVG9wOiBcIjIwcHhcIlxuICAgICAgfSksXG4gICAgICB0aXRsZTogY3NzKHtcbiAgICAgICAgZm9udFNpemU6IFwiMjBweFwiLFxuICAgICAgICBtYXJnaW5Cb3R0b206IFwiMjBweFwiXG4gICAgICB9KSxcbiAgICAgIGNvbnRlbnRzOiBjc3Moe1xuICAgICAgICBib3JkZXI6IFwic29saWQgMXB4ICNjY2NcIlxuICAgICAgfSksXG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0ICgpID0+IFZpZXcuY3JlYXRlQ29tcG9uZW50KFwiLnZpZXdwb3J0XCIsIFZpZXdQb3J0KSIsImltcG9ydCAqIGFzIFZpZXcgZnJvbSBcIkBpdGt5ay92aWV3XCI7XG5pbXBvcnQge0N1c3RvbVNjcm9sbGJhcn0gZnJvbSBcIkBpdGt5ay9jdXN0b20tc2Nyb2xsYmFyXCI7XG5pbXBvcnQge2NzcywgaW5qZWN0R2xvYmFsfSBmcm9tIFwiQGVtb3Rpb24vY3NzXCI7XG5pbXBvcnQgQ29kZSBmcm9tIFwiLi4vLi4vY29tcG9uZW50cy9PcmdhbmlzbXMvQ29kZVwiO1xuaW1wb3J0IFZpZXdQb3J0IGZyb20gXCIuLi8uLi9jb21wb25lbnRzL09yZ2FuaXNtcy9WaWV3UG9ydFwiO1xuXG5jbGFzcyBTY3JvbGxlciBleHRlbmRzIFZpZXcuUGFnZSB7XG4gIHByaXZhdGUgc2Nyb2xsYmFyOiBDdXN0b21TY3JvbGxiYXI7XG4gIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgc3VwZXIocHJvcHMpO1xuICAgIHRoaXMuc2Nyb2xsYmFyID0gbnVsbDtcbiAgICB0aGlzLmluaXQoKCk9PntcbiAgICAgIHRoaXMuZ2xvYmFsU3R5bGUoKTtcbiAgICAgIHRoaXMuc3RhcnRTY3JvbGxCYXIoKTtcbiAgICB9KVxuICB9XG5cbiAgc3RhcnRTY3JvbGxCYXIgPSAoKSA9PiB7XG4gICAgdGhpcy5zY3JvbGxiYXIgPSBuZXcgQ3VzdG9tU2Nyb2xsYmFyKHRoaXMucmVmcy50YXJnZXQsIHt9KVxuICB9XG5cbiAgZ2xvYmFsU3R5bGUgPSAoKSA9PiB7XG4gICAgaW5qZWN0R2xvYmFsKHtcbiAgICAgIFwiYm9keVwiOiB7XG4gICAgICAgIHBhZGRpbmc6IFwiMjBweFwiXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIHN0eWxlID0gKCkgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50c1dyYXA6IGNzcyh7XG4gICAgICAgIGRpc3BsYXk6IFwiZ3JpZFwiLFxuICAgICAgICBncmlkVGVtcGxhdGVDb2x1bW5zOiBcIjUzMHB4IGNhbGMoMTAwdncgLSA1NzBweClcIixcbiAgICAgICAgaDI6IHtcbiAgICAgICAgICBmb250U2l6ZTogXCIyMHB4XCIsXG4gICAgICAgICAgZm9udFdlaWdodDogNTAwLFxuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHdyYXA6IGNzcyh7XG4gICAgICAgIHBvc2l0aW9uOiBcInJlbGF0aXZlXCIsXG4gICAgICAgIHdpZHRoOiBcIjUzMHB4XCIsXG4gICAgICAgIHBhZGRpbmdSaWdodDogXCIzMHB4XCIsXG4gICAgICB9KSxcbiAgICAgIGNvbnRlbnRzOiBjc3Moe1xuICAgICAgICB3aWR0aDogXCI1MDBweFwiLFxuICAgICAgICBoZWlnaHQ6IFwiNTAwcHhcIixcbiAgICAgICAgb3ZlcmZsb3c6IFwic2Nyb2xsXCIsXG4gICAgICAgIG1zT3ZlcmZsb3dTdHlsZTogXCJub25lXCIsXG4gICAgICAgIHNjcm9sbGJhcldpZHRoOiBcIm5vbmVcIixcbiAgICAgICAgXCImOjotd2Via2l0LXNjcm9sbGJhclwiOiB7XG4gICAgICAgICAgZGlzcGxheTogXCJub25lXCJcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICBzY3JvbGxXcmFwOiBjc3Moe1xuICAgICAgICBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLFxuICAgICAgICB0b3A6IFwiMjBweFwiLFxuICAgICAgICByaWdodDogXCIwXCIsXG4gICAgICAgIGhlaWdodDogXCI0NjBweFwiLFxuICAgICAgICB3aWR0aDogXCIxMHB4XCIsXG4gICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjY2NjXCIsXG4gICAgICB9KSxcbiAgICAgIHNjcm9sbEJhcjogY3NzKHtcbiAgICAgICAgcG9zaXRpb246IFwiYWJzb2x1dGVcIixcbiAgICAgICAgbGVmdDogMCxcbiAgICAgICAgdG9wOiAwLFxuICAgICAgICB3aWR0aDogXCIxMHB4XCIsXG4gICAgICAgIGhlaWdodDogXCI1MHB4XCIsXG4gICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjNTU1XCJcbiAgICAgIH0pLFxuICAgICAgY29kZXM6IGNzcyh7XG4gICAgICAgIGZvbnRTaXplOiBcIjEzcHghaW1wb3J0YW50XCJcbiAgICAgIH0pXG4gICAgfVxuICB9XG59XG5cblZpZXcuY3JlYXRlQ29tcG9uZW50KFwiI3Njcm9sbGJhclwiLCBTY3JvbGxlcik7XG5Db2RlKCk7XG5WaWV3UG9ydCgpOyJdfQ==
