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
        this.clickJS = (e) => {
            this.clearActive();
            const target = e.target;
            const tag = target.getAttribute("data-type");
            this.refs[tag].classList.add("is-active");
            target.classList.add("is-active");
        };
        this.clearActive = () => {
            const tags = ["js", "html", "css"];
            for (const tag of tags) {
                this.refs[tag].classList.remove("is-active");
            }
            const buttonArray = this.refs.buttons.querySelectorAll("button");
            for (const button of buttonArray) {
                button.classList.remove("is-active");
            }
        };
        this.style = () => {
            return {
                wrap: (0, css_1.css)({
                    width: "100%"
                }),
                title: (0, css_1.css)({
                    fontSize: "20px",
                    marginBottom: "-50px"
                }),
                codeBox: (0, css_1.css)({
                    display: "none",
                    "&.is-active": {
                        display: "block"
                    }
                }),
                buttons: (0, css_1.css)({
                    display: "grid",
                    gridTemplateColumns: "33% 33% 33%",
                    gridTemplateRows: "50px",
                    button: {
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#fff",
                        color: "#000",
                        border: "solid 1px #000",
                        "&.is-active": {
                            backgroundColor: "#000",
                            color: "#fff"
                        }
                    }
                })
            };
        };
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vY2FjaGUvZGlzdC9lbW90aW9uLWNhY2hlLmJyb3dzZXIuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL2Nzcy9jcmVhdGUtaW5zdGFuY2UvZGlzdC9lbW90aW9uLWNzcy1jcmVhdGUtaW5zdGFuY2UuY2pzLmRldi5qcyIsIm5vZGVfbW9kdWxlcy9AZW1vdGlvbi9jc3MvY3JlYXRlLWluc3RhbmNlL2Rpc3QvZW1vdGlvbi1jc3MtY3JlYXRlLWluc3RhbmNlLmNqcy5wcm9kLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL2Nzcy9kaXN0L2Vtb3Rpb24tY3NzLmNqcy5kZXYuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vY3NzL2Rpc3QvZW1vdGlvbi1jc3MuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL2Nzcy9kaXN0L2Vtb3Rpb24tY3NzLmNqcy5wcm9kLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL2hhc2gvZGlzdC9oYXNoLmJyb3dzZXIuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL21lbW9pemUvZGlzdC9lbW90aW9uLW1lbW9pemUuYnJvd3Nlci5janMuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vc2VyaWFsaXplL2Rpc3QvZW1vdGlvbi1zZXJpYWxpemUuYnJvd3Nlci5janMuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vc2hlZXQvZGlzdC9lbW90aW9uLXNoZWV0LmJyb3dzZXIuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL3VuaXRsZXNzL2Rpc3QvdW5pdGxlc3MuYnJvd3Nlci5janMuanMiLCJub2RlX21vZHVsZXMvQGVtb3Rpb24vdXRpbHMvZGlzdC9lbW90aW9uLXV0aWxzLmJyb3dzZXIuY2pzLmpzIiwibm9kZV9tb2R1bGVzL0BlbW90aW9uL3dlYWstbWVtb2l6ZS9kaXN0L3dlYWstbWVtb2l6ZS5icm93c2VyLmNqcy5qcyIsIm5vZGVfbW9kdWxlcy9AaXRreWsvY3VzdG9tLXNjcm9sbGJhci9kaXN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0BpdGt5ay9jdXN0b20tc2Nyb2xsYmFyL2Rpc3QvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9AaXRreWsvdmlldy9kaXN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9zdHlsaXMvZGlzdC91bWQvc3R5bGlzLmpzIiwic3JjL2Fzc2V0cy9qcy9jb21wb25lbnRzL09yZ2FuaXNtcy9Db2RlLnRzIiwic3JjL2Fzc2V0cy9qcy9jb21wb25lbnRzL09yZ2FuaXNtcy9WaWV3UG9ydC50cyIsInNyYy9hc3NldHMvanMvcGFnZXMvc2Nyb2xsYmFyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2hWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3BVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTs7OztBQ0ZBLG9DQUFvQztBQUNwQyxzQ0FBaUM7QUFFakMsTUFBTSxJQUFLLFNBQVEsSUFBSSxDQUFDLFNBQVM7SUFDL0IsWUFBWSxLQUFLO1FBQ2YsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBTWYsWUFBTyxHQUFHLENBQUMsQ0FBUSxFQUFFLEVBQUU7WUFDckIsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ25CLE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUEyQixDQUFDO1lBQzdDLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3BDLENBQUMsQ0FBQTtRQUVELGdCQUFXLEdBQUcsR0FBRyxFQUFFO1lBQ2pCLE1BQU0sSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNuQyxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRTtnQkFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQzlDO1lBQ0QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDakUsS0FBSyxNQUFNLE1BQU0sSUFBSSxXQUFXLEVBQUU7Z0JBQ2hDLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQ3RDO1FBQ0gsQ0FBQyxDQUFBO1FBRUQsVUFBSyxHQUFHLEdBQUcsRUFBRTtZQUNYLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLElBQUEsU0FBRyxFQUFDO29CQUNSLEtBQUssRUFBRSxNQUFNO2lCQUNkLENBQUM7Z0JBQ0YsS0FBSyxFQUFFLElBQUEsU0FBRyxFQUFDO29CQUNULFFBQVEsRUFBRSxNQUFNO29CQUNoQixZQUFZLEVBQUUsT0FBTztpQkFDdEIsQ0FBQztnQkFDRixPQUFPLEVBQUUsSUFBQSxTQUFHLEVBQUM7b0JBQ1gsT0FBTyxFQUFFLE1BQU07b0JBQ2YsYUFBYSxFQUFFO3dCQUNiLE9BQU8sRUFBRSxPQUFPO3FCQUNqQjtpQkFDRixDQUFDO2dCQUNGLE9BQU8sRUFBRSxJQUFBLFNBQUcsRUFBQztvQkFDWCxPQUFPLEVBQUUsTUFBTTtvQkFDZixtQkFBbUIsRUFBRSxhQUFhO29CQUNsQyxnQkFBZ0IsRUFBRSxNQUFNO29CQUN4QixNQUFNLEVBQUU7d0JBQ04sT0FBTyxFQUFFLE1BQU07d0JBQ2YsY0FBYyxFQUFFLFFBQVE7d0JBQ3hCLFVBQVUsRUFBRSxRQUFRO3dCQUNwQixLQUFLLEVBQUUsTUFBTTt3QkFDYixNQUFNLEVBQUUsTUFBTTt3QkFDZCxlQUFlLEVBQUUsTUFBTTt3QkFDdkIsS0FBSyxFQUFFLE1BQU07d0JBQ2IsTUFBTSxFQUFFLGdCQUFnQjt3QkFDeEIsYUFBYSxFQUFFOzRCQUNiLGVBQWUsRUFBRSxNQUFNOzRCQUN2QixLQUFLLEVBQUUsTUFBTTt5QkFDZDtxQkFDRjtpQkFDRixDQUFDO2FBQ0gsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQTNEQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUUsRUFBRTtRQUVkLENBQUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQXlERjtBQUVELGtCQUFlLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDOzs7OztBQ3BFekQsb0NBQW9DO0FBQ3BDLHNDQUFpQztBQUVqQyxNQUFNLFFBQVMsU0FBUSxJQUFJLENBQUMsU0FBUztJQUNuQyxZQUFZLEtBQUs7UUFDZixLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7UUFNZixVQUFLLEdBQUcsR0FBRyxFQUFFO1lBQ1gsT0FBTztnQkFDTCxJQUFJLEVBQUUsSUFBQSxTQUFHLEVBQUM7b0JBQ1IsU0FBUyxFQUFFLE1BQU07aUJBQ2xCLENBQUM7Z0JBQ0YsS0FBSyxFQUFFLElBQUEsU0FBRyxFQUFDO29CQUNULFFBQVEsRUFBRSxNQUFNO29CQUNoQixZQUFZLEVBQUUsTUFBTTtpQkFDckIsQ0FBQztnQkFDRixRQUFRLEVBQUUsSUFBQSxTQUFHLEVBQUM7b0JBQ1osTUFBTSxFQUFFLGdCQUFnQjtpQkFDekIsQ0FBQzthQUNILENBQUE7UUFDSCxDQUFDLENBQUE7UUFsQkMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFFLEVBQUU7UUFFZCxDQUFDLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FnQkY7QUFFRCxrQkFBZSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQTs7Ozs7QUMzQmhFLG9DQUFvQztBQUNwQyw4REFBd0Q7QUFDeEQsc0NBQStDO0FBQy9DLDBEQUFtRDtBQUNuRCxrRUFBMkQ7QUFFM0QsTUFBTSxRQUFTLFNBQVEsSUFBSSxDQUFDLElBQUk7SUFFOUIsWUFBWSxLQUFLO1FBQ2YsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBUWYsbUJBQWMsR0FBRyxHQUFHLEVBQUU7WUFDcEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLGtDQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFDNUQsQ0FBQyxDQUFBO1FBRUQsZ0JBQVcsR0FBRyxHQUFHLEVBQUU7WUFDakIsSUFBQSxrQkFBWSxFQUFDO2dCQUNYLE1BQU0sRUFBRTtvQkFDTixPQUFPLEVBQUUsTUFBTTtpQkFDaEI7YUFDRixDQUFDLENBQUE7UUFDSixDQUFDLENBQUE7UUFFRCxVQUFLLEdBQUcsR0FBRyxFQUFFO1lBQ1gsT0FBTztnQkFDTCxZQUFZLEVBQUUsSUFBQSxTQUFHLEVBQUM7b0JBQ2hCLE9BQU8sRUFBRSxNQUFNO29CQUNmLG1CQUFtQixFQUFFLDJCQUEyQjtvQkFDaEQsRUFBRSxFQUFFO3dCQUNGLFFBQVEsRUFBRSxNQUFNO3dCQUNoQixVQUFVLEVBQUUsR0FBRztxQkFDaEI7aUJBQ0YsQ0FBQztnQkFDRixJQUFJLEVBQUUsSUFBQSxTQUFHLEVBQUM7b0JBQ1IsUUFBUSxFQUFFLFVBQVU7b0JBQ3BCLEtBQUssRUFBRSxPQUFPO29CQUNkLFlBQVksRUFBRSxNQUFNO2lCQUNyQixDQUFDO2dCQUNGLFFBQVEsRUFBRSxJQUFBLFNBQUcsRUFBQztvQkFDWixLQUFLLEVBQUUsT0FBTztvQkFDZCxNQUFNLEVBQUUsT0FBTztvQkFDZixRQUFRLEVBQUUsUUFBUTtvQkFDbEIsZUFBZSxFQUFFLE1BQU07b0JBQ3ZCLGNBQWMsRUFBRSxNQUFNO29CQUN0QixzQkFBc0IsRUFBRTt3QkFDdEIsT0FBTyxFQUFFLE1BQU07cUJBQ2hCO2lCQUNGLENBQUM7Z0JBQ0YsVUFBVSxFQUFFLElBQUEsU0FBRyxFQUFDO29CQUNkLFFBQVEsRUFBRSxVQUFVO29CQUNwQixHQUFHLEVBQUUsTUFBTTtvQkFDWCxLQUFLLEVBQUUsR0FBRztvQkFDVixNQUFNLEVBQUUsT0FBTztvQkFDZixLQUFLLEVBQUUsTUFBTTtvQkFDYixlQUFlLEVBQUUsTUFBTTtpQkFDeEIsQ0FBQztnQkFDRixTQUFTLEVBQUUsSUFBQSxTQUFHLEVBQUM7b0JBQ2IsUUFBUSxFQUFFLFVBQVU7b0JBQ3BCLElBQUksRUFBRSxDQUFDO29CQUNQLEdBQUcsRUFBRSxDQUFDO29CQUNOLEtBQUssRUFBRSxNQUFNO29CQUNiLE1BQU0sRUFBRSxNQUFNO29CQUNkLGVBQWUsRUFBRSxNQUFNO2lCQUN4QixDQUFDO2dCQUNGLEtBQUssRUFBRSxJQUFBLFNBQUcsRUFBQztvQkFDVCxRQUFRLEVBQUUsZ0JBQWdCO2lCQUMzQixDQUFDO2FBQ0gsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQWhFQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztRQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUUsRUFBRTtZQUNaLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNuQixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUE7SUFDSixDQUFDO0NBNERGO0FBRUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDN0MsSUFBQSxjQUFJLEdBQUUsQ0FBQztBQUNQLElBQUEsa0JBQVEsR0FBRSxDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xuXG52YXIgc2hlZXQgPSByZXF1aXJlKCdAZW1vdGlvbi9zaGVldCcpO1xudmFyIHN0eWxpcyA9IHJlcXVpcmUoJ3N0eWxpcycpO1xucmVxdWlyZSgnQGVtb3Rpb24vd2Vhay1tZW1vaXplJyk7XG5yZXF1aXJlKCdAZW1vdGlvbi9tZW1vaXplJyk7XG5cbnZhciBsYXN0ID0gZnVuY3Rpb24gbGFzdChhcnIpIHtcbiAgcmV0dXJuIGFyci5sZW5ndGggPyBhcnJbYXJyLmxlbmd0aCAtIDFdIDogbnVsbDtcbn07IC8vIGJhc2VkIG9uIGh0dHBzOi8vZ2l0aHViLmNvbS90aHlzdWx0YW4vc3R5bGlzLmpzL2Jsb2IvZTY4NDNjMzczZWJjYmJmYWRlMjVlYmNjMjNmNTQwZWQ4NTA4ZGEwYS9zcmMvVG9rZW5pemVyLmpzI0wyMzktTDI0NFxuXG5cbnZhciBpZGVudGlmaWVyV2l0aFBvaW50VHJhY2tpbmcgPSBmdW5jdGlvbiBpZGVudGlmaWVyV2l0aFBvaW50VHJhY2tpbmcoYmVnaW4sIHBvaW50cywgaW5kZXgpIHtcbiAgdmFyIHByZXZpb3VzID0gMDtcbiAgdmFyIGNoYXJhY3RlciA9IDA7XG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBwcmV2aW91cyA9IGNoYXJhY3RlcjtcbiAgICBjaGFyYWN0ZXIgPSBzdHlsaXMucGVlaygpOyAvLyAmXFxmXG5cbiAgICBpZiAocHJldmlvdXMgPT09IDM4ICYmIGNoYXJhY3RlciA9PT0gMTIpIHtcbiAgICAgIHBvaW50c1tpbmRleF0gPSAxO1xuICAgIH1cblxuICAgIGlmIChzdHlsaXMudG9rZW4oY2hhcmFjdGVyKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgc3R5bGlzLm5leHQoKTtcbiAgfVxuXG4gIHJldHVybiBzdHlsaXMuc2xpY2UoYmVnaW4sIHN0eWxpcy5wb3NpdGlvbik7XG59O1xuXG52YXIgdG9SdWxlcyA9IGZ1bmN0aW9uIHRvUnVsZXMocGFyc2VkLCBwb2ludHMpIHtcbiAgLy8gcHJldGVuZCB3ZSd2ZSBzdGFydGVkIHdpdGggYSBjb21tYVxuICB2YXIgaW5kZXggPSAtMTtcbiAgdmFyIGNoYXJhY3RlciA9IDQ0O1xuXG4gIGRvIHtcbiAgICBzd2l0Y2ggKHN0eWxpcy50b2tlbihjaGFyYWN0ZXIpKSB7XG4gICAgICBjYXNlIDA6XG4gICAgICAgIC8vICZcXGZcbiAgICAgICAgaWYgKGNoYXJhY3RlciA9PT0gMzggJiYgc3R5bGlzLnBlZWsoKSA9PT0gMTIpIHtcbiAgICAgICAgICAvLyB0aGlzIGlzIG5vdCAxMDAlIGNvcnJlY3QsIHdlIGRvbid0IGFjY291bnQgZm9yIGxpdGVyYWwgc2VxdWVuY2VzIGhlcmUgLSBsaWtlIGZvciBleGFtcGxlIHF1b3RlZCBzdHJpbmdzXG4gICAgICAgICAgLy8gc3R5bGlzIGluc2VydHMgXFxmIGFmdGVyICYgdG8ga25vdyB3aGVuICYgd2hlcmUgaXQgc2hvdWxkIHJlcGxhY2UgdGhpcyBzZXF1ZW5jZSB3aXRoIHRoZSBjb250ZXh0IHNlbGVjdG9yXG4gICAgICAgICAgLy8gYW5kIHdoZW4gaXQgc2hvdWxkIGp1c3QgY29uY2F0ZW5hdGUgdGhlIG91dGVyIGFuZCBpbm5lciBzZWxlY3RvcnNcbiAgICAgICAgICAvLyBpdCdzIHZlcnkgdW5saWtlbHkgZm9yIHRoaXMgc2VxdWVuY2UgdG8gYWN0dWFsbHkgYXBwZWFyIGluIGEgZGlmZmVyZW50IGNvbnRleHQsIHNvIHdlIGp1c3QgbGV2ZXJhZ2UgdGhpcyBmYWN0IGhlcmVcbiAgICAgICAgICBwb2ludHNbaW5kZXhdID0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcnNlZFtpbmRleF0gKz0gaWRlbnRpZmllcldpdGhQb2ludFRyYWNraW5nKHN0eWxpcy5wb3NpdGlvbiAtIDEsIHBvaW50cywgaW5kZXgpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAyOlxuICAgICAgICBwYXJzZWRbaW5kZXhdICs9IHN0eWxpcy5kZWxpbWl0KGNoYXJhY3Rlcik7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIDQ6XG4gICAgICAgIC8vIGNvbW1hXG4gICAgICAgIGlmIChjaGFyYWN0ZXIgPT09IDQ0KSB7XG4gICAgICAgICAgLy8gY29sb25cbiAgICAgICAgICBwYXJzZWRbKytpbmRleF0gPSBzdHlsaXMucGVlaygpID09PSA1OCA/ICcmXFxmJyA6ICcnO1xuICAgICAgICAgIHBvaW50c1tpbmRleF0gPSBwYXJzZWRbaW5kZXhdLmxlbmd0aDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAvLyBmYWxsdGhyb3VnaFxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBwYXJzZWRbaW5kZXhdICs9IHN0eWxpcy5mcm9tKGNoYXJhY3Rlcik7XG4gICAgfVxuICB9IHdoaWxlIChjaGFyYWN0ZXIgPSBzdHlsaXMubmV4dCgpKTtcblxuICByZXR1cm4gcGFyc2VkO1xufTtcblxudmFyIGdldFJ1bGVzID0gZnVuY3Rpb24gZ2V0UnVsZXModmFsdWUsIHBvaW50cykge1xuICByZXR1cm4gc3R5bGlzLmRlYWxsb2ModG9SdWxlcyhzdHlsaXMuYWxsb2ModmFsdWUpLCBwb2ludHMpKTtcbn07IC8vIFdlYWtTZXQgd291bGQgYmUgbW9yZSBhcHByb3ByaWF0ZSwgYnV0IG9ubHkgV2Vha01hcCBpcyBzdXBwb3J0ZWQgaW4gSUUxMVxuXG5cbnZhciBmaXhlZEVsZW1lbnRzID0gLyogI19fUFVSRV9fICovbmV3IFdlYWtNYXAoKTtcbnZhciBjb21wYXQgPSBmdW5jdGlvbiBjb21wYXQoZWxlbWVudCkge1xuICBpZiAoZWxlbWVudC50eXBlICE9PSAncnVsZScgfHwgIWVsZW1lbnQucGFyZW50IHx8IC8vIHBvc2l0aXZlIC5sZW5ndGggaW5kaWNhdGVzIHRoYXQgdGhpcyBydWxlIGNvbnRhaW5zIHBzZXVkb1xuICAvLyBuZWdhdGl2ZSAubGVuZ3RoIGluZGljYXRlcyB0aGF0IHRoaXMgcnVsZSBoYXMgYmVlbiBhbHJlYWR5IHByZWZpeGVkXG4gIGVsZW1lbnQubGVuZ3RoIDwgMSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciB2YWx1ZSA9IGVsZW1lbnQudmFsdWUsXG4gICAgICBwYXJlbnQgPSBlbGVtZW50LnBhcmVudDtcbiAgdmFyIGlzSW1wbGljaXRSdWxlID0gZWxlbWVudC5jb2x1bW4gPT09IHBhcmVudC5jb2x1bW4gJiYgZWxlbWVudC5saW5lID09PSBwYXJlbnQubGluZTtcblxuICB3aGlsZSAocGFyZW50LnR5cGUgIT09ICdydWxlJykge1xuICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgaWYgKCFwYXJlbnQpIHJldHVybjtcbiAgfSAvLyBzaG9ydC1jaXJjdWl0IGZvciB0aGUgc2ltcGxlc3QgY2FzZVxuXG5cbiAgaWYgKGVsZW1lbnQucHJvcHMubGVuZ3RoID09PSAxICYmIHZhbHVlLmNoYXJDb2RlQXQoMCkgIT09IDU4XG4gIC8qIGNvbG9uICovXG4gICYmICFmaXhlZEVsZW1lbnRzLmdldChwYXJlbnQpKSB7XG4gICAgcmV0dXJuO1xuICB9IC8vIGlmIHRoaXMgaXMgYW4gaW1wbGljaXRseSBpbnNlcnRlZCBydWxlICh0aGUgb25lIGVhZ2VybHkgaW5zZXJ0ZWQgYXQgdGhlIGVhY2ggbmV3IG5lc3RlZCBsZXZlbClcbiAgLy8gdGhlbiB0aGUgcHJvcHMgaGFzIGFscmVhZHkgYmVlbiBtYW5pcHVsYXRlZCBiZWZvcmVoYW5kIGFzIHRoZXkgdGhhdCBhcnJheSBpcyBzaGFyZWQgYmV0d2VlbiBpdCBhbmQgaXRzIFwicnVsZSBwYXJlbnRcIlxuXG5cbiAgaWYgKGlzSW1wbGljaXRSdWxlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZml4ZWRFbGVtZW50cy5zZXQoZWxlbWVudCwgdHJ1ZSk7XG4gIHZhciBwb2ludHMgPSBbXTtcbiAgdmFyIHJ1bGVzID0gZ2V0UnVsZXModmFsdWUsIHBvaW50cyk7XG4gIHZhciBwYXJlbnRSdWxlcyA9IHBhcmVudC5wcm9wcztcblxuICBmb3IgKHZhciBpID0gMCwgayA9IDA7IGkgPCBydWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgcGFyZW50UnVsZXMubGVuZ3RoOyBqKyssIGsrKykge1xuICAgICAgZWxlbWVudC5wcm9wc1trXSA9IHBvaW50c1tpXSA/IHJ1bGVzW2ldLnJlcGxhY2UoLyZcXGYvZywgcGFyZW50UnVsZXNbal0pIDogcGFyZW50UnVsZXNbal0gKyBcIiBcIiArIHJ1bGVzW2ldO1xuICAgIH1cbiAgfVxufTtcbnZhciByZW1vdmVMYWJlbCA9IGZ1bmN0aW9uIHJlbW92ZUxhYmVsKGVsZW1lbnQpIHtcbiAgaWYgKGVsZW1lbnQudHlwZSA9PT0gJ2RlY2wnKSB7XG4gICAgdmFyIHZhbHVlID0gZWxlbWVudC52YWx1ZTtcblxuICAgIGlmICggLy8gY2hhcmNvZGUgZm9yIGxcbiAgICB2YWx1ZS5jaGFyQ29kZUF0KDApID09PSAxMDggJiYgLy8gY2hhcmNvZGUgZm9yIGJcbiAgICB2YWx1ZS5jaGFyQ29kZUF0KDIpID09PSA5OCkge1xuICAgICAgLy8gdGhpcyBpZ25vcmVzIGxhYmVsXG4gICAgICBlbGVtZW50W1wicmV0dXJuXCJdID0gJyc7XG4gICAgICBlbGVtZW50LnZhbHVlID0gJyc7XG4gICAgfVxuICB9XG59O1xudmFyIGlnbm9yZUZsYWcgPSAnZW1vdGlvbi1kaXNhYmxlLXNlcnZlci1yZW5kZXJpbmctdW5zYWZlLXNlbGVjdG9yLXdhcm5pbmctcGxlYXNlLWRvLW5vdC11c2UtdGhpcy10aGUtd2FybmluZy1leGlzdHMtZm9yLWEtcmVhc29uJztcblxudmFyIGlzSWdub3JpbmdDb21tZW50ID0gZnVuY3Rpb24gaXNJZ25vcmluZ0NvbW1lbnQoZWxlbWVudCkge1xuICByZXR1cm4gISFlbGVtZW50ICYmIGVsZW1lbnQudHlwZSA9PT0gJ2NvbW0nICYmIGVsZW1lbnQuY2hpbGRyZW4uaW5kZXhPZihpZ25vcmVGbGFnKSA+IC0xO1xufTtcblxudmFyIGNyZWF0ZVVuc2FmZVNlbGVjdG9yc0FsYXJtID0gZnVuY3Rpb24gY3JlYXRlVW5zYWZlU2VsZWN0b3JzQWxhcm0oY2FjaGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChlbGVtZW50LCBpbmRleCwgY2hpbGRyZW4pIHtcbiAgICBpZiAoZWxlbWVudC50eXBlICE9PSAncnVsZScpIHJldHVybjtcbiAgICB2YXIgdW5zYWZlUHNldWRvQ2xhc3NlcyA9IGVsZW1lbnQudmFsdWUubWF0Y2goLyg6Zmlyc3R8Om50aHw6bnRoLWxhc3QpLWNoaWxkL2cpO1xuXG4gICAgaWYgKHVuc2FmZVBzZXVkb0NsYXNzZXMgJiYgY2FjaGUuY29tcGF0ICE9PSB0cnVlKSB7XG4gICAgICB2YXIgcHJldkVsZW1lbnQgPSBpbmRleCA+IDAgPyBjaGlsZHJlbltpbmRleCAtIDFdIDogbnVsbDtcblxuICAgICAgaWYgKHByZXZFbGVtZW50ICYmIGlzSWdub3JpbmdDb21tZW50KGxhc3QocHJldkVsZW1lbnQuY2hpbGRyZW4pKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHVuc2FmZVBzZXVkb0NsYXNzZXMuZm9yRWFjaChmdW5jdGlvbiAodW5zYWZlUHNldWRvQ2xhc3MpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIlRoZSBwc2V1ZG8gY2xhc3MgXFxcIlwiICsgdW5zYWZlUHNldWRvQ2xhc3MgKyBcIlxcXCIgaXMgcG90ZW50aWFsbHkgdW5zYWZlIHdoZW4gZG9pbmcgc2VydmVyLXNpZGUgcmVuZGVyaW5nLiBUcnkgY2hhbmdpbmcgaXQgdG8gXFxcIlwiICsgdW5zYWZlUHNldWRvQ2xhc3Muc3BsaXQoJy1jaGlsZCcpWzBdICsgXCItb2YtdHlwZVxcXCIuXCIpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xufTtcblxudmFyIGlzSW1wb3J0UnVsZSA9IGZ1bmN0aW9uIGlzSW1wb3J0UnVsZShlbGVtZW50KSB7XG4gIHJldHVybiBlbGVtZW50LnR5cGUuY2hhckNvZGVBdCgxKSA9PT0gMTA1ICYmIGVsZW1lbnQudHlwZS5jaGFyQ29kZUF0KDApID09PSA2NDtcbn07XG5cbnZhciBpc1ByZXBlbmRlZFdpdGhSZWd1bGFyUnVsZXMgPSBmdW5jdGlvbiBpc1ByZXBlbmRlZFdpdGhSZWd1bGFyUnVsZXMoaW5kZXgsIGNoaWxkcmVuKSB7XG4gIGZvciAodmFyIGkgPSBpbmRleCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKCFpc0ltcG9ydFJ1bGUoY2hpbGRyZW5baV0pKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59OyAvLyB1c2UgdGhpcyB0byByZW1vdmUgaW5jb3JyZWN0IGVsZW1lbnRzIGZyb20gZnVydGhlciBwcm9jZXNzaW5nXG4vLyBzbyB0aGV5IGRvbid0IGdldCBoYW5kZWQgdG8gdGhlIGBzaGVldGAgKG9yIGFueXRoaW5nIGVsc2UpXG4vLyBhcyB0aGF0IGNvdWxkIHBvdGVudGlhbGx5IGxlYWQgdG8gYWRkaXRpb25hbCBsb2dzIHdoaWNoIGluIHR1cm4gY291bGQgYmUgb3ZlcmhlbG1pbmcgdG8gdGhlIHVzZXJcblxuXG52YXIgbnVsbGlmeUVsZW1lbnQgPSBmdW5jdGlvbiBudWxsaWZ5RWxlbWVudChlbGVtZW50KSB7XG4gIGVsZW1lbnQudHlwZSA9ICcnO1xuICBlbGVtZW50LnZhbHVlID0gJyc7XG4gIGVsZW1lbnRbXCJyZXR1cm5cIl0gPSAnJztcbiAgZWxlbWVudC5jaGlsZHJlbiA9ICcnO1xuICBlbGVtZW50LnByb3BzID0gJyc7XG59O1xuXG52YXIgaW5jb3JyZWN0SW1wb3J0QWxhcm0gPSBmdW5jdGlvbiBpbmNvcnJlY3RJbXBvcnRBbGFybShlbGVtZW50LCBpbmRleCwgY2hpbGRyZW4pIHtcbiAgaWYgKCFpc0ltcG9ydFJ1bGUoZWxlbWVudCkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoZWxlbWVudC5wYXJlbnQpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiYEBpbXBvcnRgIHJ1bGVzIGNhbid0IGJlIG5lc3RlZCBpbnNpZGUgb3RoZXIgcnVsZXMuIFBsZWFzZSBtb3ZlIGl0IHRvIHRoZSB0b3AgbGV2ZWwgYW5kIHB1dCBpdCBiZWZvcmUgcmVndWxhciBydWxlcy4gS2VlcCBpbiBtaW5kIHRoYXQgdGhleSBjYW4gb25seSBiZSB1c2VkIHdpdGhpbiBnbG9iYWwgc3R5bGVzLlwiKTtcbiAgICBudWxsaWZ5RWxlbWVudChlbGVtZW50KTtcbiAgfSBlbHNlIGlmIChpc1ByZXBlbmRlZFdpdGhSZWd1bGFyUnVsZXMoaW5kZXgsIGNoaWxkcmVuKSkge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJgQGltcG9ydGAgcnVsZXMgY2FuJ3QgYmUgYWZ0ZXIgb3RoZXIgcnVsZXMuIFBsZWFzZSBwdXQgeW91ciBgQGltcG9ydGAgcnVsZXMgYmVmb3JlIHlvdXIgb3RoZXIgcnVsZXMuXCIpO1xuICAgIG51bGxpZnlFbGVtZW50KGVsZW1lbnQpO1xuICB9XG59O1xuXG52YXIgZGVmYXVsdFN0eWxpc1BsdWdpbnMgPSBbc3R5bGlzLnByZWZpeGVyXTtcblxudmFyIGNyZWF0ZUNhY2hlID0gZnVuY3Rpb24gY3JlYXRlQ2FjaGUob3B0aW9ucykge1xuICB2YXIga2V5ID0gb3B0aW9ucy5rZXk7XG5cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgIWtleSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIllvdSBoYXZlIHRvIGNvbmZpZ3VyZSBga2V5YCBmb3IgeW91ciBjYWNoZS4gUGxlYXNlIG1ha2Ugc3VyZSBpdCdzIHVuaXF1ZSAoYW5kIG5vdCBlcXVhbCB0byAnY3NzJykgYXMgaXQncyB1c2VkIGZvciBsaW5raW5nIHN0eWxlcyB0byB5b3VyIGNhY2hlLlxcblwiICsgXCJJZiBtdWx0aXBsZSBjYWNoZXMgc2hhcmUgdGhlIHNhbWUga2V5IHRoZXkgbWlnaHQgXFxcImZpZ2h0XFxcIiBmb3IgZWFjaCBvdGhlcidzIHN0eWxlIGVsZW1lbnRzLlwiKTtcbiAgfVxuXG4gIGlmICgga2V5ID09PSAnY3NzJykge1xuICAgIHZhciBzc3JTdHlsZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwic3R5bGVbZGF0YS1lbW90aW9uXTpub3QoW2RhdGEtc10pXCIpOyAvLyBnZXQgU1NSZWQgc3R5bGVzIG91dCBvZiB0aGUgd2F5IG9mIFJlYWN0J3MgaHlkcmF0aW9uXG4gICAgLy8gZG9jdW1lbnQuaGVhZCBpcyBhIHNhZmUgcGxhY2UgdG8gbW92ZSB0aGVtIHRvKHRob3VnaCBub3RlIGRvY3VtZW50LmhlYWQgaXMgbm90IG5lY2Vzc2FyaWx5IHRoZSBsYXN0IHBsYWNlIHRoZXkgd2lsbCBiZSlcbiAgICAvLyBub3RlIHRoaXMgdmVyeSB2ZXJ5IGludGVudGlvbmFsbHkgdGFyZ2V0cyBhbGwgc3R5bGUgZWxlbWVudHMgcmVnYXJkbGVzcyBvZiB0aGUga2V5IHRvIGVuc3VyZVxuICAgIC8vIHRoYXQgY3JlYXRpbmcgYSBjYWNoZSB3b3JrcyBpbnNpZGUgb2YgcmVuZGVyIG9mIGEgUmVhY3QgY29tcG9uZW50XG5cbiAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHNzclN0eWxlcywgZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgIC8vIHdlIHdhbnQgdG8gb25seSBtb3ZlIGVsZW1lbnRzIHdoaWNoIGhhdmUgYSBzcGFjZSBpbiB0aGUgZGF0YS1lbW90aW9uIGF0dHJpYnV0ZSB2YWx1ZVxuICAgICAgLy8gYmVjYXVzZSB0aGF0IGluZGljYXRlcyB0aGF0IGl0IGlzIGFuIEVtb3Rpb24gMTEgc2VydmVyLXNpZGUgcmVuZGVyZWQgc3R5bGUgZWxlbWVudHNcbiAgICAgIC8vIHdoaWxlIHdlIHdpbGwgYWxyZWFkeSBpZ25vcmUgRW1vdGlvbiAxMSBjbGllbnQtc2lkZSBpbnNlcnRlZCBzdHlsZXMgYmVjYXVzZSBvZiB0aGUgOm5vdChbZGF0YS1zXSkgcGFydCBpbiB0aGUgc2VsZWN0b3JcbiAgICAgIC8vIEVtb3Rpb24gMTAgY2xpZW50LXNpZGUgaW5zZXJ0ZWQgc3R5bGVzIGRpZCBub3QgaGF2ZSBkYXRhLXMgKGJ1dCBpbXBvcnRhbnRseSBkaWQgbm90IGhhdmUgYSBzcGFjZSBpbiB0aGVpciBkYXRhLWVtb3Rpb24gYXR0cmlidXRlcylcbiAgICAgIC8vIHNvIGNoZWNraW5nIGZvciB0aGUgc3BhY2UgZW5zdXJlcyB0aGF0IGxvYWRpbmcgRW1vdGlvbiAxMSBhZnRlciBFbW90aW9uIDEwIGhhcyBpbnNlcnRlZCBzb21lIHN0eWxlc1xuICAgICAgLy8gd2lsbCBub3QgcmVzdWx0IGluIHRoZSBFbW90aW9uIDEwIHN0eWxlcyBiZWluZyBkZXN0cm95ZWRcbiAgICAgIHZhciBkYXRhRW1vdGlvbkF0dHJpYnV0ZSA9IG5vZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWVtb3Rpb24nKTtcblxuICAgICAgaWYgKGRhdGFFbW90aW9uQXR0cmlidXRlLmluZGV4T2YoJyAnKSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChub2RlKTtcbiAgICAgIG5vZGUuc2V0QXR0cmlidXRlKCdkYXRhLXMnLCAnJyk7XG4gICAgfSk7XG4gIH1cblxuICB2YXIgc3R5bGlzUGx1Z2lucyA9IG9wdGlvbnMuc3R5bGlzUGx1Z2lucyB8fCBkZWZhdWx0U3R5bGlzUGx1Z2lucztcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIC8vICRGbG93Rml4TWVcbiAgICBpZiAoL1teYS16LV0vLnRlc3Qoa2V5KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW1vdGlvbiBrZXkgbXVzdCBvbmx5IGNvbnRhaW4gbG93ZXIgY2FzZSBhbHBoYWJldGljYWwgY2hhcmFjdGVycyBhbmQgLSBidXQgXFxcIlwiICsga2V5ICsgXCJcXFwiIHdhcyBwYXNzZWRcIik7XG4gICAgfVxuICB9XG5cbiAgdmFyIGluc2VydGVkID0ge307IC8vICRGbG93Rml4TWVcblxuICB2YXIgY29udGFpbmVyO1xuICB2YXIgbm9kZXNUb0h5ZHJhdGUgPSBbXTtcblxuICB7XG4gICAgY29udGFpbmVyID0gb3B0aW9ucy5jb250YWluZXIgfHwgZG9jdW1lbnQuaGVhZDtcbiAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCAvLyB0aGlzIG1lYW5zIHdlIHdpbGwgaWdub3JlIGVsZW1lbnRzIHdoaWNoIGRvbid0IGhhdmUgYSBzcGFjZSBpbiB0aGVtIHdoaWNoXG4gICAgLy8gbWVhbnMgdGhhdCB0aGUgc3R5bGUgZWxlbWVudHMgd2UncmUgbG9va2luZyBhdCBhcmUgb25seSBFbW90aW9uIDExIHNlcnZlci1yZW5kZXJlZCBzdHlsZSBlbGVtZW50c1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJzdHlsZVtkYXRhLWVtb3Rpb25ePVxcXCJcIiArIGtleSArIFwiIFxcXCJdXCIpLCBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgdmFyIGF0dHJpYiA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiZGF0YS1lbW90aW9uXCIpLnNwbGl0KCcgJyk7IC8vICRGbG93Rml4TWVcblxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhdHRyaWIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaW5zZXJ0ZWRbYXR0cmliW2ldXSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIG5vZGVzVG9IeWRyYXRlLnB1c2gobm9kZSk7XG4gICAgfSk7XG4gIH1cblxuICB2YXIgX2luc2VydDtcblxuICB2YXIgb21uaXByZXNlbnRQbHVnaW5zID0gW2NvbXBhdCwgcmVtb3ZlTGFiZWxdO1xuXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgb21uaXByZXNlbnRQbHVnaW5zLnB1c2goY3JlYXRlVW5zYWZlU2VsZWN0b3JzQWxhcm0oe1xuICAgICAgZ2V0IGNvbXBhdCgpIHtcbiAgICAgICAgcmV0dXJuIGNhY2hlLmNvbXBhdDtcbiAgICAgIH1cblxuICAgIH0pLCBpbmNvcnJlY3RJbXBvcnRBbGFybSk7XG4gIH1cblxuICB7XG4gICAgdmFyIGN1cnJlbnRTaGVldDtcbiAgICB2YXIgZmluYWxpemluZ1BsdWdpbnMgPSBbc3R5bGlzLnN0cmluZ2lmeSwgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICBpZiAoIWVsZW1lbnQucm9vdCkge1xuICAgICAgICBpZiAoZWxlbWVudFtcInJldHVyblwiXSkge1xuICAgICAgICAgIGN1cnJlbnRTaGVldC5pbnNlcnQoZWxlbWVudFtcInJldHVyblwiXSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudC52YWx1ZSAmJiBlbGVtZW50LnR5cGUgIT09IHN0eWxpcy5DT01NRU5UKSB7XG4gICAgICAgICAgLy8gaW5zZXJ0IGVtcHR5IHJ1bGUgaW4gbm9uLXByb2R1Y3Rpb24gZW52aXJvbm1lbnRzXG4gICAgICAgICAgLy8gc28gQGVtb3Rpb24vamVzdCBjYW4gZ3JhYiBga2V5YCBmcm9tIHRoZSAoSlMpRE9NIGZvciBjYWNoZXMgd2l0aG91dCBhbnkgcnVsZXMgaW5zZXJ0ZWQgeWV0XG4gICAgICAgICAgY3VycmVudFNoZWV0Lmluc2VydChlbGVtZW50LnZhbHVlICsgXCJ7fVwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gOiBzdHlsaXMucnVsZXNoZWV0KGZ1bmN0aW9uIChydWxlKSB7XG4gICAgICBjdXJyZW50U2hlZXQuaW5zZXJ0KHJ1bGUpO1xuICAgIH0pXTtcbiAgICB2YXIgc2VyaWFsaXplciA9IHN0eWxpcy5taWRkbGV3YXJlKG9tbmlwcmVzZW50UGx1Z2lucy5jb25jYXQoc3R5bGlzUGx1Z2lucywgZmluYWxpemluZ1BsdWdpbnMpKTtcblxuICAgIHZhciBzdHlsaXMkMSA9IGZ1bmN0aW9uIHN0eWxpcyQxKHN0eWxlcykge1xuICAgICAgcmV0dXJuIHN0eWxpcy5zZXJpYWxpemUoc3R5bGlzLmNvbXBpbGUoc3R5bGVzKSwgc2VyaWFsaXplcik7XG4gICAgfTtcblxuICAgIF9pbnNlcnQgPSBmdW5jdGlvbiBpbnNlcnQoc2VsZWN0b3IsIHNlcmlhbGl6ZWQsIHNoZWV0LCBzaG91bGRDYWNoZSkge1xuICAgICAgY3VycmVudFNoZWV0ID0gc2hlZXQ7XG5cbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHNlcmlhbGl6ZWQubWFwICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3VycmVudFNoZWV0ID0ge1xuICAgICAgICAgIGluc2VydDogZnVuY3Rpb24gaW5zZXJ0KHJ1bGUpIHtcbiAgICAgICAgICAgIHNoZWV0Lmluc2VydChydWxlICsgc2VyaWFsaXplZC5tYXApO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgc3R5bGlzJDEoc2VsZWN0b3IgPyBzZWxlY3RvciArIFwie1wiICsgc2VyaWFsaXplZC5zdHlsZXMgKyBcIn1cIiA6IHNlcmlhbGl6ZWQuc3R5bGVzKTtcblxuICAgICAgaWYgKHNob3VsZENhY2hlKSB7XG4gICAgICAgIGNhY2hlLmluc2VydGVkW3NlcmlhbGl6ZWQubmFtZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICB2YXIgY2FjaGUgPSB7XG4gICAga2V5OiBrZXksXG4gICAgc2hlZXQ6IG5ldyBzaGVldC5TdHlsZVNoZWV0KHtcbiAgICAgIGtleToga2V5LFxuICAgICAgY29udGFpbmVyOiBjb250YWluZXIsXG4gICAgICBub25jZTogb3B0aW9ucy5ub25jZSxcbiAgICAgIHNwZWVkeTogb3B0aW9ucy5zcGVlZHksXG4gICAgICBwcmVwZW5kOiBvcHRpb25zLnByZXBlbmQsXG4gICAgICBpbnNlcnRpb25Qb2ludDogb3B0aW9ucy5pbnNlcnRpb25Qb2ludFxuICAgIH0pLFxuICAgIG5vbmNlOiBvcHRpb25zLm5vbmNlLFxuICAgIGluc2VydGVkOiBpbnNlcnRlZCxcbiAgICByZWdpc3RlcmVkOiB7fSxcbiAgICBpbnNlcnQ6IF9pbnNlcnRcbiAgfTtcbiAgY2FjaGUuc2hlZXQuaHlkcmF0ZShub2Rlc1RvSHlkcmF0ZSk7XG4gIHJldHVybiBjYWNoZTtcbn07XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGNyZWF0ZUNhY2hlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xuXG52YXIgY3JlYXRlQ2FjaGUgPSByZXF1aXJlKCdAZW1vdGlvbi9jYWNoZScpO1xudmFyIHNlcmlhbGl6ZSA9IHJlcXVpcmUoJ0BlbW90aW9uL3NlcmlhbGl6ZScpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnQGVtb3Rpb24vdXRpbHMnKTtcblxuZnVuY3Rpb24gX2ludGVyb3BEZWZhdWx0IChlKSB7IHJldHVybiBlICYmIGUuX19lc01vZHVsZSA/IGUgOiB7ICdkZWZhdWx0JzogZSB9OyB9XG5cbnZhciBjcmVhdGVDYWNoZV9fZGVmYXVsdCA9IC8qI19fUFVSRV9fKi9faW50ZXJvcERlZmF1bHQoY3JlYXRlQ2FjaGUpO1xuXG5mdW5jdGlvbiBpbnNlcnRXaXRob3V0U2NvcGluZyhjYWNoZSwgc2VyaWFsaXplZCkge1xuICBpZiAoY2FjaGUuaW5zZXJ0ZWRbc2VyaWFsaXplZC5uYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGNhY2hlLmluc2VydCgnJywgc2VyaWFsaXplZCwgY2FjaGUuc2hlZXQsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1lcmdlKHJlZ2lzdGVyZWQsIGNzcywgY2xhc3NOYW1lKSB7XG4gIHZhciByZWdpc3RlcmVkU3R5bGVzID0gW107XG4gIHZhciByYXdDbGFzc05hbWUgPSB1dGlscy5nZXRSZWdpc3RlcmVkU3R5bGVzKHJlZ2lzdGVyZWQsIHJlZ2lzdGVyZWRTdHlsZXMsIGNsYXNzTmFtZSk7XG5cbiAgaWYgKHJlZ2lzdGVyZWRTdHlsZXMubGVuZ3RoIDwgMikge1xuICAgIHJldHVybiBjbGFzc05hbWU7XG4gIH1cblxuICByZXR1cm4gcmF3Q2xhc3NOYW1lICsgY3NzKHJlZ2lzdGVyZWRTdHlsZXMpO1xufVxuXG52YXIgY3JlYXRlRW1vdGlvbiA9IGZ1bmN0aW9uIGNyZWF0ZUVtb3Rpb24ob3B0aW9ucykge1xuICB2YXIgY2FjaGUgPSBjcmVhdGVDYWNoZV9fZGVmYXVsdFsnZGVmYXVsdCddKG9wdGlvbnMpOyAvLyAkRmxvd0ZpeE1lXG5cbiAgY2FjaGUuc2hlZXQuc3BlZWR5ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgdGhpcy5jdHIgIT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignc3BlZWR5IG11c3QgYmUgY2hhbmdlZCBiZWZvcmUgYW55IHJ1bGVzIGFyZSBpbnNlcnRlZCcpO1xuICAgIH1cblxuICAgIHRoaXMuaXNTcGVlZHkgPSB2YWx1ZTtcbiAgfTtcblxuICBjYWNoZS5jb21wYXQgPSB0cnVlO1xuXG4gIHZhciBjc3MgPSBmdW5jdGlvbiBjc3MoKSB7XG4gICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBuZXcgQXJyYXkoX2xlbiksIF9rZXkgPSAwOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XG4gICAgICBhcmdzW19rZXldID0gYXJndW1lbnRzW19rZXldO1xuICAgIH1cblxuICAgIHZhciBzZXJpYWxpemVkID0gc2VyaWFsaXplLnNlcmlhbGl6ZVN0eWxlcyhhcmdzLCBjYWNoZS5yZWdpc3RlcmVkLCB1bmRlZmluZWQpO1xuICAgIHV0aWxzLmluc2VydFN0eWxlcyhjYWNoZSwgc2VyaWFsaXplZCwgZmFsc2UpO1xuICAgIHJldHVybiBjYWNoZS5rZXkgKyBcIi1cIiArIHNlcmlhbGl6ZWQubmFtZTtcbiAgfTtcblxuICB2YXIga2V5ZnJhbWVzID0gZnVuY3Rpb24ga2V5ZnJhbWVzKCkge1xuICAgIGZvciAodmFyIF9sZW4yID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IG5ldyBBcnJheShfbGVuMiksIF9rZXkyID0gMDsgX2tleTIgPCBfbGVuMjsgX2tleTIrKykge1xuICAgICAgYXJnc1tfa2V5Ml0gPSBhcmd1bWVudHNbX2tleTJdO1xuICAgIH1cblxuICAgIHZhciBzZXJpYWxpemVkID0gc2VyaWFsaXplLnNlcmlhbGl6ZVN0eWxlcyhhcmdzLCBjYWNoZS5yZWdpc3RlcmVkKTtcbiAgICB2YXIgYW5pbWF0aW9uID0gXCJhbmltYXRpb24tXCIgKyBzZXJpYWxpemVkLm5hbWU7XG4gICAgaW5zZXJ0V2l0aG91dFNjb3BpbmcoY2FjaGUsIHtcbiAgICAgIG5hbWU6IHNlcmlhbGl6ZWQubmFtZSxcbiAgICAgIHN0eWxlczogXCJAa2V5ZnJhbWVzIFwiICsgYW5pbWF0aW9uICsgXCJ7XCIgKyBzZXJpYWxpemVkLnN0eWxlcyArIFwifVwiXG4gICAgfSk7XG4gICAgcmV0dXJuIGFuaW1hdGlvbjtcbiAgfTtcblxuICB2YXIgaW5qZWN0R2xvYmFsID0gZnVuY3Rpb24gaW5qZWN0R2xvYmFsKCkge1xuICAgIGZvciAodmFyIF9sZW4zID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IG5ldyBBcnJheShfbGVuMyksIF9rZXkzID0gMDsgX2tleTMgPCBfbGVuMzsgX2tleTMrKykge1xuICAgICAgYXJnc1tfa2V5M10gPSBhcmd1bWVudHNbX2tleTNdO1xuICAgIH1cblxuICAgIHZhciBzZXJpYWxpemVkID0gc2VyaWFsaXplLnNlcmlhbGl6ZVN0eWxlcyhhcmdzLCBjYWNoZS5yZWdpc3RlcmVkKTtcbiAgICBpbnNlcnRXaXRob3V0U2NvcGluZyhjYWNoZSwgc2VyaWFsaXplZCk7XG4gIH07XG5cbiAgdmFyIGN4ID0gZnVuY3Rpb24gY3goKSB7XG4gICAgZm9yICh2YXIgX2xlbjQgPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gbmV3IEFycmF5KF9sZW40KSwgX2tleTQgPSAwOyBfa2V5NCA8IF9sZW40OyBfa2V5NCsrKSB7XG4gICAgICBhcmdzW19rZXk0XSA9IGFyZ3VtZW50c1tfa2V5NF07XG4gICAgfVxuXG4gICAgcmV0dXJuIG1lcmdlKGNhY2hlLnJlZ2lzdGVyZWQsIGNzcywgY2xhc3NuYW1lcyhhcmdzKSk7XG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBjc3M6IGNzcyxcbiAgICBjeDogY3gsXG4gICAgaW5qZWN0R2xvYmFsOiBpbmplY3RHbG9iYWwsXG4gICAga2V5ZnJhbWVzOiBrZXlmcmFtZXMsXG4gICAgaHlkcmF0ZTogZnVuY3Rpb24gaHlkcmF0ZShpZHMpIHtcbiAgICAgIGlkcy5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgY2FjaGUuaW5zZXJ0ZWRba2V5XSA9IHRydWU7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGZsdXNoOiBmdW5jdGlvbiBmbHVzaCgpIHtcbiAgICAgIGNhY2hlLnJlZ2lzdGVyZWQgPSB7fTtcbiAgICAgIGNhY2hlLmluc2VydGVkID0ge307XG4gICAgICBjYWNoZS5zaGVldC5mbHVzaCgpO1xuICAgIH0sXG4gICAgLy8gJEZsb3dGaXhNZVxuICAgIHNoZWV0OiBjYWNoZS5zaGVldCxcbiAgICBjYWNoZTogY2FjaGUsXG4gICAgZ2V0UmVnaXN0ZXJlZFN0eWxlczogdXRpbHMuZ2V0UmVnaXN0ZXJlZFN0eWxlcy5iaW5kKG51bGwsIGNhY2hlLnJlZ2lzdGVyZWQpLFxuICAgIG1lcmdlOiBtZXJnZS5iaW5kKG51bGwsIGNhY2hlLnJlZ2lzdGVyZWQsIGNzcylcbiAgfTtcbn07XG5cbnZhciBjbGFzc25hbWVzID0gZnVuY3Rpb24gY2xhc3NuYW1lcyhhcmdzKSB7XG4gIHZhciBjbHMgPSAnJztcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYXJnID0gYXJnc1tpXTtcbiAgICBpZiAoYXJnID09IG51bGwpIGNvbnRpbnVlO1xuICAgIHZhciB0b0FkZCA9IHZvaWQgMDtcblxuICAgIHN3aXRjaCAodHlwZW9mIGFyZykge1xuICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICB7XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICAgICAgICAgdG9BZGQgPSBjbGFzc25hbWVzKGFyZyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRvQWRkID0gJyc7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGsgaW4gYXJnKSB7XG4gICAgICAgICAgICAgIGlmIChhcmdba10gJiYgaykge1xuICAgICAgICAgICAgICAgIHRvQWRkICYmICh0b0FkZCArPSAnICcpO1xuICAgICAgICAgICAgICAgIHRvQWRkICs9IGs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB7XG4gICAgICAgICAgdG9BZGQgPSBhcmc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodG9BZGQpIHtcbiAgICAgIGNscyAmJiAoY2xzICs9ICcgJyk7XG4gICAgICBjbHMgKz0gdG9BZGQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNscztcbn07XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGNyZWF0ZUVtb3Rpb247XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiAhMFxufSk7XG5cbnZhciBjcmVhdGVDYWNoZSA9IHJlcXVpcmUoXCJAZW1vdGlvbi9jYWNoZVwiKSwgc2VyaWFsaXplID0gcmVxdWlyZShcIkBlbW90aW9uL3NlcmlhbGl6ZVwiKSwgdXRpbHMgPSByZXF1aXJlKFwiQGVtb3Rpb24vdXRpbHNcIik7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wRGVmYXVsdChlKSB7XG4gIHJldHVybiBlICYmIGUuX19lc01vZHVsZSA/IGUgOiB7XG4gICAgZGVmYXVsdDogZVxuICB9O1xufVxuXG52YXIgY3JlYXRlQ2FjaGVfX2RlZmF1bHQgPSBfaW50ZXJvcERlZmF1bHQoY3JlYXRlQ2FjaGUpO1xuXG5mdW5jdGlvbiBpbnNlcnRXaXRob3V0U2NvcGluZyhjYWNoZSwgc2VyaWFsaXplZCkge1xuICBpZiAodm9pZCAwID09PSBjYWNoZS5pbnNlcnRlZFtzZXJpYWxpemVkLm5hbWVdKSByZXR1cm4gY2FjaGUuaW5zZXJ0KFwiXCIsIHNlcmlhbGl6ZWQsIGNhY2hlLnNoZWV0LCAhMCk7XG59XG5cbmZ1bmN0aW9uIG1lcmdlKHJlZ2lzdGVyZWQsIGNzcywgY2xhc3NOYW1lKSB7XG4gIHZhciByZWdpc3RlcmVkU3R5bGVzID0gW10sIHJhd0NsYXNzTmFtZSA9IHV0aWxzLmdldFJlZ2lzdGVyZWRTdHlsZXMocmVnaXN0ZXJlZCwgcmVnaXN0ZXJlZFN0eWxlcywgY2xhc3NOYW1lKTtcbiAgcmV0dXJuIHJlZ2lzdGVyZWRTdHlsZXMubGVuZ3RoIDwgMiA/IGNsYXNzTmFtZSA6IHJhd0NsYXNzTmFtZSArIGNzcyhyZWdpc3RlcmVkU3R5bGVzKTtcbn1cblxudmFyIGNyZWF0ZUVtb3Rpb24gPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHZhciBjYWNoZSA9IGNyZWF0ZUNhY2hlX19kZWZhdWx0LmRlZmF1bHQob3B0aW9ucyk7XG4gIGNhY2hlLnNoZWV0LnNwZWVkeSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdGhpcy5pc1NwZWVkeSA9IHZhbHVlO1xuICB9LCBjYWNoZS5jb21wYXQgPSAhMDtcbiAgdmFyIGNzcyA9IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gbmV3IEFycmF5KF9sZW4pLCBfa2V5ID0gMDsgX2tleSA8IF9sZW47IF9rZXkrKykgYXJnc1tfa2V5XSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgICB2YXIgc2VyaWFsaXplZCA9IHNlcmlhbGl6ZS5zZXJpYWxpemVTdHlsZXMoYXJncywgY2FjaGUucmVnaXN0ZXJlZCwgdm9pZCAwKTtcbiAgICByZXR1cm4gdXRpbHMuaW5zZXJ0U3R5bGVzKGNhY2hlLCBzZXJpYWxpemVkLCAhMSksIGNhY2hlLmtleSArIFwiLVwiICsgc2VyaWFsaXplZC5uYW1lO1xuICB9O1xuICByZXR1cm4ge1xuICAgIGNzczogY3NzLFxuICAgIGN4OiBmdW5jdGlvbigpIHtcbiAgICAgIGZvciAodmFyIF9sZW40ID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IG5ldyBBcnJheShfbGVuNCksIF9rZXk0ID0gMDsgX2tleTQgPCBfbGVuNDsgX2tleTQrKykgYXJnc1tfa2V5NF0gPSBhcmd1bWVudHNbX2tleTRdO1xuICAgICAgcmV0dXJuIG1lcmdlKGNhY2hlLnJlZ2lzdGVyZWQsIGNzcywgY2xhc3NuYW1lcyhhcmdzKSk7XG4gICAgfSxcbiAgICBpbmplY3RHbG9iYWw6IGZ1bmN0aW9uKCkge1xuICAgICAgZm9yICh2YXIgX2xlbjMgPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gbmV3IEFycmF5KF9sZW4zKSwgX2tleTMgPSAwOyBfa2V5MyA8IF9sZW4zOyBfa2V5MysrKSBhcmdzW19rZXkzXSA9IGFyZ3VtZW50c1tfa2V5M107XG4gICAgICB2YXIgc2VyaWFsaXplZCA9IHNlcmlhbGl6ZS5zZXJpYWxpemVTdHlsZXMoYXJncywgY2FjaGUucmVnaXN0ZXJlZCk7XG4gICAgICBpbnNlcnRXaXRob3V0U2NvcGluZyhjYWNoZSwgc2VyaWFsaXplZCk7XG4gICAgfSxcbiAgICBrZXlmcmFtZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgZm9yICh2YXIgX2xlbjIgPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gbmV3IEFycmF5KF9sZW4yKSwgX2tleTIgPSAwOyBfa2V5MiA8IF9sZW4yOyBfa2V5MisrKSBhcmdzW19rZXkyXSA9IGFyZ3VtZW50c1tfa2V5Ml07XG4gICAgICB2YXIgc2VyaWFsaXplZCA9IHNlcmlhbGl6ZS5zZXJpYWxpemVTdHlsZXMoYXJncywgY2FjaGUucmVnaXN0ZXJlZCksIGFuaW1hdGlvbiA9IFwiYW5pbWF0aW9uLVwiICsgc2VyaWFsaXplZC5uYW1lO1xuICAgICAgcmV0dXJuIGluc2VydFdpdGhvdXRTY29waW5nKGNhY2hlLCB7XG4gICAgICAgIG5hbWU6IHNlcmlhbGl6ZWQubmFtZSxcbiAgICAgICAgc3R5bGVzOiBcIkBrZXlmcmFtZXMgXCIgKyBhbmltYXRpb24gKyBcIntcIiArIHNlcmlhbGl6ZWQuc3R5bGVzICsgXCJ9XCJcbiAgICAgIH0pLCBhbmltYXRpb247XG4gICAgfSxcbiAgICBoeWRyYXRlOiBmdW5jdGlvbihpZHMpIHtcbiAgICAgIGlkcy5mb3JFYWNoKChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgY2FjaGUuaW5zZXJ0ZWRba2V5XSA9ICEwO1xuICAgICAgfSkpO1xuICAgIH0sXG4gICAgZmx1c2g6IGZ1bmN0aW9uKCkge1xuICAgICAgY2FjaGUucmVnaXN0ZXJlZCA9IHt9LCBjYWNoZS5pbnNlcnRlZCA9IHt9LCBjYWNoZS5zaGVldC5mbHVzaCgpO1xuICAgIH0sXG4gICAgc2hlZXQ6IGNhY2hlLnNoZWV0LFxuICAgIGNhY2hlOiBjYWNoZSxcbiAgICBnZXRSZWdpc3RlcmVkU3R5bGVzOiB1dGlscy5nZXRSZWdpc3RlcmVkU3R5bGVzLmJpbmQobnVsbCwgY2FjaGUucmVnaXN0ZXJlZCksXG4gICAgbWVyZ2U6IG1lcmdlLmJpbmQobnVsbCwgY2FjaGUucmVnaXN0ZXJlZCwgY3NzKVxuICB9O1xufSwgY2xhc3NuYW1lcyA9IGZ1bmN0aW9uIGNsYXNzbmFtZXMoYXJncykge1xuICBmb3IgKHZhciBjbHMgPSBcIlwiLCBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYXJnID0gYXJnc1tpXTtcbiAgICBpZiAobnVsbCAhPSBhcmcpIHtcbiAgICAgIHZhciB0b0FkZCA9IHZvaWQgMDtcbiAgICAgIHN3aXRjaCAodHlwZW9mIGFyZykge1xuICAgICAgIGNhc2UgXCJib29sZWFuXCI6XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB0b0FkZCA9IGNsYXNzbmFtZXMoYXJnKTsgZWxzZSBmb3IgKHZhciBrIGluIHRvQWRkID0gXCJcIiwgXG4gICAgICAgIGFyZykgYXJnW2tdICYmIGsgJiYgKHRvQWRkICYmICh0b0FkZCArPSBcIiBcIiksIHRvQWRkICs9IGspO1xuICAgICAgICBicmVhaztcblxuICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRvQWRkID0gYXJnO1xuICAgICAgfVxuICAgICAgdG9BZGQgJiYgKGNscyAmJiAoY2xzICs9IFwiIFwiKSwgY2xzICs9IHRvQWRkKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNscztcbn07XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGNyZWF0ZUVtb3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbnJlcXVpcmUoJ0BlbW90aW9uL2NhY2hlJyk7XG5yZXF1aXJlKCdAZW1vdGlvbi9zZXJpYWxpemUnKTtcbnJlcXVpcmUoJ0BlbW90aW9uL3V0aWxzJyk7XG52YXIgY3JlYXRlSW5zdGFuY2VfZGlzdF9lbW90aW9uQ3NzQ3JlYXRlSW5zdGFuY2UgPSByZXF1aXJlKCcuLi9jcmVhdGUtaW5zdGFuY2UvZGlzdC9lbW90aW9uLWNzcy1jcmVhdGUtaW5zdGFuY2UuY2pzLmRldi5qcycpO1xuXG52YXIgX2NyZWF0ZUVtb3Rpb24gPSBjcmVhdGVJbnN0YW5jZV9kaXN0X2Vtb3Rpb25Dc3NDcmVhdGVJbnN0YW5jZVsnZGVmYXVsdCddKHtcbiAga2V5OiAnY3NzJ1xufSksXG4gICAgZmx1c2ggPSBfY3JlYXRlRW1vdGlvbi5mbHVzaCxcbiAgICBoeWRyYXRlID0gX2NyZWF0ZUVtb3Rpb24uaHlkcmF0ZSxcbiAgICBjeCA9IF9jcmVhdGVFbW90aW9uLmN4LFxuICAgIG1lcmdlID0gX2NyZWF0ZUVtb3Rpb24ubWVyZ2UsXG4gICAgZ2V0UmVnaXN0ZXJlZFN0eWxlcyA9IF9jcmVhdGVFbW90aW9uLmdldFJlZ2lzdGVyZWRTdHlsZXMsXG4gICAgaW5qZWN0R2xvYmFsID0gX2NyZWF0ZUVtb3Rpb24uaW5qZWN0R2xvYmFsLFxuICAgIGtleWZyYW1lcyA9IF9jcmVhdGVFbW90aW9uLmtleWZyYW1lcyxcbiAgICBjc3MgPSBfY3JlYXRlRW1vdGlvbi5jc3MsXG4gICAgc2hlZXQgPSBfY3JlYXRlRW1vdGlvbi5zaGVldCxcbiAgICBjYWNoZSA9IF9jcmVhdGVFbW90aW9uLmNhY2hlO1xuXG5leHBvcnRzLmNhY2hlID0gY2FjaGU7XG5leHBvcnRzLmNzcyA9IGNzcztcbmV4cG9ydHMuY3ggPSBjeDtcbmV4cG9ydHMuZmx1c2ggPSBmbHVzaDtcbmV4cG9ydHMuZ2V0UmVnaXN0ZXJlZFN0eWxlcyA9IGdldFJlZ2lzdGVyZWRTdHlsZXM7XG5leHBvcnRzLmh5ZHJhdGUgPSBoeWRyYXRlO1xuZXhwb3J0cy5pbmplY3RHbG9iYWwgPSBpbmplY3RHbG9iYWw7XG5leHBvcnRzLmtleWZyYW1lcyA9IGtleWZyYW1lcztcbmV4cG9ydHMubWVyZ2UgPSBtZXJnZTtcbmV4cG9ydHMuc2hlZXQgPSBzaGVldDtcbiIsIid1c2Ugc3RyaWN0JztcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcInByb2R1Y3Rpb25cIikge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2Vtb3Rpb24tY3NzLmNqcy5wcm9kLmpzXCIpO1xufSBlbHNlIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9lbW90aW9uLWNzcy5janMuZGV2LmpzXCIpO1xufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogITBcbn0pLCByZXF1aXJlKFwiQGVtb3Rpb24vY2FjaGVcIiksIHJlcXVpcmUoXCJAZW1vdGlvbi9zZXJpYWxpemVcIiksIHJlcXVpcmUoXCJAZW1vdGlvbi91dGlsc1wiKTtcblxudmFyIGNyZWF0ZUluc3RhbmNlX2Rpc3RfZW1vdGlvbkNzc0NyZWF0ZUluc3RhbmNlID0gcmVxdWlyZShcIi4uL2NyZWF0ZS1pbnN0YW5jZS9kaXN0L2Vtb3Rpb24tY3NzLWNyZWF0ZS1pbnN0YW5jZS5janMucHJvZC5qc1wiKSwgX2NyZWF0ZUVtb3Rpb24gPSBjcmVhdGVJbnN0YW5jZV9kaXN0X2Vtb3Rpb25Dc3NDcmVhdGVJbnN0YW5jZS5kZWZhdWx0KHtcbiAga2V5OiBcImNzc1wiXG59KSwgZmx1c2ggPSBfY3JlYXRlRW1vdGlvbi5mbHVzaCwgaHlkcmF0ZSA9IF9jcmVhdGVFbW90aW9uLmh5ZHJhdGUsIGN4ID0gX2NyZWF0ZUVtb3Rpb24uY3gsIG1lcmdlID0gX2NyZWF0ZUVtb3Rpb24ubWVyZ2UsIGdldFJlZ2lzdGVyZWRTdHlsZXMgPSBfY3JlYXRlRW1vdGlvbi5nZXRSZWdpc3RlcmVkU3R5bGVzLCBpbmplY3RHbG9iYWwgPSBfY3JlYXRlRW1vdGlvbi5pbmplY3RHbG9iYWwsIGtleWZyYW1lcyA9IF9jcmVhdGVFbW90aW9uLmtleWZyYW1lcywgY3NzID0gX2NyZWF0ZUVtb3Rpb24uY3NzLCBzaGVldCA9IF9jcmVhdGVFbW90aW9uLnNoZWV0LCBjYWNoZSA9IF9jcmVhdGVFbW90aW9uLmNhY2hlO1xuXG5leHBvcnRzLmNhY2hlID0gY2FjaGUsIGV4cG9ydHMuY3NzID0gY3NzLCBleHBvcnRzLmN4ID0gY3gsIGV4cG9ydHMuZmx1c2ggPSBmbHVzaCwgXG5leHBvcnRzLmdldFJlZ2lzdGVyZWRTdHlsZXMgPSBnZXRSZWdpc3RlcmVkU3R5bGVzLCBleHBvcnRzLmh5ZHJhdGUgPSBoeWRyYXRlLCBleHBvcnRzLmluamVjdEdsb2JhbCA9IGluamVjdEdsb2JhbCwgXG5leHBvcnRzLmtleWZyYW1lcyA9IGtleWZyYW1lcywgZXhwb3J0cy5tZXJnZSA9IG1lcmdlLCBleHBvcnRzLnNoZWV0ID0gc2hlZXQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBJbnNwaXJlZCBieSBodHRwczovL2dpdGh1Yi5jb20vZ2FyeWNvdXJ0L211cm11cmhhc2gtanNcbi8vIFBvcnRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9hYXBwbGVieS9zbWhhc2hlci9ibG9iLzYxYTA1MzBmMjgyNzdmMmU4NTBiZmMzOTYwMGNlNjFkMDJiNTE4ZGUvc3JjL011cm11ckhhc2gyLmNwcCNMMzctTDg2XG5mdW5jdGlvbiBtdXJtdXIyKHN0cikge1xuICAvLyAnbScgYW5kICdyJyBhcmUgbWl4aW5nIGNvbnN0YW50cyBnZW5lcmF0ZWQgb2ZmbGluZS5cbiAgLy8gVGhleSdyZSBub3QgcmVhbGx5ICdtYWdpYycsIHRoZXkganVzdCBoYXBwZW4gdG8gd29yayB3ZWxsLlxuICAvLyBjb25zdCBtID0gMHg1YmQxZTk5NTtcbiAgLy8gY29uc3QgciA9IDI0O1xuICAvLyBJbml0aWFsaXplIHRoZSBoYXNoXG4gIHZhciBoID0gMDsgLy8gTWl4IDQgYnl0ZXMgYXQgYSB0aW1lIGludG8gdGhlIGhhc2hcblxuICB2YXIgayxcbiAgICAgIGkgPSAwLFxuICAgICAgbGVuID0gc3RyLmxlbmd0aDtcblxuICBmb3IgKDsgbGVuID49IDQ7ICsraSwgbGVuIC09IDQpIHtcbiAgICBrID0gc3RyLmNoYXJDb2RlQXQoaSkgJiAweGZmIHwgKHN0ci5jaGFyQ29kZUF0KCsraSkgJiAweGZmKSA8PCA4IHwgKHN0ci5jaGFyQ29kZUF0KCsraSkgJiAweGZmKSA8PCAxNiB8IChzdHIuY2hhckNvZGVBdCgrK2kpICYgMHhmZikgPDwgMjQ7XG4gICAgayA9XG4gICAgLyogTWF0aC5pbXVsKGssIG0pOiAqL1xuICAgIChrICYgMHhmZmZmKSAqIDB4NWJkMWU5OTUgKyAoKGsgPj4+IDE2KSAqIDB4ZTk5NSA8PCAxNik7XG4gICAgayBePVxuICAgIC8qIGsgPj4+IHI6ICovXG4gICAgayA+Pj4gMjQ7XG4gICAgaCA9XG4gICAgLyogTWF0aC5pbXVsKGssIG0pOiAqL1xuICAgIChrICYgMHhmZmZmKSAqIDB4NWJkMWU5OTUgKyAoKGsgPj4+IDE2KSAqIDB4ZTk5NSA8PCAxNikgXlxuICAgIC8qIE1hdGguaW11bChoLCBtKTogKi9cbiAgICAoaCAmIDB4ZmZmZikgKiAweDViZDFlOTk1ICsgKChoID4+PiAxNikgKiAweGU5OTUgPDwgMTYpO1xuICB9IC8vIEhhbmRsZSB0aGUgbGFzdCBmZXcgYnl0ZXMgb2YgdGhlIGlucHV0IGFycmF5XG5cblxuICBzd2l0Y2ggKGxlbikge1xuICAgIGNhc2UgMzpcbiAgICAgIGggXj0gKHN0ci5jaGFyQ29kZUF0KGkgKyAyKSAmIDB4ZmYpIDw8IDE2O1xuXG4gICAgY2FzZSAyOlxuICAgICAgaCBePSAoc3RyLmNoYXJDb2RlQXQoaSArIDEpICYgMHhmZikgPDwgODtcblxuICAgIGNhc2UgMTpcbiAgICAgIGggXj0gc3RyLmNoYXJDb2RlQXQoaSkgJiAweGZmO1xuICAgICAgaCA9XG4gICAgICAvKiBNYXRoLmltdWwoaCwgbSk6ICovXG4gICAgICAoaCAmIDB4ZmZmZikgKiAweDViZDFlOTk1ICsgKChoID4+PiAxNikgKiAweGU5OTUgPDwgMTYpO1xuICB9IC8vIERvIGEgZmV3IGZpbmFsIG1peGVzIG9mIHRoZSBoYXNoIHRvIGVuc3VyZSB0aGUgbGFzdCBmZXdcbiAgLy8gYnl0ZXMgYXJlIHdlbGwtaW5jb3Jwb3JhdGVkLlxuXG5cbiAgaCBePSBoID4+PiAxMztcbiAgaCA9XG4gIC8qIE1hdGguaW11bChoLCBtKTogKi9cbiAgKGggJiAweGZmZmYpICogMHg1YmQxZTk5NSArICgoaCA+Pj4gMTYpICogMHhlOTk1IDw8IDE2KTtcbiAgcmV0dXJuICgoaCBeIGggPj4+IDE1KSA+Pj4gMCkudG9TdHJpbmcoMzYpO1xufVxuXG5leHBvcnRzLmRlZmF1bHQgPSBtdXJtdXIyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xuXG5mdW5jdGlvbiBtZW1vaXplKGZuKSB7XG4gIHZhciBjYWNoZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIHJldHVybiBmdW5jdGlvbiAoYXJnKSB7XG4gICAgaWYgKGNhY2hlW2FyZ10gPT09IHVuZGVmaW5lZCkgY2FjaGVbYXJnXSA9IGZuKGFyZyk7XG4gICAgcmV0dXJuIGNhY2hlW2FyZ107XG4gIH07XG59XG5cbmV4cG9ydHMuZGVmYXVsdCA9IG1lbW9pemU7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbnZhciBoYXNoU3RyaW5nID0gcmVxdWlyZSgnQGVtb3Rpb24vaGFzaCcpO1xudmFyIHVuaXRsZXNzID0gcmVxdWlyZSgnQGVtb3Rpb24vdW5pdGxlc3MnKTtcbnZhciBtZW1vaXplID0gcmVxdWlyZSgnQGVtb3Rpb24vbWVtb2l6ZScpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcERlZmF1bHQgKGUpIHsgcmV0dXJuIGUgJiYgZS5fX2VzTW9kdWxlID8gZSA6IHsgJ2RlZmF1bHQnOiBlIH07IH1cblxudmFyIGhhc2hTdHJpbmdfX2RlZmF1bHQgPSAvKiNfX1BVUkVfXyovX2ludGVyb3BEZWZhdWx0KGhhc2hTdHJpbmcpO1xudmFyIHVuaXRsZXNzX19kZWZhdWx0ID0gLyojX19QVVJFX18qL19pbnRlcm9wRGVmYXVsdCh1bml0bGVzcyk7XG52YXIgbWVtb2l6ZV9fZGVmYXVsdCA9IC8qI19fUFVSRV9fKi9faW50ZXJvcERlZmF1bHQobWVtb2l6ZSk7XG5cbnZhciBJTExFR0FMX0VTQ0FQRV9TRVFVRU5DRV9FUlJPUiA9IFwiWW91IGhhdmUgaWxsZWdhbCBlc2NhcGUgc2VxdWVuY2UgaW4geW91ciB0ZW1wbGF0ZSBsaXRlcmFsLCBtb3N0IGxpa2VseSBpbnNpZGUgY29udGVudCdzIHByb3BlcnR5IHZhbHVlLlxcbkJlY2F1c2UgeW91IHdyaXRlIHlvdXIgQ1NTIGluc2lkZSBhIEphdmFTY3JpcHQgc3RyaW5nIHlvdSBhY3R1YWxseSBoYXZlIHRvIGRvIGRvdWJsZSBlc2NhcGluZywgc28gZm9yIGV4YW1wbGUgXFxcImNvbnRlbnQ6ICdcXFxcMDBkNyc7XFxcIiBzaG91bGQgYmVjb21lIFxcXCJjb250ZW50OiAnXFxcXFxcXFwwMGQ3JztcXFwiLlxcbllvdSBjYW4gcmVhZCBtb3JlIGFib3V0IHRoaXMgaGVyZTpcXG5odHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9UZW1wbGF0ZV9saXRlcmFscyNFUzIwMThfcmV2aXNpb25fb2ZfaWxsZWdhbF9lc2NhcGVfc2VxdWVuY2VzXCI7XG52YXIgVU5ERUZJTkVEX0FTX09CSkVDVF9LRVlfRVJST1IgPSBcIllvdSBoYXZlIHBhc3NlZCBpbiBmYWxzeSB2YWx1ZSBhcyBzdHlsZSBvYmplY3QncyBrZXkgKGNhbiBoYXBwZW4gd2hlbiBpbiBleGFtcGxlIHlvdSBwYXNzIHVuZXhwb3J0ZWQgY29tcG9uZW50IGFzIGNvbXB1dGVkIGtleSkuXCI7XG52YXIgaHlwaGVuYXRlUmVnZXggPSAvW0EtWl18Xm1zL2c7XG52YXIgYW5pbWF0aW9uUmVnZXggPSAvX0VNT18oW15fXSs/KV8oW15dKj8pX0VNT18vZztcblxudmFyIGlzQ3VzdG9tUHJvcGVydHkgPSBmdW5jdGlvbiBpc0N1c3RvbVByb3BlcnR5KHByb3BlcnR5KSB7XG4gIHJldHVybiBwcm9wZXJ0eS5jaGFyQ29kZUF0KDEpID09PSA0NTtcbn07XG5cbnZhciBpc1Byb2Nlc3NhYmxlVmFsdWUgPSBmdW5jdGlvbiBpc1Byb2Nlc3NhYmxlVmFsdWUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlICE9PSAnYm9vbGVhbic7XG59O1xuXG52YXIgcHJvY2Vzc1N0eWxlTmFtZSA9IC8qICNfX1BVUkVfXyAqL21lbW9pemVfX2RlZmF1bHRbJ2RlZmF1bHQnXShmdW5jdGlvbiAoc3R5bGVOYW1lKSB7XG4gIHJldHVybiBpc0N1c3RvbVByb3BlcnR5KHN0eWxlTmFtZSkgPyBzdHlsZU5hbWUgOiBzdHlsZU5hbWUucmVwbGFjZShoeXBoZW5hdGVSZWdleCwgJy0kJicpLnRvTG93ZXJDYXNlKCk7XG59KTtcblxudmFyIHByb2Nlc3NTdHlsZVZhbHVlID0gZnVuY3Rpb24gcHJvY2Vzc1N0eWxlVmFsdWUoa2V5LCB2YWx1ZSkge1xuICBzd2l0Y2ggKGtleSkge1xuICAgIGNhc2UgJ2FuaW1hdGlvbic6XG4gICAgY2FzZSAnYW5pbWF0aW9uTmFtZSc6XG4gICAgICB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmV0dXJuIHZhbHVlLnJlcGxhY2UoYW5pbWF0aW9uUmVnZXgsIGZ1bmN0aW9uIChtYXRjaCwgcDEsIHAyKSB7XG4gICAgICAgICAgICBjdXJzb3IgPSB7XG4gICAgICAgICAgICAgIG5hbWU6IHAxLFxuICAgICAgICAgICAgICBzdHlsZXM6IHAyLFxuICAgICAgICAgICAgICBuZXh0OiBjdXJzb3JcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gcDE7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgfVxuXG4gIGlmICh1bml0bGVzc19fZGVmYXVsdFsnZGVmYXVsdCddW2tleV0gIT09IDEgJiYgIWlzQ3VzdG9tUHJvcGVydHkoa2V5KSAmJiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIHZhbHVlICE9PSAwKSB7XG4gICAgcmV0dXJuIHZhbHVlICsgJ3B4JztcbiAgfVxuXG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhciBjb250ZW50VmFsdWVQYXR0ZXJuID0gLyhhdHRyfGNvdW50ZXJzP3x1cmx8KCgocmVwZWF0aW5nLSk/KGxpbmVhcnxyYWRpYWwpKXxjb25pYyktZ3JhZGllbnQpXFwofChuby0pPyhvcGVufGNsb3NlKS1xdW90ZS87XG4gIHZhciBjb250ZW50VmFsdWVzID0gWydub3JtYWwnLCAnbm9uZScsICdpbml0aWFsJywgJ2luaGVyaXQnLCAndW5zZXQnXTtcbiAgdmFyIG9sZFByb2Nlc3NTdHlsZVZhbHVlID0gcHJvY2Vzc1N0eWxlVmFsdWU7XG4gIHZhciBtc1BhdHRlcm4gPSAvXi1tcy0vO1xuICB2YXIgaHlwaGVuUGF0dGVybiA9IC8tKC4pL2c7XG4gIHZhciBoeXBoZW5hdGVkQ2FjaGUgPSB7fTtcblxuICBwcm9jZXNzU3R5bGVWYWx1ZSA9IGZ1bmN0aW9uIHByb2Nlc3NTdHlsZVZhbHVlKGtleSwgdmFsdWUpIHtcbiAgICBpZiAoa2V5ID09PSAnY29udGVudCcpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnIHx8IGNvbnRlbnRWYWx1ZXMuaW5kZXhPZih2YWx1ZSkgPT09IC0xICYmICFjb250ZW50VmFsdWVQYXR0ZXJuLnRlc3QodmFsdWUpICYmICh2YWx1ZS5jaGFyQXQoMCkgIT09IHZhbHVlLmNoYXJBdCh2YWx1ZS5sZW5ndGggLSAxKSB8fCB2YWx1ZS5jaGFyQXQoMCkgIT09ICdcIicgJiYgdmFsdWUuY2hhckF0KDApICE9PSBcIidcIikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiWW91IHNlZW0gdG8gYmUgdXNpbmcgYSB2YWx1ZSBmb3IgJ2NvbnRlbnQnIHdpdGhvdXQgcXVvdGVzLCB0cnkgcmVwbGFjaW5nIGl0IHdpdGggYGNvbnRlbnQ6ICdcXFwiXCIgKyB2YWx1ZSArIFwiXFxcIidgXCIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBwcm9jZXNzZWQgPSBvbGRQcm9jZXNzU3R5bGVWYWx1ZShrZXksIHZhbHVlKTtcblxuICAgIGlmIChwcm9jZXNzZWQgIT09ICcnICYmICFpc0N1c3RvbVByb3BlcnR5KGtleSkgJiYga2V5LmluZGV4T2YoJy0nKSAhPT0gLTEgJiYgaHlwaGVuYXRlZENhY2hlW2tleV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgaHlwaGVuYXRlZENhY2hlW2tleV0gPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcihcIlVzaW5nIGtlYmFiLWNhc2UgZm9yIGNzcyBwcm9wZXJ0aWVzIGluIG9iamVjdHMgaXMgbm90IHN1cHBvcnRlZC4gRGlkIHlvdSBtZWFuIFwiICsga2V5LnJlcGxhY2UobXNQYXR0ZXJuLCAnbXMtJykucmVwbGFjZShoeXBoZW5QYXR0ZXJuLCBmdW5jdGlvbiAoc3RyLCBfY2hhcikge1xuICAgICAgICByZXR1cm4gX2NoYXIudG9VcHBlckNhc2UoKTtcbiAgICAgIH0pICsgXCI/XCIpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9jZXNzZWQ7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUludGVycG9sYXRpb24obWVyZ2VkUHJvcHMsIHJlZ2lzdGVyZWQsIGludGVycG9sYXRpb24pIHtcbiAgaWYgKGludGVycG9sYXRpb24gPT0gbnVsbCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIGlmIChpbnRlcnBvbGF0aW9uLl9fZW1vdGlvbl9zdHlsZXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIGludGVycG9sYXRpb24udG9TdHJpbmcoKSA9PT0gJ05PX0NPTVBPTkVOVF9TRUxFQ1RPUicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ29tcG9uZW50IHNlbGVjdG9ycyBjYW4gb25seSBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggQGVtb3Rpb24vYmFiZWwtcGx1Z2luLicpO1xuICAgIH1cblxuICAgIHJldHVybiBpbnRlcnBvbGF0aW9uO1xuICB9XG5cbiAgc3dpdGNoICh0eXBlb2YgaW50ZXJwb2xhdGlvbikge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgICB9XG5cbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAge1xuICAgICAgICBpZiAoaW50ZXJwb2xhdGlvbi5hbmltID09PSAxKSB7XG4gICAgICAgICAgY3Vyc29yID0ge1xuICAgICAgICAgICAgbmFtZTogaW50ZXJwb2xhdGlvbi5uYW1lLFxuICAgICAgICAgICAgc3R5bGVzOiBpbnRlcnBvbGF0aW9uLnN0eWxlcyxcbiAgICAgICAgICAgIG5leHQ6IGN1cnNvclxuICAgICAgICAgIH07XG4gICAgICAgICAgcmV0dXJuIGludGVycG9sYXRpb24ubmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbnRlcnBvbGF0aW9uLnN0eWxlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFyIG5leHQgPSBpbnRlcnBvbGF0aW9uLm5leHQ7XG5cbiAgICAgICAgICBpZiAobmV4dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBub3QgdGhlIG1vc3QgZWZmaWNpZW50IHRoaW5nIGV2ZXIgYnV0IHRoaXMgaXMgYSBwcmV0dHkgcmFyZSBjYXNlXG4gICAgICAgICAgICAvLyBhbmQgdGhlcmUgd2lsbCBiZSB2ZXJ5IGZldyBpdGVyYXRpb25zIG9mIHRoaXMgZ2VuZXJhbGx5XG4gICAgICAgICAgICB3aGlsZSAobmV4dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGN1cnNvciA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBuZXh0Lm5hbWUsXG4gICAgICAgICAgICAgICAgc3R5bGVzOiBuZXh0LnN0eWxlcyxcbiAgICAgICAgICAgICAgICBuZXh0OiBjdXJzb3JcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgbmV4dCA9IG5leHQubmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgc3R5bGVzID0gaW50ZXJwb2xhdGlvbi5zdHlsZXMgKyBcIjtcIjtcblxuICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIGludGVycG9sYXRpb24ubWFwICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHN0eWxlcyArPSBpbnRlcnBvbGF0aW9uLm1hcDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gc3R5bGVzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNyZWF0ZVN0cmluZ0Zyb21PYmplY3QobWVyZ2VkUHJvcHMsIHJlZ2lzdGVyZWQsIGludGVycG9sYXRpb24pO1xuICAgICAgfVxuXG4gICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAge1xuICAgICAgICBpZiAobWVyZ2VkUHJvcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhciBwcmV2aW91c0N1cnNvciA9IGN1cnNvcjtcbiAgICAgICAgICB2YXIgcmVzdWx0ID0gaW50ZXJwb2xhdGlvbihtZXJnZWRQcm9wcyk7XG4gICAgICAgICAgY3Vyc29yID0gcHJldmlvdXNDdXJzb3I7XG4gICAgICAgICAgcmV0dXJuIGhhbmRsZUludGVycG9sYXRpb24obWVyZ2VkUHJvcHMsIHJlZ2lzdGVyZWQsIHJlc3VsdCk7XG4gICAgICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Z1bmN0aW9ucyB0aGF0IGFyZSBpbnRlcnBvbGF0ZWQgaW4gY3NzIGNhbGxzIHdpbGwgYmUgc3RyaW5naWZpZWQuXFxuJyArICdJZiB5b3Ugd2FudCB0byBoYXZlIGEgY3NzIGNhbGwgYmFzZWQgb24gcHJvcHMsIGNyZWF0ZSBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGNzcyBjYWxsIGxpa2UgdGhpc1xcbicgKyAnbGV0IGR5bmFtaWNTdHlsZSA9IChwcm9wcykgPT4gY3NzYGNvbG9yOiAke3Byb3BzLmNvbG9yfWBcXG4nICsgJ0l0IGNhbiBiZSBjYWxsZWQgZGlyZWN0bHkgd2l0aCBwcm9wcyBvciBpbnRlcnBvbGF0ZWQgaW4gYSBzdHlsZWQgY2FsbCBsaWtlIHRoaXNcXG4nICsgXCJsZXQgU29tZUNvbXBvbmVudCA9IHN0eWxlZCgnZGl2JylgJHtkeW5hbWljU3R5bGV9YFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHZhciBtYXRjaGVkID0gW107XG4gICAgICAgIHZhciByZXBsYWNlZCA9IGludGVycG9sYXRpb24ucmVwbGFjZShhbmltYXRpb25SZWdleCwgZnVuY3Rpb24gKG1hdGNoLCBwMSwgcDIpIHtcbiAgICAgICAgICB2YXIgZmFrZVZhck5hbWUgPSBcImFuaW1hdGlvblwiICsgbWF0Y2hlZC5sZW5ndGg7XG4gICAgICAgICAgbWF0Y2hlZC5wdXNoKFwiY29uc3QgXCIgKyBmYWtlVmFyTmFtZSArIFwiID0ga2V5ZnJhbWVzYFwiICsgcDIucmVwbGFjZSgvXkBrZXlmcmFtZXMgYW5pbWF0aW9uLVxcdysvLCAnJykgKyBcImBcIik7XG4gICAgICAgICAgcmV0dXJuIFwiJHtcIiArIGZha2VWYXJOYW1lICsgXCJ9XCI7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChtYXRjaGVkLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ2BrZXlmcmFtZXNgIG91dHB1dCBnb3QgaW50ZXJwb2xhdGVkIGludG8gcGxhaW4gc3RyaW5nLCBwbGVhc2Ugd3JhcCBpdCB3aXRoIGBjc3NgLlxcblxcbicgKyAnSW5zdGVhZCBvZiBkb2luZyB0aGlzOlxcblxcbicgKyBbXS5jb25jYXQobWF0Y2hlZCwgW1wiYFwiICsgcmVwbGFjZWQgKyBcImBcIl0pLmpvaW4oJ1xcbicpICsgJ1xcblxcbllvdSBzaG91bGQgd3JhcCBpdCB3aXRoIGBjc3NgIGxpa2UgdGhpczpcXG5cXG4nICsgKFwiY3NzYFwiICsgcmVwbGFjZWQgKyBcImBcIikpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGJyZWFrO1xuICB9IC8vIGZpbmFsaXplIHN0cmluZyB2YWx1ZXMgKHJlZ3VsYXIgc3RyaW5ncyBhbmQgZnVuY3Rpb25zIGludGVycG9sYXRlZCBpbnRvIGNzcyBjYWxscylcblxuXG4gIGlmIChyZWdpc3RlcmVkID09IG51bGwpIHtcbiAgICByZXR1cm4gaW50ZXJwb2xhdGlvbjtcbiAgfVxuXG4gIHZhciBjYWNoZWQgPSByZWdpc3RlcmVkW2ludGVycG9sYXRpb25dO1xuICByZXR1cm4gY2FjaGVkICE9PSB1bmRlZmluZWQgPyBjYWNoZWQgOiBpbnRlcnBvbGF0aW9uO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTdHJpbmdGcm9tT2JqZWN0KG1lcmdlZFByb3BzLCByZWdpc3RlcmVkLCBvYmopIHtcbiAgdmFyIHN0cmluZyA9ICcnO1xuXG4gIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iai5sZW5ndGg7IGkrKykge1xuICAgICAgc3RyaW5nICs9IGhhbmRsZUludGVycG9sYXRpb24obWVyZ2VkUHJvcHMsIHJlZ2lzdGVyZWQsIG9ialtpXSkgKyBcIjtcIjtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yICh2YXIgX2tleSBpbiBvYmopIHtcbiAgICAgIHZhciB2YWx1ZSA9IG9ialtfa2V5XTtcblxuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKHJlZ2lzdGVyZWQgIT0gbnVsbCAmJiByZWdpc3RlcmVkW3ZhbHVlXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc3RyaW5nICs9IF9rZXkgKyBcIntcIiArIHJlZ2lzdGVyZWRbdmFsdWVdICsgXCJ9XCI7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNQcm9jZXNzYWJsZVZhbHVlKHZhbHVlKSkge1xuICAgICAgICAgIHN0cmluZyArPSBwcm9jZXNzU3R5bGVOYW1lKF9rZXkpICsgXCI6XCIgKyBwcm9jZXNzU3R5bGVWYWx1ZShfa2V5LCB2YWx1ZSkgKyBcIjtcIjtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKF9rZXkgPT09ICdOT19DT01QT05FTlRfU0VMRUNUT1InICYmIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbXBvbmVudCBzZWxlY3RvcnMgY2FuIG9ubHkgYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIEBlbW90aW9uL2JhYmVsLXBsdWdpbi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB0eXBlb2YgdmFsdWVbMF0gPT09ICdzdHJpbmcnICYmIChyZWdpc3RlcmVkID09IG51bGwgfHwgcmVnaXN0ZXJlZFt2YWx1ZVswXV0gPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgdmFsdWUubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICBpZiAoaXNQcm9jZXNzYWJsZVZhbHVlKHZhbHVlW19pXSkpIHtcbiAgICAgICAgICAgICAgc3RyaW5nICs9IHByb2Nlc3NTdHlsZU5hbWUoX2tleSkgKyBcIjpcIiArIHByb2Nlc3NTdHlsZVZhbHVlKF9rZXksIHZhbHVlW19pXSkgKyBcIjtcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGludGVycG9sYXRlZCA9IGhhbmRsZUludGVycG9sYXRpb24obWVyZ2VkUHJvcHMsIHJlZ2lzdGVyZWQsIHZhbHVlKTtcblxuICAgICAgICAgIHN3aXRjaCAoX2tleSkge1xuICAgICAgICAgICAgY2FzZSAnYW5pbWF0aW9uJzpcbiAgICAgICAgICAgIGNhc2UgJ2FuaW1hdGlvbk5hbWUnOlxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgc3RyaW5nICs9IHByb2Nlc3NTdHlsZU5hbWUoX2tleSkgKyBcIjpcIiArIGludGVycG9sYXRlZCArIFwiO1wiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfa2V5ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihVTkRFRklORURfQVNfT0JKRUNUX0tFWV9FUlJPUik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc3RyaW5nICs9IF9rZXkgKyBcIntcIiArIGludGVycG9sYXRlZCArIFwifVwiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHN0cmluZztcbn1cblxudmFyIGxhYmVsUGF0dGVybiA9IC9sYWJlbDpcXHMqKFteXFxzO1xcbntdKylcXHMqKDt8JCkvZztcbnZhciBzb3VyY2VNYXBQYXR0ZXJuO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICBzb3VyY2VNYXBQYXR0ZXJuID0gL1xcL1xcKiNcXHNzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb25cXC9qc29uO1xcUytcXHMrXFwqXFwvL2c7XG59IC8vIHRoaXMgaXMgdGhlIGN1cnNvciBmb3Iga2V5ZnJhbWVzXG4vLyBrZXlmcmFtZXMgYXJlIHN0b3JlZCBvbiB0aGUgU2VyaWFsaXplZFN0eWxlcyBvYmplY3QgYXMgYSBsaW5rZWQgbGlzdFxuXG5cbnZhciBjdXJzb3I7XG52YXIgc2VyaWFsaXplU3R5bGVzID0gZnVuY3Rpb24gc2VyaWFsaXplU3R5bGVzKGFyZ3MsIHJlZ2lzdGVyZWQsIG1lcmdlZFByb3BzKSB7XG4gIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ29iamVjdCcgJiYgYXJnc1swXSAhPT0gbnVsbCAmJiBhcmdzWzBdLnN0eWxlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGFyZ3NbMF07XG4gIH1cblxuICB2YXIgc3RyaW5nTW9kZSA9IHRydWU7XG4gIHZhciBzdHlsZXMgPSAnJztcbiAgY3Vyc29yID0gdW5kZWZpbmVkO1xuICB2YXIgc3RyaW5ncyA9IGFyZ3NbMF07XG5cbiAgaWYgKHN0cmluZ3MgPT0gbnVsbCB8fCBzdHJpbmdzLnJhdyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc3RyaW5nTW9kZSA9IGZhbHNlO1xuICAgIHN0eWxlcyArPSBoYW5kbGVJbnRlcnBvbGF0aW9uKG1lcmdlZFByb3BzLCByZWdpc3RlcmVkLCBzdHJpbmdzKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBzdHJpbmdzWzBdID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoSUxMRUdBTF9FU0NBUEVfU0VRVUVOQ0VfRVJST1IpO1xuICAgIH1cblxuICAgIHN0eWxlcyArPSBzdHJpbmdzWzBdO1xuICB9IC8vIHdlIHN0YXJ0IGF0IDEgc2luY2Ugd2UndmUgYWxyZWFkeSBoYW5kbGVkIHRoZSBmaXJzdCBhcmdcblxuXG4gIGZvciAodmFyIGkgPSAxOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgIHN0eWxlcyArPSBoYW5kbGVJbnRlcnBvbGF0aW9uKG1lcmdlZFByb3BzLCByZWdpc3RlcmVkLCBhcmdzW2ldKTtcblxuICAgIGlmIChzdHJpbmdNb2RlKSB7XG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBzdHJpbmdzW2ldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihJTExFR0FMX0VTQ0FQRV9TRVFVRU5DRV9FUlJPUik7XG4gICAgICB9XG5cbiAgICAgIHN0eWxlcyArPSBzdHJpbmdzW2ldO1xuICAgIH1cbiAgfVxuXG4gIHZhciBzb3VyY2VNYXA7XG5cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBzdHlsZXMgPSBzdHlsZXMucmVwbGFjZShzb3VyY2VNYXBQYXR0ZXJuLCBmdW5jdGlvbiAobWF0Y2gpIHtcbiAgICAgIHNvdXJjZU1hcCA9IG1hdGNoO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH0pO1xuICB9IC8vIHVzaW5nIGEgZ2xvYmFsIHJlZ2V4IHdpdGggLmV4ZWMgaXMgc3RhdGVmdWwgc28gbGFzdEluZGV4IGhhcyB0byBiZSByZXNldCBlYWNoIHRpbWVcblxuXG4gIGxhYmVsUGF0dGVybi5sYXN0SW5kZXggPSAwO1xuICB2YXIgaWRlbnRpZmllck5hbWUgPSAnJztcbiAgdmFyIG1hdGNoOyAvLyBodHRwczovL2VzYmVuY2guY29tL2JlbmNoLzViODA5YzJjZjI5NDk4MDBhMGY2MWZiNVxuXG4gIHdoaWxlICgobWF0Y2ggPSBsYWJlbFBhdHRlcm4uZXhlYyhzdHlsZXMpKSAhPT0gbnVsbCkge1xuICAgIGlkZW50aWZpZXJOYW1lICs9ICctJyArIC8vICRGbG93Rml4TWUgd2Uga25vdyBpdCdzIG5vdCBudWxsXG4gICAgbWF0Y2hbMV07XG4gIH1cblxuICB2YXIgbmFtZSA9IGhhc2hTdHJpbmdfX2RlZmF1bHRbJ2RlZmF1bHQnXShzdHlsZXMpICsgaWRlbnRpZmllck5hbWU7XG5cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAvLyAkRmxvd0ZpeE1lIFNlcmlhbGl6ZWRTdHlsZXMgdHlwZSBkb2Vzbid0IGhhdmUgdG9TdHJpbmcgcHJvcGVydHkgKGFuZCB3ZSBkb24ndCB3YW50IHRvIGFkZCBpdClcbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHN0eWxlczogc3R5bGVzLFxuICAgICAgbWFwOiBzb3VyY2VNYXAsXG4gICAgICBuZXh0OiBjdXJzb3IsXG4gICAgICB0b1N0cmluZzogZnVuY3Rpb24gdG9TdHJpbmcoKSB7XG4gICAgICAgIHJldHVybiBcIllvdSBoYXZlIHRyaWVkIHRvIHN0cmluZ2lmeSBvYmplY3QgcmV0dXJuZWQgZnJvbSBgY3NzYCBmdW5jdGlvbi4gSXQgaXNuJ3Qgc3VwcG9zZWQgdG8gYmUgdXNlZCBkaXJlY3RseSAoZS5nLiBhcyB2YWx1ZSBvZiB0aGUgYGNsYXNzTmFtZWAgcHJvcCksIGJ1dCByYXRoZXIgaGFuZGVkIHRvIGVtb3Rpb24gc28gaXQgY2FuIGhhbmRsZSBpdCAoZS5nLiBhcyB2YWx1ZSBvZiBgY3NzYCBwcm9wKS5cIjtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBuYW1lLFxuICAgIHN0eWxlczogc3R5bGVzLFxuICAgIG5leHQ6IGN1cnNvclxuICB9O1xufTtcblxuZXhwb3J0cy5zZXJpYWxpemVTdHlsZXMgPSBzZXJpYWxpemVTdHlsZXM7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbi8qXG5cbkJhc2VkIG9mZiBnbGFtb3IncyBTdHlsZVNoZWV0LCB0aGFua3MgU3VuaWwg4p2k77iPXG5cbmhpZ2ggcGVyZm9ybWFuY2UgU3R5bGVTaGVldCBmb3IgY3NzLWluLWpzIHN5c3RlbXNcblxuLSB1c2VzIG11bHRpcGxlIHN0eWxlIHRhZ3MgYmVoaW5kIHRoZSBzY2VuZXMgZm9yIG1pbGxpb25zIG9mIHJ1bGVzXG4tIHVzZXMgYGluc2VydFJ1bGVgIGZvciBhcHBlbmRpbmcgaW4gcHJvZHVjdGlvbiBmb3IgKm11Y2gqIGZhc3RlciBwZXJmb3JtYW5jZVxuXG4vLyB1c2FnZVxuXG5pbXBvcnQgeyBTdHlsZVNoZWV0IH0gZnJvbSAnQGVtb3Rpb24vc2hlZXQnXG5cbmxldCBzdHlsZVNoZWV0ID0gbmV3IFN0eWxlU2hlZXQoeyBrZXk6ICcnLCBjb250YWluZXI6IGRvY3VtZW50LmhlYWQgfSlcblxuc3R5bGVTaGVldC5pbnNlcnQoJyNib3ggeyBib3JkZXI6IDFweCBzb2xpZCByZWQ7IH0nKVxuLSBhcHBlbmRzIGEgY3NzIHJ1bGUgaW50byB0aGUgc3R5bGVzaGVldFxuXG5zdHlsZVNoZWV0LmZsdXNoKClcbi0gZW1wdGllcyB0aGUgc3R5bGVzaGVldCBvZiBhbGwgaXRzIGNvbnRlbnRzXG5cbiovXG4vLyAkRmxvd0ZpeE1lXG5mdW5jdGlvbiBzaGVldEZvclRhZyh0YWcpIHtcbiAgaWYgKHRhZy5zaGVldCkge1xuICAgIC8vICRGbG93Rml4TWVcbiAgICByZXR1cm4gdGFnLnNoZWV0O1xuICB9IC8vIHRoaXMgd2VpcmRuZXNzIGJyb3VnaHQgdG8geW91IGJ5IGZpcmVmb3hcblxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkb2N1bWVudC5zdHlsZVNoZWV0cy5sZW5ndGg7IGkrKykge1xuICAgIGlmIChkb2N1bWVudC5zdHlsZVNoZWV0c1tpXS5vd25lck5vZGUgPT09IHRhZykge1xuICAgICAgLy8gJEZsb3dGaXhNZVxuICAgICAgcmV0dXJuIGRvY3VtZW50LnN0eWxlU2hlZXRzW2ldO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVTdHlsZUVsZW1lbnQob3B0aW9ucykge1xuICB2YXIgdGFnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgdGFnLnNldEF0dHJpYnV0ZSgnZGF0YS1lbW90aW9uJywgb3B0aW9ucy5rZXkpO1xuXG4gIGlmIChvcHRpb25zLm5vbmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICB0YWcuc2V0QXR0cmlidXRlKCdub25jZScsIG9wdGlvbnMubm9uY2UpO1xuICB9XG5cbiAgdGFnLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKSk7XG4gIHRhZy5zZXRBdHRyaWJ1dGUoJ2RhdGEtcycsICcnKTtcbiAgcmV0dXJuIHRhZztcbn1cblxudmFyIFN0eWxlU2hlZXQgPSAvKiNfX1BVUkVfXyovZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBTdHlsZVNoZWV0KG9wdGlvbnMpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgdGhpcy5faW5zZXJ0VGFnID0gZnVuY3Rpb24gKHRhZykge1xuICAgICAgdmFyIGJlZm9yZTtcblxuICAgICAgaWYgKF90aGlzLnRhZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmIChfdGhpcy5pbnNlcnRpb25Qb2ludCkge1xuICAgICAgICAgIGJlZm9yZSA9IF90aGlzLmluc2VydGlvblBvaW50Lm5leHRTaWJsaW5nO1xuICAgICAgICB9IGVsc2UgaWYgKF90aGlzLnByZXBlbmQpIHtcbiAgICAgICAgICBiZWZvcmUgPSBfdGhpcy5jb250YWluZXIuZmlyc3RDaGlsZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBiZWZvcmUgPSBfdGhpcy5iZWZvcmU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJlZm9yZSA9IF90aGlzLnRhZ3NbX3RoaXMudGFncy5sZW5ndGggLSAxXS5uZXh0U2libGluZztcbiAgICAgIH1cblxuICAgICAgX3RoaXMuY29udGFpbmVyLmluc2VydEJlZm9yZSh0YWcsIGJlZm9yZSk7XG5cbiAgICAgIF90aGlzLnRhZ3MucHVzaCh0YWcpO1xuICAgIH07XG5cbiAgICB0aGlzLmlzU3BlZWR5ID0gb3B0aW9ucy5zcGVlZHkgPT09IHVuZGVmaW5lZCA/IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicgOiBvcHRpb25zLnNwZWVkeTtcbiAgICB0aGlzLnRhZ3MgPSBbXTtcbiAgICB0aGlzLmN0ciA9IDA7XG4gICAgdGhpcy5ub25jZSA9IG9wdGlvbnMubm9uY2U7IC8vIGtleSBpcyB0aGUgdmFsdWUgb2YgdGhlIGRhdGEtZW1vdGlvbiBhdHRyaWJ1dGUsIGl0J3MgdXNlZCB0byBpZGVudGlmeSBkaWZmZXJlbnQgc2hlZXRzXG5cbiAgICB0aGlzLmtleSA9IG9wdGlvbnMua2V5O1xuICAgIHRoaXMuY29udGFpbmVyID0gb3B0aW9ucy5jb250YWluZXI7XG4gICAgdGhpcy5wcmVwZW5kID0gb3B0aW9ucy5wcmVwZW5kO1xuICAgIHRoaXMuaW5zZXJ0aW9uUG9pbnQgPSBvcHRpb25zLmluc2VydGlvblBvaW50O1xuICAgIHRoaXMuYmVmb3JlID0gbnVsbDtcbiAgfVxuXG4gIHZhciBfcHJvdG8gPSBTdHlsZVNoZWV0LnByb3RvdHlwZTtcblxuICBfcHJvdG8uaHlkcmF0ZSA9IGZ1bmN0aW9uIGh5ZHJhdGUobm9kZXMpIHtcbiAgICBub2Rlcy5mb3JFYWNoKHRoaXMuX2luc2VydFRhZyk7XG4gIH07XG5cbiAgX3Byb3RvLmluc2VydCA9IGZ1bmN0aW9uIGluc2VydChydWxlKSB7XG4gICAgLy8gdGhlIG1heCBsZW5ndGggaXMgaG93IG1hbnkgcnVsZXMgd2UgaGF2ZSBwZXIgc3R5bGUgdGFnLCBpdCdzIDY1MDAwIGluIHNwZWVkeSBtb2RlXG4gICAgLy8gaXQncyAxIGluIGRldiBiZWNhdXNlIHdlIGluc2VydCBzb3VyY2UgbWFwcyB0aGF0IG1hcCBhIHNpbmdsZSBydWxlIHRvIGEgbG9jYXRpb25cbiAgICAvLyBhbmQgeW91IGNhbiBvbmx5IGhhdmUgb25lIHNvdXJjZSBtYXAgcGVyIHN0eWxlIHRhZ1xuICAgIGlmICh0aGlzLmN0ciAlICh0aGlzLmlzU3BlZWR5ID8gNjUwMDAgOiAxKSA9PT0gMCkge1xuICAgICAgdGhpcy5faW5zZXJ0VGFnKGNyZWF0ZVN0eWxlRWxlbWVudCh0aGlzKSk7XG4gICAgfVxuXG4gICAgdmFyIHRhZyA9IHRoaXMudGFnc1t0aGlzLnRhZ3MubGVuZ3RoIC0gMV07XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgdmFyIGlzSW1wb3J0UnVsZSA9IHJ1bGUuY2hhckNvZGVBdCgwKSA9PT0gNjQgJiYgcnVsZS5jaGFyQ29kZUF0KDEpID09PSAxMDU7XG5cbiAgICAgIGlmIChpc0ltcG9ydFJ1bGUgJiYgdGhpcy5fYWxyZWFkeUluc2VydGVkT3JkZXJJbnNlbnNpdGl2ZVJ1bGUpIHtcbiAgICAgICAgLy8gdGhpcyB3b3VsZCBvbmx5IGNhdXNlIHByb2JsZW0gaW4gc3BlZWR5IG1vZGVcbiAgICAgICAgLy8gYnV0IHdlIGRvbid0IHdhbnQgZW5hYmxpbmcgc3BlZWR5IHRvIGFmZmVjdCB0aGUgb2JzZXJ2YWJsZSBiZWhhdmlvclxuICAgICAgICAvLyBzbyB3ZSByZXBvcnQgdGhpcyBlcnJvciBhdCBhbGwgdGltZXNcbiAgICAgICAgY29uc29sZS5lcnJvcihcIllvdSdyZSBhdHRlbXB0aW5nIHRvIGluc2VydCB0aGUgZm9sbG93aW5nIHJ1bGU6XFxuXCIgKyBydWxlICsgJ1xcblxcbmBAaW1wb3J0YCBydWxlcyBtdXN0IGJlIGJlZm9yZSBhbGwgb3RoZXIgdHlwZXMgb2YgcnVsZXMgaW4gYSBzdHlsZXNoZWV0IGJ1dCBvdGhlciBydWxlcyBoYXZlIGFscmVhZHkgYmVlbiBpbnNlcnRlZC4gUGxlYXNlIGVuc3VyZSB0aGF0IGBAaW1wb3J0YCBydWxlcyBhcmUgYmVmb3JlIGFsbCBvdGhlciBydWxlcy4nKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2FscmVhZHlJbnNlcnRlZE9yZGVySW5zZW5zaXRpdmVSdWxlID0gdGhpcy5fYWxyZWFkeUluc2VydGVkT3JkZXJJbnNlbnNpdGl2ZVJ1bGUgfHwgIWlzSW1wb3J0UnVsZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc1NwZWVkeSkge1xuICAgICAgdmFyIHNoZWV0ID0gc2hlZXRGb3JUYWcodGFnKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gdGhpcyBpcyB0aGUgdWx0cmFmYXN0IHZlcnNpb24sIHdvcmtzIGFjcm9zcyBicm93c2Vyc1xuICAgICAgICAvLyB0aGUgYmlnIGRyYXdiYWNrIGlzIHRoYXQgdGhlIGNzcyB3b24ndCBiZSBlZGl0YWJsZSBpbiBkZXZ0b29sc1xuICAgICAgICBzaGVldC5pbnNlcnRSdWxlKHJ1bGUsIHNoZWV0LmNzc1J1bGVzLmxlbmd0aCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmICEvOigtbW96LXBsYWNlaG9sZGVyfC1tb3otZm9jdXMtaW5uZXJ8LW1vei1mb2N1c3Jpbmd8LW1zLWlucHV0LXBsYWNlaG9sZGVyfC1tb3otcmVhZC13cml0ZXwtbW96LXJlYWQtb25seXwtbXMtY2xlYXIpey8udGVzdChydWxlKSkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJUaGVyZSB3YXMgYSBwcm9ibGVtIGluc2VydGluZyB0aGUgZm9sbG93aW5nIHJ1bGU6IFxcXCJcIiArIHJ1bGUgKyBcIlxcXCJcIiwgZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGFnLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHJ1bGUpKTtcbiAgICB9XG5cbiAgICB0aGlzLmN0cisrO1xuICB9O1xuXG4gIF9wcm90by5mbHVzaCA9IGZ1bmN0aW9uIGZsdXNoKCkge1xuICAgIC8vICRGbG93Rml4TWVcbiAgICB0aGlzLnRhZ3MuZm9yRWFjaChmdW5jdGlvbiAodGFnKSB7XG4gICAgICByZXR1cm4gdGFnLnBhcmVudE5vZGUgJiYgdGFnLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGFnKTtcbiAgICB9KTtcbiAgICB0aGlzLnRhZ3MgPSBbXTtcbiAgICB0aGlzLmN0ciA9IDA7XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgdGhpcy5fYWxyZWFkeUluc2VydGVkT3JkZXJJbnNlbnNpdGl2ZVJ1bGUgPSBmYWxzZTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIFN0eWxlU2hlZXQ7XG59KCk7XG5cbmV4cG9ydHMuU3R5bGVTaGVldCA9IFN0eWxlU2hlZXQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbnZhciB1bml0bGVzc0tleXMgPSB7XG4gIGFuaW1hdGlvbkl0ZXJhdGlvbkNvdW50OiAxLFxuICBib3JkZXJJbWFnZU91dHNldDogMSxcbiAgYm9yZGVySW1hZ2VTbGljZTogMSxcbiAgYm9yZGVySW1hZ2VXaWR0aDogMSxcbiAgYm94RmxleDogMSxcbiAgYm94RmxleEdyb3VwOiAxLFxuICBib3hPcmRpbmFsR3JvdXA6IDEsXG4gIGNvbHVtbkNvdW50OiAxLFxuICBjb2x1bW5zOiAxLFxuICBmbGV4OiAxLFxuICBmbGV4R3JvdzogMSxcbiAgZmxleFBvc2l0aXZlOiAxLFxuICBmbGV4U2hyaW5rOiAxLFxuICBmbGV4TmVnYXRpdmU6IDEsXG4gIGZsZXhPcmRlcjogMSxcbiAgZ3JpZFJvdzogMSxcbiAgZ3JpZFJvd0VuZDogMSxcbiAgZ3JpZFJvd1NwYW46IDEsXG4gIGdyaWRSb3dTdGFydDogMSxcbiAgZ3JpZENvbHVtbjogMSxcbiAgZ3JpZENvbHVtbkVuZDogMSxcbiAgZ3JpZENvbHVtblNwYW46IDEsXG4gIGdyaWRDb2x1bW5TdGFydDogMSxcbiAgbXNHcmlkUm93OiAxLFxuICBtc0dyaWRSb3dTcGFuOiAxLFxuICBtc0dyaWRDb2x1bW46IDEsXG4gIG1zR3JpZENvbHVtblNwYW46IDEsXG4gIGZvbnRXZWlnaHQ6IDEsXG4gIGxpbmVIZWlnaHQ6IDEsXG4gIG9wYWNpdHk6IDEsXG4gIG9yZGVyOiAxLFxuICBvcnBoYW5zOiAxLFxuICB0YWJTaXplOiAxLFxuICB3aWRvd3M6IDEsXG4gIHpJbmRleDogMSxcbiAgem9vbTogMSxcbiAgV2Via2l0TGluZUNsYW1wOiAxLFxuICAvLyBTVkctcmVsYXRlZCBwcm9wZXJ0aWVzXG4gIGZpbGxPcGFjaXR5OiAxLFxuICBmbG9vZE9wYWNpdHk6IDEsXG4gIHN0b3BPcGFjaXR5OiAxLFxuICBzdHJva2VEYXNoYXJyYXk6IDEsXG4gIHN0cm9rZURhc2hvZmZzZXQ6IDEsXG4gIHN0cm9rZU1pdGVybGltaXQ6IDEsXG4gIHN0cm9rZU9wYWNpdHk6IDEsXG4gIHN0cm9rZVdpZHRoOiAxXG59O1xuXG5leHBvcnRzLmRlZmF1bHQgPSB1bml0bGVzc0tleXM7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbnZhciBpc0Jyb3dzZXIgPSBcIm9iamVjdFwiICE9PSAndW5kZWZpbmVkJztcbmZ1bmN0aW9uIGdldFJlZ2lzdGVyZWRTdHlsZXMocmVnaXN0ZXJlZCwgcmVnaXN0ZXJlZFN0eWxlcywgY2xhc3NOYW1lcykge1xuICB2YXIgcmF3Q2xhc3NOYW1lID0gJyc7XG4gIGNsYXNzTmFtZXMuc3BsaXQoJyAnKS5mb3JFYWNoKGZ1bmN0aW9uIChjbGFzc05hbWUpIHtcbiAgICBpZiAocmVnaXN0ZXJlZFtjbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlZ2lzdGVyZWRTdHlsZXMucHVzaChyZWdpc3RlcmVkW2NsYXNzTmFtZV0gKyBcIjtcIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJhd0NsYXNzTmFtZSArPSBjbGFzc05hbWUgKyBcIiBcIjtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcmF3Q2xhc3NOYW1lO1xufVxudmFyIHJlZ2lzdGVyU3R5bGVzID0gZnVuY3Rpb24gcmVnaXN0ZXJTdHlsZXMoY2FjaGUsIHNlcmlhbGl6ZWQsIGlzU3RyaW5nVGFnKSB7XG4gIHZhciBjbGFzc05hbWUgPSBjYWNoZS5rZXkgKyBcIi1cIiArIHNlcmlhbGl6ZWQubmFtZTtcblxuICBpZiAoIC8vIHdlIG9ubHkgbmVlZCB0byBhZGQgdGhlIHN0eWxlcyB0byB0aGUgcmVnaXN0ZXJlZCBjYWNoZSBpZiB0aGVcbiAgLy8gY2xhc3MgbmFtZSBjb3VsZCBiZSB1c2VkIGZ1cnRoZXIgZG93blxuICAvLyB0aGUgdHJlZSBidXQgaWYgaXQncyBhIHN0cmluZyB0YWcsIHdlIGtub3cgaXQgd29uJ3RcbiAgLy8gc28gd2UgZG9uJ3QgaGF2ZSB0byBhZGQgaXQgdG8gcmVnaXN0ZXJlZCBjYWNoZS5cbiAgLy8gdGhpcyBpbXByb3ZlcyBtZW1vcnkgdXNhZ2Ugc2luY2Ugd2UgY2FuIGF2b2lkIHN0b3JpbmcgdGhlIHdob2xlIHN0eWxlIHN0cmluZ1xuICAoaXNTdHJpbmdUYWcgPT09IGZhbHNlIHx8IC8vIHdlIG5lZWQgdG8gYWx3YXlzIHN0b3JlIGl0IGlmIHdlJ3JlIGluIGNvbXBhdCBtb2RlIGFuZFxuICAvLyBpbiBub2RlIHNpbmNlIGVtb3Rpb24tc2VydmVyIHJlbGllcyBvbiB3aGV0aGVyIGEgc3R5bGUgaXMgaW5cbiAgLy8gdGhlIHJlZ2lzdGVyZWQgY2FjaGUgdG8ga25vdyB3aGV0aGVyIGEgc3R5bGUgaXMgZ2xvYmFsIG9yIG5vdFxuICAvLyBhbHNvLCBub3RlIHRoYXQgdGhpcyBjaGVjayB3aWxsIGJlIGRlYWQgY29kZSBlbGltaW5hdGVkIGluIHRoZSBicm93c2VyXG4gIGlzQnJvd3NlciA9PT0gZmFsc2UgKSAmJiBjYWNoZS5yZWdpc3RlcmVkW2NsYXNzTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgIGNhY2hlLnJlZ2lzdGVyZWRbY2xhc3NOYW1lXSA9IHNlcmlhbGl6ZWQuc3R5bGVzO1xuICB9XG59O1xudmFyIGluc2VydFN0eWxlcyA9IGZ1bmN0aW9uIGluc2VydFN0eWxlcyhjYWNoZSwgc2VyaWFsaXplZCwgaXNTdHJpbmdUYWcpIHtcbiAgcmVnaXN0ZXJTdHlsZXMoY2FjaGUsIHNlcmlhbGl6ZWQsIGlzU3RyaW5nVGFnKTtcbiAgdmFyIGNsYXNzTmFtZSA9IGNhY2hlLmtleSArIFwiLVwiICsgc2VyaWFsaXplZC5uYW1lO1xuXG4gIGlmIChjYWNoZS5pbnNlcnRlZFtzZXJpYWxpemVkLm5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgY3VycmVudCA9IHNlcmlhbGl6ZWQ7XG5cbiAgICBkbyB7XG4gICAgICB2YXIgbWF5YmVTdHlsZXMgPSBjYWNoZS5pbnNlcnQoc2VyaWFsaXplZCA9PT0gY3VycmVudCA/IFwiLlwiICsgY2xhc3NOYW1lIDogJycsIGN1cnJlbnQsIGNhY2hlLnNoZWV0LCB0cnVlKTtcblxuICAgICAgY3VycmVudCA9IGN1cnJlbnQubmV4dDtcbiAgICB9IHdoaWxlIChjdXJyZW50ICE9PSB1bmRlZmluZWQpO1xuICB9XG59O1xuXG5leHBvcnRzLmdldFJlZ2lzdGVyZWRTdHlsZXMgPSBnZXRSZWdpc3RlcmVkU3R5bGVzO1xuZXhwb3J0cy5pbnNlcnRTdHlsZXMgPSBpbnNlcnRTdHlsZXM7XG5leHBvcnRzLnJlZ2lzdGVyU3R5bGVzID0gcmVnaXN0ZXJTdHlsZXM7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbnZhciB3ZWFrTWVtb2l6ZSA9IGZ1bmN0aW9uIHdlYWtNZW1vaXplKGZ1bmMpIHtcbiAgLy8gJEZsb3dGaXhNZSBmbG93IGRvZXNuJ3QgaW5jbHVkZSBhbGwgbm9uLXByaW1pdGl2ZSB0eXBlcyBhcyBhbGxvd2VkIGZvciB3ZWFrbWFwc1xuICB2YXIgY2FjaGUgPSBuZXcgV2Vha01hcCgpO1xuICByZXR1cm4gZnVuY3Rpb24gKGFyZykge1xuICAgIGlmIChjYWNoZS5oYXMoYXJnKSkge1xuICAgICAgLy8gJEZsb3dGaXhNZVxuICAgICAgcmV0dXJuIGNhY2hlLmdldChhcmcpO1xuICAgIH1cblxuICAgIHZhciByZXQgPSBmdW5jKGFyZyk7XG4gICAgY2FjaGUuc2V0KGFyZywgcmV0KTtcbiAgICByZXR1cm4gcmV0O1xuICB9O1xufTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gd2Vha01lbW9pemU7XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBfX2ltcG9ydERlZmF1bHQgPSAodGhpcyAmJiB0aGlzLl9faW1wb3J0RGVmYXVsdCkgfHwgZnVuY3Rpb24gKG1vZCkge1xuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgXCJkZWZhdWx0XCI6IG1vZCB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmV4cG9ydHMuQ3VzdG9tU2Nyb2xsYmFyID0gdm9pZCAwO1xuY29uc3QgdXRpbF8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCIuL3V0aWxcIikpO1xuY29uc3QgZGVmYXVsdE9wdGlvbiA9IHtcbiAgICBjb250ZW50czogXCIuY3VzdG9tLXNjcm9sbC1jb250ZW50c1wiLFxuICAgIHdyYXA6IFwiLmN1c3RvbS1zY3JvbGwtd3JhcFwiLFxuICAgIGJhcjogXCIuY3VzdG9tLXNjcm9sbC1iYXJcIixcbiAgICBkaXJlY3Rpb246IFwidmVydGljYWxcIlxufTtcbmNsYXNzIEN1c3RvbVNjcm9sbGJhciB7XG4gICAgY29uc3RydWN0b3IodGFyZ2V0LCBvcHRpb24gPSB7fSkge1xuICAgICAgICB0aGlzLndhdGNoU2Nyb2xsID0gKCkgPT4ge1xuICAgICAgICAgICAgc3dpdGNoICh0aGlzLm9wdGlvbi5kaXJlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjYXNlIFwiaG9yaXpvbnRhbFwiOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jb250ZW50cy5zY3JvbGxMZWZ0O1xuICAgICAgICAgICAgICAgIGNhc2UgXCJ2ZXJ0aWNhbFwiOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jb250ZW50cy5zY3JvbGxUb3A7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY3JlYXRlV3JhcHBlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRzSFRNTCA9IHRoaXMuY29udGVudHMuaW5uZXJIVE1MO1xuICAgICAgICAgICAgdGhpcy5jb250ZW50cy5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz1cImN1c3RvbS1zY3JvbGxiYXItY29udGVudC13cmFwcGVyXCI+JHtjb250ZW50c0hUTUx9PC9kaXY+YDtcbiAgICAgICAgICAgIHRoaXMuY29udGVudHNJbm5lciA9IHRoaXMudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoXCIuY3VzdG9tLXNjcm9sbGJhci1jb250ZW50LXdyYXBwZXJcIik7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMubW92ZVNjcm9sbGJhciA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNjcm9sbFZhbCA9IHRoaXMud2F0Y2hTY3JvbGwoKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRzSGVpZ2h0ID0gdGhpcy5jb250ZW50cy5jbGllbnRIZWlnaHQ7XG4gICAgICAgICAgICBsZXQgc2Nyb2xsUmFuZ2UgPSAwO1xuICAgICAgICAgICAgaWYgKHRoaXMuY29udGVudHNJbm5lcikge1xuICAgICAgICAgICAgICAgIHNjcm9sbFJhbmdlID0gdGhpcy5jb250ZW50c0lubmVyLmNsaWVudEhlaWdodCAtIGNvbnRlbnRzSGVpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYmFySGVpZ2h0ID0gdGhpcy5iYXIuY2xpZW50SGVpZ2h0O1xuICAgICAgICAgICAgY29uc3QgcmFuZ2UgPSB0aGlzLndyYXAuY2xpZW50SGVpZ2h0IC0gYmFySGVpZ2h0O1xuICAgICAgICAgICAgY29uc3QgYmFyUG9zaXRpb24gPSB1dGlsXzEuZGVmYXVsdC5tYXBwaW5nKHNjcm9sbFZhbCwgMCwgc2Nyb2xsUmFuZ2UsIDAsIHJhbmdlKTtcbiAgICAgICAgICAgIHRoaXMuYmFyLnN0eWxlLnRvcCA9IGAke01hdGguYWJzKGJhclBvc2l0aW9uKX1weGA7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMubmVlZFNjcm9sbEJhciA9ICgpID0+IHtcbiAgICAgICAgICAgIHZhciBfYTtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbnRlbnRzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCA+PSAoKF9hID0gdGhpcy5jb250ZW50c0lubmVyKSA9PT0gbnVsbCB8fCBfYSA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2EuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0KSkge1xuICAgICAgICAgICAgICAgIHRoaXMud3JhcC5jbGFzc0xpc3QuYWRkKFwiaXMtbm9TY3JvbGxcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMub25CYXJDbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuY2xpY2tGbGFnID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuY29udGVudHMuc3R5bGUudXNlclNlbGVjdCA9IFwibm9uZVwiO1xuICAgICAgICAgICAgdGhpcy5iYXIuY2xhc3NMaXN0LmFkZChcImlzLWdyYWJiaW5nXCIpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLm9uQmFyVW5DbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuY2xpY2tGbGFnID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmNvbnRlbnRzLnN0eWxlLnVzZXJTZWxlY3QgPSBcIlwiO1xuICAgICAgICAgICAgdGhpcy5iYXIuY2xhc3NMaXN0LnJlbW92ZShcImlzLWdyYWJiaW5nXCIpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmZvbGxvd1Njcm9sbEJhciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5jbGlja0ZsYWcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtb3VzZVkgPSBlLnBhZ2VZO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjcm9sbFdyYXBQb3NZID0gdGhpcy53cmFwLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcDtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXJQb3MgPSBtb3VzZVkgLSBzY3JvbGxXcmFwUG9zWTtcbiAgICAgICAgICAgICAgICBjb25zdCByYW5nZSA9IHRoaXMud3JhcC5jbGllbnRIZWlnaHQgLSB0aGlzLmJhci5jbGllbnRIZWlnaHQ7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudHNIZWlnaHQgPSB0aGlzLmNvbnRlbnRzLmNsaWVudEhlaWdodDtcbiAgICAgICAgICAgICAgICBjb25zdCBzY3JvbGxSYW5nZSA9IHRoaXMuY29udGVudHNJbm5lciA/IHRoaXMuY29udGVudHNJbm5lci5jbGllbnRIZWlnaHQgLSBjb250ZW50c0hlaWdodCA6IDA7XG4gICAgICAgICAgICAgICAgaWYgKGJhclBvcyA+PSAwICYmIGJhclBvcyA8PSByYW5nZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmJhci5zdHlsZS50b3AgPSBgJHtiYXJQb3N9cHhgO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzY3JvbGxQb3MgPSB1dGlsXzEuZGVmYXVsdC5tYXBwaW5nKGJhclBvcywgMCwgcmFuZ2UsIDAsIHNjcm9sbFJhbmdlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb250ZW50cy5zY3JvbGxUbygwLCBzY3JvbGxQb3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5hZGRFdmVudCA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuY29udGVudHMuYWRkRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCB0aGlzLm1vdmVTY3JvbGxiYXIpO1xuICAgICAgICAgICAgdGhpcy5iYXIuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLm9uQmFyQ2xpY2spO1xuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIHRoaXMub25CYXJVbkNsaWNrKTtcbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIHRoaXMuZm9sbG93U2Nyb2xsQmFyKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5kZXN0cm95ID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5jb250ZW50cy5yZW1vdmVFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHRoaXMubW92ZVNjcm9sbGJhcik7XG4gICAgICAgICAgICB0aGlzLmJhci5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5vbkJhckNsaWNrKTtcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCB0aGlzLm9uQmFyVW5DbGljayk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMudGFyZ2V0ID0gdHlwZW9mIHRhcmdldCA9PT0gXCJzdHJpbmdcIiA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGFyZ2V0KSA6IHRhcmdldDtcbiAgICAgICAgdGhpcy5vcHRpb24gPSBPYmplY3QuYXNzaWduKGRlZmF1bHRPcHRpb24sIG9wdGlvbik7XG4gICAgICAgIHRoaXMuY29udGVudHMgPSB0aGlzLnRhcmdldC5xdWVyeVNlbGVjdG9yKHRoaXMub3B0aW9uLmNvbnRlbnRzKTtcbiAgICAgICAgdGhpcy5iYXIgPSB0aGlzLnRhcmdldC5xdWVyeVNlbGVjdG9yKHRoaXMub3B0aW9uLmJhcik7XG4gICAgICAgIHRoaXMud3JhcCA9IHRoaXMudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRpb24ud3JhcCk7XG4gICAgICAgIHRoaXMuY29udGVudHNJbm5lciA9IG51bGw7XG4gICAgICAgIHRoaXMuY2xpY2tGbGFnID0gZmFsc2U7XG4gICAgICAgIHRoaXMuY3JlYXRlV3JhcHBlcigpO1xuICAgICAgICB0aGlzLmFkZEV2ZW50KCk7XG4gICAgICAgIHRoaXMubmVlZFNjcm9sbEJhcigpO1xuICAgIH1cbn1cbmV4cG9ydHMuQ3VzdG9tU2Nyb2xsYmFyID0gQ3VzdG9tU2Nyb2xsYmFyO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5jbGFzcyBVdGlsIHtcbiAgICBzdGF0aWMgbWFwcGluZyh2YWx1ZSwgbWluVmFsLCBtYXhWYWwsIHRyYW5zZm9ybU1pblZhbCwgdHJhbnNmb3JtTWF4VmFsKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybURpZmYgPSB0cmFuc2Zvcm1NYXhWYWwgLSB0cmFuc2Zvcm1NaW5WYWw7XG4gICAgICAgIGNvbnN0IGRpZmYgPSBtYXhWYWwgLSBtaW5WYWw7XG4gICAgICAgIGNvbnN0IHBlcmNlbnRhZ2UgPSB2YWx1ZSAvIGRpZmY7XG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1EaWZmICogcGVyY2VudGFnZSArIHRyYW5zZm9ybU1pblZhbDtcbiAgICB9XG59XG5leHBvcnRzLmRlZmF1bHQgPSBVdGlsO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5leHBvcnRzLmNyZWF0ZUNvbXBvbmVudCA9IGV4cG9ydHMuQ29tcG9uZW50ID0gZXhwb3J0cy5QYWdlID0gdm9pZCAwO1xuY2xhc3MgQmFzZSB7XG4gICAgY29uc3RydWN0b3IoX3RhZykge1xuICAgICAgICB0aGlzLnNldEVtb3Rpb24gPSAoKSA9PiB7XG4gICAgICAgICAgICB2YXIgX2E7XG4gICAgICAgICAgICBsZXQgc3R5bGUgPSBudWxsO1xuICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUpIHtcbiAgICAgICAgICAgICAgICBzdHlsZSA9IHRoaXMuc3R5bGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHlsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlbGVjdG9yID0gYFske3RoaXMudGFnfS1jc3NdYDtcbiAgICAgICAgICAgICAgICBjb25zdCBzdHlsZVRhcmdldHMgPSAoX2EgPSB0aGlzLnNlY3Rpb24pID09PSBudWxsIHx8IF9hID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfYS5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgICAgICAgICAgICBpZiAoc3R5bGVUYXJnZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHN0eWxlVGFyZ2V0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VsZWN0b3IgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKGAke3RoaXMudGFnfS1jc3NgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldC5jbGFzc0xpc3QuYWRkKHN0eWxlW3NlbGVjdG9yXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc3RhcnRXYXRjaGVyID0gKGtleXMpID0+IHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGtleXMpLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICBsZXQgbGFzdFZhbCA9IHRoaXNba2V5XTtcbiAgICAgICAgICAgICAgICB0aGlzLndhdGNoRnVuY3Nba2V5XSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpc1trZXldICE9PSBsYXN0VmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0VmFsID0gdGhpc1trZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAga2V5c1trZXldKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMud2F0Y2hGdW5jc1trZXldKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHRoaXMud2F0Y2hGdW5jc1trZXldKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fYWRkRXZlbnRzID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXZlbnRzID0gW1wiY2xpY2tcIiwgXCJzY3JvbGxcIiwgXCJsb2FkXCIsIFwibW91c2VlbnRlclwiLCBcIm1vdXNlbGVhdmVcIiwgXCJtb3VzZW92ZXJcIiwgXCJjaGFuZ2VcIl07XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGV2ZW50IG9mIGV2ZW50cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV2ZW50TmFtZSA9IGAke3RoaXMudGFnfS0ke2V2ZW50fWA7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2VjdGlvbiAhPT0gdW5kZWZpbmVkICYmIHRoaXMuc2VjdGlvbiAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRzID0gdGhpcy5zZWN0aW9uLnF1ZXJ5U2VsZWN0b3JBbGwoXCJbXCIgKyBldmVudE5hbWUgKyBcIl1cIik7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZ1bmMgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKGV2ZW50TmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhZGRGdW5jID0gKGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnVuYyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbZnVuY10oZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBhZGRGdW5jKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy50YWcgPSBfdGFnO1xuICAgICAgICB0aGlzLnJlZnMgPSB7fTtcbiAgICAgICAgdGhpcy53YXRjaEZ1bmNzID0ge307XG4gICAgfVxuICAgIGluaXQoY2IpIHtcbiAgICAgICAgaWYgKHRoaXMuc2VjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fYWRkRXZlbnRzKCk7XG4gICAgICAgICAgICB0aGlzLmdldFJlZmVyZW5jZSgpO1xuICAgICAgICAgICAgdGhpcy5zZXRXYXRjaCgpO1xuICAgICAgICAgICAgdGhpcy5zZXRFbW90aW9uKCk7XG4gICAgICAgICAgICBpZiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHNldFdhdGNoKCkge1xuICAgICAgICBpZiAodGhpcy53YXRjaCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMud2F0Y2goKTtcbiAgICAgICAgICAgIHRoaXMuc3RhcnRXYXRjaGVyKGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZW1vdmVXYXRjaCgpIHtcbiAgICAgICAgT2JqZWN0LmtleXModGhpcy53YXRjaEZ1bmNzKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy53YXRjaEZ1bmNzW2tleV0pO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZ2V0UmVmZXJlbmNlKCkge1xuICAgICAgICBjb25zdCB0YWcgPSBgJHt0aGlzLnRhZ30tcmVmYDtcbiAgICAgICAgaWYgKHRoaXMuc2VjdGlvbikge1xuICAgICAgICAgICAgY29uc3QgcmVmcyA9IHRoaXMuc2VjdGlvbi5xdWVyeVNlbGVjdG9yQWxsKGBbJHt0YWd9XWApO1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgcmVmcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZSA9IHJlZi5nZXRBdHRyaWJ1dGUodGFnKTtcbiAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVmc1thdHRyaWJ1dGVdID0gcmVmO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGlmICh0aGlzLmJlZm9yZURlc3Ryb3kpIHtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIHRoaXMuYmVmb3JlRGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgfVxufVxuY2xhc3MgUGFnZSBleHRlbmRzIEJhc2Uge1xuICAgIGNvbnN0cnVjdG9yKF90YWcsIG51bSA9IG51bGwpIHtcbiAgICAgICAgc3VwZXIoX3RhZyk7XG4gICAgICAgIHRoaXMudGFnID0gX3RhZztcbiAgICAgICAgdGhpcy5zZWN0aW9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoX3RhZyk7XG4gICAgfVxufVxuZXhwb3J0cy5QYWdlID0gUGFnZTtcbmNsYXNzIENvbXBvbmVudCBleHRlbmRzIEJhc2Uge1xuICAgIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgICAgIHN1cGVyKHByb3BzLnRhZyk7XG4gICAgICAgIHRoaXMuc2VjdGlvbiA9IHByb3BzLmNvbXBvbmVudDtcbiAgICB9XG59XG5leHBvcnRzLkNvbXBvbmVudCA9IENvbXBvbmVudDtcbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudChfdGFnTmFtZSwgX2NsYXNzKSB7XG4gICAgY29uc3QgdGFyZ2V0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoX3RhZ05hbWUpO1xuICAgIGNvbnN0IHJlZmFjdG9yVGFnID0gX3RhZ05hbWUucmVwbGFjZShcIiNcIiwgXCJcIikucmVwbGFjZShcIi5cIiwgXCJcIik7XG4gICAgY29uc3QgY2xhc3NlcyA9IFtdO1xuICAgIGlmIChfdGFnTmFtZS5pbmNsdWRlcyhcIiNcIikpIHtcbiAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKG5ldyBfY2xhc3MocmVmYWN0b3JUYWcpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChfdGFnTmFtZS5pbmNsdWRlcyhcIi5cIikpIHtcbiAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKG5ldyBfY2xhc3MoeyBjb21wb25lbnQ6IHRhcmdldCwgdGFnOiByZWZhY3RvclRhZyB9KSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNsYXNzZXM7XG59XG5leHBvcnRzLmNyZWF0ZUNvbXBvbmVudCA9IGNyZWF0ZUNvbXBvbmVudDtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIoZnVuY3Rpb24oZSxyKXt0eXBlb2YgZXhwb3J0cz09PVwib2JqZWN0XCImJnR5cGVvZiBtb2R1bGUhPT1cInVuZGVmaW5lZFwiP3IoZXhwb3J0cyk6dHlwZW9mIGRlZmluZT09PVwiZnVuY3Rpb25cIiYmZGVmaW5lLmFtZD9kZWZpbmUoW1wiZXhwb3J0c1wiXSxyKTooZT1lfHxzZWxmLHIoZS5zdHlsaXM9e30pKX0pKHRoaXMsKGZ1bmN0aW9uKGUpe1widXNlIHN0cmljdFwiO3ZhciByPVwiLW1zLVwiO3ZhciBhPVwiLW1vei1cIjt2YXIgYz1cIi13ZWJraXQtXCI7dmFyIHQ9XCJjb21tXCI7dmFyIG49XCJydWxlXCI7dmFyIHM9XCJkZWNsXCI7dmFyIGk9XCJAcGFnZVwiO3ZhciB1PVwiQG1lZGlhXCI7dmFyIG89XCJAaW1wb3J0XCI7dmFyIGY9XCJAY2hhcnNldFwiO3ZhciBsPVwiQHZpZXdwb3J0XCI7dmFyIGg9XCJAc3VwcG9ydHNcIjt2YXIgcD1cIkBkb2N1bWVudFwiO3ZhciB2PVwiQG5hbWVzcGFjZVwiO3ZhciBiPVwiQGtleWZyYW1lc1wiO3ZhciBkPVwiQGZvbnQtZmFjZVwiO3ZhciBtPVwiQGNvdW50ZXItc3R5bGVcIjt2YXIgdz1cIkBmb250LWZlYXR1cmUtdmFsdWVzXCI7dmFyIGs9TWF0aC5hYnM7dmFyICQ9U3RyaW5nLmZyb21DaGFyQ29kZTt2YXIgZz1PYmplY3QuYXNzaWduO2Z1bmN0aW9uIHgoZSxyKXtyZXR1cm4oKChyPDwyXk8oZSwwKSk8PDJeTyhlLDEpKTw8Ml5PKGUsMikpPDwyXk8oZSwzKX1mdW5jdGlvbiBFKGUpe3JldHVybiBlLnRyaW0oKX1mdW5jdGlvbiB5KGUscil7cmV0dXJuKGU9ci5leGVjKGUpKT9lWzBdOmV9ZnVuY3Rpb24gVChlLHIsYSl7cmV0dXJuIGUucmVwbGFjZShyLGEpfWZ1bmN0aW9uIEEoZSxyKXtyZXR1cm4gZS5pbmRleE9mKHIpfWZ1bmN0aW9uIE8oZSxyKXtyZXR1cm4gZS5jaGFyQ29kZUF0KHIpfDB9ZnVuY3Rpb24gQyhlLHIsYSl7cmV0dXJuIGUuc2xpY2UocixhKX1mdW5jdGlvbiBNKGUpe3JldHVybiBlLmxlbmd0aH1mdW5jdGlvbiBTKGUpe3JldHVybiBlLmxlbmd0aH1mdW5jdGlvbiBSKGUscil7cmV0dXJuIHIucHVzaChlKSxlfWZ1bmN0aW9uIHooZSxyKXtyZXR1cm4gZS5tYXAocikuam9pbihcIlwiKX1lLmxpbmU9MTtlLmNvbHVtbj0xO2UubGVuZ3RoPTA7ZS5wb3NpdGlvbj0wO2UuY2hhcmFjdGVyPTA7ZS5jaGFyYWN0ZXJzPVwiXCI7ZnVuY3Rpb24gTihyLGEsYyx0LG4scyxpKXtyZXR1cm57dmFsdWU6cixyb290OmEscGFyZW50OmMsdHlwZTp0LHByb3BzOm4sY2hpbGRyZW46cyxsaW5lOmUubGluZSxjb2x1bW46ZS5jb2x1bW4sbGVuZ3RoOmkscmV0dXJuOlwiXCJ9fWZ1bmN0aW9uIFAoZSxyKXtyZXR1cm4gZyhOKFwiXCIsbnVsbCxudWxsLFwiXCIsbnVsbCxudWxsLDApLGUse2xlbmd0aDotZS5sZW5ndGh9LHIpfWZ1bmN0aW9uIGooKXtyZXR1cm4gZS5jaGFyYWN0ZXJ9ZnVuY3Rpb24gVSgpe2UuY2hhcmFjdGVyPWUucG9zaXRpb24+MD9PKGUuY2hhcmFjdGVycywtLWUucG9zaXRpb24pOjA7aWYoZS5jb2x1bW4tLSxlLmNoYXJhY3Rlcj09PTEwKWUuY29sdW1uPTEsZS5saW5lLS07cmV0dXJuIGUuY2hhcmFjdGVyfWZ1bmN0aW9uIF8oKXtlLmNoYXJhY3Rlcj1lLnBvc2l0aW9uPGUubGVuZ3RoP08oZS5jaGFyYWN0ZXJzLGUucG9zaXRpb24rKyk6MDtpZihlLmNvbHVtbisrLGUuY2hhcmFjdGVyPT09MTApZS5jb2x1bW49MSxlLmxpbmUrKztyZXR1cm4gZS5jaGFyYWN0ZXJ9ZnVuY3Rpb24gRigpe3JldHVybiBPKGUuY2hhcmFjdGVycyxlLnBvc2l0aW9uKX1mdW5jdGlvbiBJKCl7cmV0dXJuIGUucG9zaXRpb259ZnVuY3Rpb24gTChyLGEpe3JldHVybiBDKGUuY2hhcmFjdGVycyxyLGEpfWZ1bmN0aW9uIEQoZSl7c3dpdGNoKGUpe2Nhc2UgMDpjYXNlIDk6Y2FzZSAxMDpjYXNlIDEzOmNhc2UgMzI6cmV0dXJuIDU7Y2FzZSAzMzpjYXNlIDQzOmNhc2UgNDQ6Y2FzZSA0NzpjYXNlIDYyOmNhc2UgNjQ6Y2FzZSAxMjY6Y2FzZSA1OTpjYXNlIDEyMzpjYXNlIDEyNTpyZXR1cm4gNDtjYXNlIDU4OnJldHVybiAzO2Nhc2UgMzQ6Y2FzZSAzOTpjYXNlIDQwOmNhc2UgOTE6cmV0dXJuIDI7Y2FzZSA0MTpjYXNlIDkzOnJldHVybiAxfXJldHVybiAwfWZ1bmN0aW9uIEsocil7cmV0dXJuIGUubGluZT1lLmNvbHVtbj0xLGUubGVuZ3RoPU0oZS5jaGFyYWN0ZXJzPXIpLGUucG9zaXRpb249MCxbXX1mdW5jdGlvbiBWKHIpe3JldHVybiBlLmNoYXJhY3RlcnM9XCJcIixyfWZ1bmN0aW9uIFcocil7cmV0dXJuIEUoTChlLnBvc2l0aW9uLTEsWihyPT09OTE/cisyOnI9PT00MD9yKzE6cikpKX1mdW5jdGlvbiBZKGUpe3JldHVybiBWKEcoSyhlKSkpfWZ1bmN0aW9uIEIocil7d2hpbGUoZS5jaGFyYWN0ZXI9RigpKWlmKGUuY2hhcmFjdGVyPDMzKV8oKTtlbHNlIGJyZWFrO3JldHVybiBEKHIpPjJ8fEQoZS5jaGFyYWN0ZXIpPjM/XCJcIjpcIiBcIn1mdW5jdGlvbiBHKHIpe3doaWxlKF8oKSlzd2l0Y2goRChlLmNoYXJhY3Rlcikpe2Nhc2UgMDpSKEooZS5wb3NpdGlvbi0xKSxyKTticmVhaztjYXNlIDI6UihXKGUuY2hhcmFjdGVyKSxyKTticmVhaztkZWZhdWx0OlIoJChlLmNoYXJhY3Rlcikscil9cmV0dXJuIHJ9ZnVuY3Rpb24gSChyLGEpe3doaWxlKC0tYSYmXygpKWlmKGUuY2hhcmFjdGVyPDQ4fHxlLmNoYXJhY3Rlcj4xMDJ8fGUuY2hhcmFjdGVyPjU3JiZlLmNoYXJhY3Rlcjw2NXx8ZS5jaGFyYWN0ZXI+NzAmJmUuY2hhcmFjdGVyPDk3KWJyZWFrO3JldHVybiBMKHIsSSgpKyhhPDYmJkYoKT09MzImJl8oKT09MzIpKX1mdW5jdGlvbiBaKHIpe3doaWxlKF8oKSlzd2l0Y2goZS5jaGFyYWN0ZXIpe2Nhc2UgcjpyZXR1cm4gZS5wb3NpdGlvbjtjYXNlIDM0OmNhc2UgMzk6aWYociE9PTM0JiZyIT09MzkpWihlLmNoYXJhY3Rlcik7YnJlYWs7Y2FzZSA0MDppZihyPT09NDEpWihyKTticmVhaztjYXNlIDkyOl8oKTticmVha31yZXR1cm4gZS5wb3NpdGlvbn1mdW5jdGlvbiBxKHIsYSl7d2hpbGUoXygpKWlmKHIrZS5jaGFyYWN0ZXI9PT00NysxMClicmVhaztlbHNlIGlmKHIrZS5jaGFyYWN0ZXI9PT00Mis0MiYmRigpPT09NDcpYnJlYWs7cmV0dXJuXCIvKlwiK0woYSxlLnBvc2l0aW9uLTEpK1wiKlwiKyQocj09PTQ3P3I6XygpKX1mdW5jdGlvbiBKKHIpe3doaWxlKCFEKEYoKSkpXygpO3JldHVybiBMKHIsZS5wb3NpdGlvbil9ZnVuY3Rpb24gUShlKXtyZXR1cm4gVihYKFwiXCIsbnVsbCxudWxsLG51bGwsW1wiXCJdLGU9SyhlKSwwLFswXSxlKSl9ZnVuY3Rpb24gWChlLHIsYSxjLHQsbixzLGksdSl7dmFyIG89MDt2YXIgZj0wO3ZhciBsPXM7dmFyIGg9MDt2YXIgcD0wO3ZhciB2PTA7dmFyIGI9MTt2YXIgZD0xO3ZhciBtPTE7dmFyIHc9MDt2YXIgaz1cIlwiO3ZhciBnPXQ7dmFyIHg9bjt2YXIgRT1jO3ZhciB5PWs7d2hpbGUoZClzd2l0Y2godj13LHc9XygpKXtjYXNlIDQwOmlmKHYhPTEwOCYmeS5jaGFyQ29kZUF0KGwtMSk9PTU4KXtpZihBKHkrPVQoVyh3KSxcIiZcIixcIiZcXGZcIiksXCImXFxmXCIpIT0tMSltPS0xO2JyZWFrfWNhc2UgMzQ6Y2FzZSAzOTpjYXNlIDkxOnkrPVcodyk7YnJlYWs7Y2FzZSA5OmNhc2UgMTA6Y2FzZSAxMzpjYXNlIDMyOnkrPUIodik7YnJlYWs7Y2FzZSA5Mjp5Kz1IKEkoKS0xLDcpO2NvbnRpbnVlO2Nhc2UgNDc6c3dpdGNoKEYoKSl7Y2FzZSA0MjpjYXNlIDQ3OlIocmUocShfKCksSSgpKSxyLGEpLHUpO2JyZWFrO2RlZmF1bHQ6eSs9XCIvXCJ9YnJlYWs7Y2FzZSAxMjMqYjppW28rK109TSh5KSptO2Nhc2UgMTI1KmI6Y2FzZSA1OTpjYXNlIDA6c3dpdGNoKHcpe2Nhc2UgMDpjYXNlIDEyNTpkPTA7Y2FzZSA1OStmOmlmKHA+MCYmTSh5KS1sKVIocD4zMj9hZSh5K1wiO1wiLGMsYSxsLTEpOmFlKFQoeSxcIiBcIixcIlwiKStcIjtcIixjLGEsbC0yKSx1KTticmVhaztjYXNlIDU5OnkrPVwiO1wiO2RlZmF1bHQ6UihFPWVlKHkscixhLG8sZix0LGksayxnPVtdLHg9W10sbCksbik7aWYodz09PTEyMylpZihmPT09MClYKHkscixFLEUsZyxuLGwsaSx4KTtlbHNlIHN3aXRjaChoKXtjYXNlIDEwMDpjYXNlIDEwOTpjYXNlIDExNTpYKGUsRSxFLGMmJlIoZWUoZSxFLEUsMCwwLHQsaSxrLHQsZz1bXSxsKSx4KSx0LHgsbCxpLGM/Zzp4KTticmVhaztkZWZhdWx0OlgoeSxFLEUsRSxbXCJcIl0seCwwLGkseCl9fW89Zj1wPTAsYj1tPTEsaz15PVwiXCIsbD1zO2JyZWFrO2Nhc2UgNTg6bD0xK00oeSkscD12O2RlZmF1bHQ6aWYoYjwxKWlmKHc9PTEyMyktLWI7ZWxzZSBpZih3PT0xMjUmJmIrKz09MCYmVSgpPT0xMjUpY29udGludWU7c3dpdGNoKHkrPSQodyksdypiKXtjYXNlIDM4Om09Zj4wPzE6KHkrPVwiXFxmXCIsLTEpO2JyZWFrO2Nhc2UgNDQ6aVtvKytdPShNKHkpLTEpKm0sbT0xO2JyZWFrO2Nhc2UgNjQ6aWYoRigpPT09NDUpeSs9VyhfKCkpO2g9RigpLGY9bD1NKGs9eSs9SihJKCkpKSx3Kys7YnJlYWs7Y2FzZSA0NTppZih2PT09NDUmJk0oeSk9PTIpYj0wfX1yZXR1cm4gbn1mdW5jdGlvbiBlZShlLHIsYSxjLHQscyxpLHUsbyxmLGwpe3ZhciBoPXQtMTt2YXIgcD10PT09MD9zOltcIlwiXTt2YXIgdj1TKHApO2Zvcih2YXIgYj0wLGQ9MCxtPTA7YjxjOysrYilmb3IodmFyIHc9MCwkPUMoZSxoKzEsaD1rKGQ9aVtiXSkpLGc9ZTt3PHY7Kyt3KWlmKGc9RShkPjA/cFt3XStcIiBcIiskOlQoJCwvJlxcZi9nLHBbd10pKSlvW20rK109ZztyZXR1cm4gTihlLHIsYSx0PT09MD9uOnUsbyxmLGwpfWZ1bmN0aW9uIHJlKGUscixhKXtyZXR1cm4gTihlLHIsYSx0LCQoaigpKSxDKGUsMiwtMiksMCl9ZnVuY3Rpb24gYWUoZSxyLGEsYyl7cmV0dXJuIE4oZSxyLGEscyxDKGUsMCxjKSxDKGUsYysxLC0xKSxjKX1mdW5jdGlvbiBjZShlLHQpe3N3aXRjaCh4KGUsdCkpe2Nhc2UgNTEwMzpyZXR1cm4gYytcInByaW50LVwiK2UrZTtjYXNlIDU3Mzc6Y2FzZSA0MjAxOmNhc2UgMzE3NzpjYXNlIDM0MzM6Y2FzZSAxNjQxOmNhc2UgNDQ1NzpjYXNlIDI5MjE6Y2FzZSA1NTcyOmNhc2UgNjM1NjpjYXNlIDU4NDQ6Y2FzZSAzMTkxOmNhc2UgNjY0NTpjYXNlIDMwMDU6Y2FzZSA2MzkxOmNhc2UgNTg3OTpjYXNlIDU2MjM6Y2FzZSA2MTM1OmNhc2UgNDU5OTpjYXNlIDQ4NTU6Y2FzZSA0MjE1OmNhc2UgNjM4OTpjYXNlIDUxMDk6Y2FzZSA1MzY1OmNhc2UgNTYyMTpjYXNlIDM4Mjk6cmV0dXJuIGMrZStlO2Nhc2UgNTM0OTpjYXNlIDQyNDY6Y2FzZSA0ODEwOmNhc2UgNjk2ODpjYXNlIDI3NTY6cmV0dXJuIGMrZSthK2UrcitlK2U7Y2FzZSA2ODI4OmNhc2UgNDI2ODpyZXR1cm4gYytlK3IrZStlO2Nhc2UgNjE2NTpyZXR1cm4gYytlK3IrXCJmbGV4LVwiK2UrZTtjYXNlIDUxODc6cmV0dXJuIGMrZStUKGUsLyhcXHcrKS4rKDpbXl0rKS8sYytcImJveC0kMSQyXCIrcitcImZsZXgtJDEkMlwiKStlO2Nhc2UgNTQ0MzpyZXR1cm4gYytlK3IrXCJmbGV4LWl0ZW0tXCIrVChlLC9mbGV4LXwtc2VsZi8sXCJcIikrZTtjYXNlIDQ2NzU6cmV0dXJuIGMrZStyK1wiZmxleC1saW5lLXBhY2tcIitUKGUsL2FsaWduLWNvbnRlbnR8ZmxleC18LXNlbGYvLFwiXCIpK2U7Y2FzZSA1NTQ4OnJldHVybiBjK2UrcitUKGUsXCJzaHJpbmtcIixcIm5lZ2F0aXZlXCIpK2U7Y2FzZSA1MjkyOnJldHVybiBjK2UrcitUKGUsXCJiYXNpc1wiLFwicHJlZmVycmVkLXNpemVcIikrZTtjYXNlIDYwNjA6cmV0dXJuIGMrXCJib3gtXCIrVChlLFwiLWdyb3dcIixcIlwiKStjK2UrcitUKGUsXCJncm93XCIsXCJwb3NpdGl2ZVwiKStlO2Nhc2UgNDU1NDpyZXR1cm4gYytUKGUsLyhbXi1dKSh0cmFuc2Zvcm0pL2csXCIkMVwiK2MrXCIkMlwiKStlO2Nhc2UgNjE4NzpyZXR1cm4gVChUKFQoZSwvKHpvb20tfGdyYWIpLyxjK1wiJDFcIiksLyhpbWFnZS1zZXQpLyxjK1wiJDFcIiksZSxcIlwiKStlO2Nhc2UgNTQ5NTpjYXNlIDM5NTk6cmV0dXJuIFQoZSwvKGltYWdlLXNldFxcKFteXSopLyxjK1wiJDFcIitcIiRgJDFcIik7Y2FzZSA0OTY4OnJldHVybiBUKFQoZSwvKC4rOikoZmxleC0pPyguKikvLGMrXCJib3gtcGFjazokM1wiK3IrXCJmbGV4LXBhY2s6JDNcIiksL3MuKy1iW147XSsvLFwianVzdGlmeVwiKStjK2UrZTtjYXNlIDQwOTU6Y2FzZSAzNTgzOmNhc2UgNDA2ODpjYXNlIDI1MzI6cmV0dXJuIFQoZSwvKC4rKS1pbmxpbmUoLispLyxjK1wiJDEkMlwiKStlO2Nhc2UgODExNjpjYXNlIDcwNTk6Y2FzZSA1NzUzOmNhc2UgNTUzNTpjYXNlIDU0NDU6Y2FzZSA1NzAxOmNhc2UgNDkzMzpjYXNlIDQ2Nzc6Y2FzZSA1NTMzOmNhc2UgNTc4OTpjYXNlIDUwMjE6Y2FzZSA0NzY1OmlmKE0oZSktMS10PjYpc3dpdGNoKE8oZSx0KzEpKXtjYXNlIDEwOTppZihPKGUsdCs0KSE9PTQ1KWJyZWFrO2Nhc2UgMTAyOnJldHVybiBUKGUsLyguKzopKC4rKS0oW15dKykvLFwiJDFcIitjK1wiJDItJDNcIitcIiQxXCIrYSsoTyhlLHQrMyk9PTEwOD9cIiQzXCI6XCIkMi0kM1wiKSkrZTtjYXNlIDExNTpyZXR1cm5+QShlLFwic3RyZXRjaFwiKT9jZShUKGUsXCJzdHJldGNoXCIsXCJmaWxsLWF2YWlsYWJsZVwiKSx0KStlOmV9YnJlYWs7Y2FzZSA0OTQ5OmlmKE8oZSx0KzEpIT09MTE1KWJyZWFrO2Nhc2UgNjQ0NDpzd2l0Y2goTyhlLE0oZSktMy0ofkEoZSxcIiFpbXBvcnRhbnRcIikmJjEwKSkpe2Nhc2UgMTA3OnJldHVybiBUKGUsXCI6XCIsXCI6XCIrYykrZTtjYXNlIDEwMTpyZXR1cm4gVChlLC8oLis6KShbXjshXSspKDt8IS4rKT8vLFwiJDFcIitjKyhPKGUsMTQpPT09NDU/XCJpbmxpbmUtXCI6XCJcIikrXCJib3gkM1wiK1wiJDFcIitjK1wiJDIkM1wiK1wiJDFcIityK1wiJDJib3gkM1wiKStlfWJyZWFrO2Nhc2UgNTkzNjpzd2l0Y2goTyhlLHQrMTEpKXtjYXNlIDExNDpyZXR1cm4gYytlK3IrVChlLC9bc3ZoXVxcdystW3RibHJdezJ9LyxcInRiXCIpK2U7Y2FzZSAxMDg6cmV0dXJuIGMrZStyK1QoZSwvW3N2aF1cXHcrLVt0YmxyXXsyfS8sXCJ0Yi1ybFwiKStlO2Nhc2UgNDU6cmV0dXJuIGMrZStyK1QoZSwvW3N2aF1cXHcrLVt0YmxyXXsyfS8sXCJsclwiKStlfXJldHVybiBjK2UrcitlK2V9cmV0dXJuIGV9ZnVuY3Rpb24gdGUoZSxyKXt2YXIgYT1cIlwiO3ZhciBjPVMoZSk7Zm9yKHZhciB0PTA7dDxjO3QrKylhKz1yKGVbdF0sdCxlLHIpfHxcIlwiO3JldHVybiBhfWZ1bmN0aW9uIG5lKGUscixhLGMpe3N3aXRjaChlLnR5cGUpe2Nhc2UgbzpjYXNlIHM6cmV0dXJuIGUucmV0dXJuPWUucmV0dXJufHxlLnZhbHVlO2Nhc2UgdDpyZXR1cm5cIlwiO2Nhc2UgYjpyZXR1cm4gZS5yZXR1cm49ZS52YWx1ZStcIntcIit0ZShlLmNoaWxkcmVuLGMpK1wifVwiO2Nhc2UgbjplLnZhbHVlPWUucHJvcHMuam9pbihcIixcIil9cmV0dXJuIE0oYT10ZShlLmNoaWxkcmVuLGMpKT9lLnJldHVybj1lLnZhbHVlK1wie1wiK2ErXCJ9XCI6XCJcIn1mdW5jdGlvbiBzZShlKXt2YXIgcj1TKGUpO3JldHVybiBmdW5jdGlvbihhLGMsdCxuKXt2YXIgcz1cIlwiO2Zvcih2YXIgaT0wO2k8cjtpKyspcys9ZVtpXShhLGMsdCxuKXx8XCJcIjtyZXR1cm4gc319ZnVuY3Rpb24gaWUoZSl7cmV0dXJuIGZ1bmN0aW9uKHIpe2lmKCFyLnJvb3QpaWYocj1yLnJldHVybillKHIpfX1mdW5jdGlvbiB1ZShlLHQsaSx1KXtpZihlLmxlbmd0aD4tMSlpZighZS5yZXR1cm4pc3dpdGNoKGUudHlwZSl7Y2FzZSBzOmUucmV0dXJuPWNlKGUudmFsdWUsZS5sZW5ndGgpO2JyZWFrO2Nhc2UgYjpyZXR1cm4gdGUoW1AoZSx7dmFsdWU6VChlLnZhbHVlLFwiQFwiLFwiQFwiK2MpfSldLHUpO2Nhc2UgbjppZihlLmxlbmd0aClyZXR1cm4geihlLnByb3BzLChmdW5jdGlvbih0KXtzd2l0Y2goeSh0LC8oOjpwbGFjXFx3K3w6cmVhZC1cXHcrKS8pKXtjYXNlXCI6cmVhZC1vbmx5XCI6Y2FzZVwiOnJlYWQtd3JpdGVcIjpyZXR1cm4gdGUoW1AoZSx7cHJvcHM6W1QodCwvOihyZWFkLVxcdyspLyxcIjpcIithK1wiJDFcIildfSldLHUpO2Nhc2VcIjo6cGxhY2Vob2xkZXJcIjpyZXR1cm4gdGUoW1AoZSx7cHJvcHM6W1QodCwvOihwbGFjXFx3KykvLFwiOlwiK2MrXCJpbnB1dC0kMVwiKV19KSxQKGUse3Byb3BzOltUKHQsLzoocGxhY1xcdyspLyxcIjpcIithK1wiJDFcIildfSksUChlLHtwcm9wczpbVCh0LC86KHBsYWNcXHcrKS8scitcImlucHV0LSQxXCIpXX0pXSx1KX1yZXR1cm5cIlwifSkpfX1mdW5jdGlvbiBvZShlKXtzd2l0Y2goZS50eXBlKXtjYXNlIG46ZS5wcm9wcz1lLnByb3BzLm1hcCgoZnVuY3Rpb24ocil7cmV0dXJuIHooWShyKSwoZnVuY3Rpb24ocixhLGMpe3N3aXRjaChPKHIsMCkpe2Nhc2UgMTI6cmV0dXJuIEMociwxLE0ocikpO2Nhc2UgMDpjYXNlIDQwOmNhc2UgNDM6Y2FzZSA2MjpjYXNlIDEyNjpyZXR1cm4gcjtjYXNlIDU4OmlmKGNbKythXT09PVwiZ2xvYmFsXCIpY1thXT1cIlwiLGNbKythXT1cIlxcZlwiK0MoY1thXSxhPTEsLTEpO2Nhc2UgMzI6cmV0dXJuIGE9PT0xP1wiXCI6cjtkZWZhdWx0OnN3aXRjaChhKXtjYXNlIDA6ZT1yO3JldHVybiBTKGMpPjE/XCJcIjpyO2Nhc2UgYT1TKGMpLTE6Y2FzZSAyOnJldHVybiBhPT09Mj9yK2UrZTpyK2U7ZGVmYXVsdDpyZXR1cm4gcn19fSkpfSkpfX1lLkNIQVJTRVQ9ZjtlLkNPTU1FTlQ9dDtlLkNPVU5URVJfU1RZTEU9bTtlLkRFQ0xBUkFUSU9OPXM7ZS5ET0NVTUVOVD1wO2UuRk9OVF9GQUNFPWQ7ZS5GT05UX0ZFQVRVUkVfVkFMVUVTPXc7ZS5JTVBPUlQ9bztlLktFWUZSQU1FUz1iO2UuTUVESUE9dTtlLk1PWj1hO2UuTVM9cjtlLk5BTUVTUEFDRT12O2UuUEFHRT1pO2UuUlVMRVNFVD1uO2UuU1VQUE9SVFM9aDtlLlZJRVdQT1JUPWw7ZS5XRUJLSVQ9YztlLmFicz1rO2UuYWxsb2M9SztlLmFwcGVuZD1SO2UuYXNzaWduPWc7ZS5jYXJldD1JO2UuY2hhcj1qO2UuY2hhcmF0PU87ZS5jb21iaW5lPXo7ZS5jb21tZW50PXJlO2UuY29tbWVudGVyPXE7ZS5jb21waWxlPVE7ZS5jb3B5PVA7ZS5kZWFsbG9jPVY7ZS5kZWNsYXJhdGlvbj1hZTtlLmRlbGltaXQ9VztlLmRlbGltaXRlcj1aO2UuZXNjYXBpbmc9SDtlLmZyb209JDtlLmhhc2g9eDtlLmlkZW50aWZpZXI9SjtlLmluZGV4b2Y9QTtlLm1hdGNoPXk7ZS5taWRkbGV3YXJlPXNlO2UubmFtZXNwYWNlPW9lO2UubmV4dD1fO2Uubm9kZT1OO2UucGFyc2U9WDtlLnBlZWs9RjtlLnByZWZpeD1jZTtlLnByZWZpeGVyPXVlO2UucHJldj1VO2UucmVwbGFjZT1UO2UucnVsZXNldD1lZTtlLnJ1bGVzaGVldD1pZTtlLnNlcmlhbGl6ZT10ZTtlLnNpemVvZj1TO2Uuc2xpY2U9TDtlLnN0cmluZ2lmeT1uZTtlLnN0cmxlbj1NO2Uuc3Vic3RyPUM7ZS50b2tlbj1EO2UudG9rZW5pemU9WTtlLnRva2VuaXplcj1HO2UudHJpbT1FO2Uud2hpdGVzcGFjZT1CO09iamVjdC5kZWZpbmVQcm9wZXJ0eShlLFwiX19lc01vZHVsZVwiLHt2YWx1ZTp0cnVlfSl9KSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zdHlsaXMuanMubWFwXG4iLCJpbXBvcnQgKiBhcyBWaWV3IGZyb20gXCJAaXRreWsvdmlld1wiO1xuaW1wb3J0IHtjc3N9IGZyb20gXCJAZW1vdGlvbi9jc3NcIjtcblxuY2xhc3MgQ29kZSBleHRlbmRzIFZpZXcuQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgdGhpcy5pbml0KCgpPT57XG5cbiAgICB9KVxuICB9XG5cbiAgY2xpY2tKUyA9IChlOiBFdmVudCkgPT4ge1xuICAgIHRoaXMuY2xlYXJBY3RpdmUoKTtcbiAgICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldCBhcyBIVE1MQnV0dG9uRWxlbWVudDtcbiAgICBjb25zdCB0YWcgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKFwiZGF0YS10eXBlXCIpO1xuICAgIHRoaXMucmVmc1t0YWddLmNsYXNzTGlzdC5hZGQoXCJpcy1hY3RpdmVcIik7XG4gICAgdGFyZ2V0LmNsYXNzTGlzdC5hZGQoXCJpcy1hY3RpdmVcIik7XG4gIH1cblxuICBjbGVhckFjdGl2ZSA9ICgpID0+IHtcbiAgICBjb25zdCB0YWdzID0gW1wianNcIiwgXCJodG1sXCIsIFwiY3NzXCJdO1xuICAgIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICAgIHRoaXMucmVmc1t0YWddLmNsYXNzTGlzdC5yZW1vdmUoXCJpcy1hY3RpdmVcIik7XG4gICAgfVxuICAgIGNvbnN0IGJ1dHRvbkFycmF5ID0gdGhpcy5yZWZzLmJ1dHRvbnMucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKTtcbiAgICBmb3IgKGNvbnN0IGJ1dHRvbiBvZiBidXR0b25BcnJheSkge1xuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoXCJpcy1hY3RpdmVcIik7XG4gICAgfVxuICB9XG5cbiAgc3R5bGUgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHdyYXA6IGNzcyh7XG4gICAgICAgIHdpZHRoOiBcIjEwMCVcIlxuICAgICAgfSksXG4gICAgICB0aXRsZTogY3NzKHtcbiAgICAgICAgZm9udFNpemU6IFwiMjBweFwiLFxuICAgICAgICBtYXJnaW5Cb3R0b206IFwiLTUwcHhcIlxuICAgICAgfSksXG4gICAgICBjb2RlQm94OiBjc3Moe1xuICAgICAgICBkaXNwbGF5OiBcIm5vbmVcIixcbiAgICAgICAgXCImLmlzLWFjdGl2ZVwiOiB7XG4gICAgICAgICAgZGlzcGxheTogXCJibG9ja1wiXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgYnV0dG9uczogY3NzKHtcbiAgICAgICAgZGlzcGxheTogXCJncmlkXCIsXG4gICAgICAgIGdyaWRUZW1wbGF0ZUNvbHVtbnM6IFwiMzMlIDMzJSAzMyVcIixcbiAgICAgICAgZ3JpZFRlbXBsYXRlUm93czogXCI1MHB4XCIsXG4gICAgICAgIGJ1dHRvbjoge1xuICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgIGp1c3RpZnlDb250ZW50OiBcImNlbnRlclwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICAgIGhlaWdodDogXCIxMDAlXCIsXG4gICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICBjb2xvcjogXCIjMDAwXCIsXG4gICAgICAgICAgYm9yZGVyOiBcInNvbGlkIDFweCAjMDAwXCIsXG4gICAgICAgICAgXCImLmlzLWFjdGl2ZVwiOiB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiIzAwMFwiLFxuICAgICAgICAgICAgY29sb3I6IFwiI2ZmZlwiXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCAoKSA9PiBWaWV3LmNyZWF0ZUNvbXBvbmVudChcIi5jb2RlXCIsIENvZGUpOyIsImltcG9ydCAqIGFzIFZpZXcgZnJvbSBcIkBpdGt5ay92aWV3XCI7XG5pbXBvcnQge2Nzc30gZnJvbSBcIkBlbW90aW9uL2Nzc1wiO1xuXG5jbGFzcyBWaWV3UG9ydCBleHRlbmRzIFZpZXcuQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgdGhpcy5pbml0KCgpPT57XG5cbiAgICB9KVxuICB9XG5cbiAgc3R5bGUgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHdyYXA6IGNzcyh7XG4gICAgICAgIG1hcmdpblRvcDogXCIyMHB4XCJcbiAgICAgIH0pLFxuICAgICAgdGl0bGU6IGNzcyh7XG4gICAgICAgIGZvbnRTaXplOiBcIjIwcHhcIixcbiAgICAgICAgbWFyZ2luQm90dG9tOiBcIjIwcHhcIlxuICAgICAgfSksXG4gICAgICBjb250ZW50czogY3NzKHtcbiAgICAgICAgYm9yZGVyOiBcInNvbGlkIDFweCAjY2NjXCJcbiAgICAgIH0pLFxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCAoKSA9PiBWaWV3LmNyZWF0ZUNvbXBvbmVudChcIi52aWV3cG9ydFwiLCBWaWV3UG9ydCkiLCJpbXBvcnQgKiBhcyBWaWV3IGZyb20gXCJAaXRreWsvdmlld1wiO1xuaW1wb3J0IHtDdXN0b21TY3JvbGxiYXJ9IGZyb20gXCJAaXRreWsvY3VzdG9tLXNjcm9sbGJhclwiO1xuaW1wb3J0IHtjc3MsIGluamVjdEdsb2JhbH0gZnJvbSBcIkBlbW90aW9uL2Nzc1wiO1xuaW1wb3J0IENvZGUgZnJvbSBcIi4uLy4uL2NvbXBvbmVudHMvT3JnYW5pc21zL0NvZGVcIjtcbmltcG9ydCBWaWV3UG9ydCBmcm9tIFwiLi4vLi4vY29tcG9uZW50cy9PcmdhbmlzbXMvVmlld1BvcnRcIjtcblxuY2xhc3MgU2Nyb2xsZXIgZXh0ZW5kcyBWaWV3LlBhZ2Uge1xuICBwcml2YXRlIHNjcm9sbGJhcjogQ3VzdG9tU2Nyb2xsYmFyO1xuICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLnNjcm9sbGJhciA9IG51bGw7XG4gICAgdGhpcy5pbml0KCgpPT57XG4gICAgICB0aGlzLmdsb2JhbFN0eWxlKCk7XG4gICAgICB0aGlzLnN0YXJ0U2Nyb2xsQmFyKCk7XG4gICAgfSlcbiAgfVxuXG4gIHN0YXJ0U2Nyb2xsQmFyID0gKCkgPT4ge1xuICAgIHRoaXMuc2Nyb2xsYmFyID0gbmV3IEN1c3RvbVNjcm9sbGJhcih0aGlzLnJlZnMudGFyZ2V0LCB7fSlcbiAgfVxuXG4gIGdsb2JhbFN0eWxlID0gKCkgPT4ge1xuICAgIGluamVjdEdsb2JhbCh7XG4gICAgICBcImJvZHlcIjoge1xuICAgICAgICBwYWRkaW5nOiBcIjIwcHhcIlxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBzdHlsZSA9ICgpID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgY29udGVudHNXcmFwOiBjc3Moe1xuICAgICAgICBkaXNwbGF5OiBcImdyaWRcIixcbiAgICAgICAgZ3JpZFRlbXBsYXRlQ29sdW1uczogXCI1MzBweCBjYWxjKDEwMHZ3IC0gNTcwcHgpXCIsXG4gICAgICAgIGgyOiB7XG4gICAgICAgICAgZm9udFNpemU6IFwiMjBweFwiLFxuICAgICAgICAgIGZvbnRXZWlnaHQ6IDUwMCxcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICB3cmFwOiBjc3Moe1xuICAgICAgICBwb3NpdGlvbjogXCJyZWxhdGl2ZVwiLFxuICAgICAgICB3aWR0aDogXCI1MzBweFwiLFxuICAgICAgICBwYWRkaW5nUmlnaHQ6IFwiMzBweFwiLFxuICAgICAgfSksXG4gICAgICBjb250ZW50czogY3NzKHtcbiAgICAgICAgd2lkdGg6IFwiNTAwcHhcIixcbiAgICAgICAgaGVpZ2h0OiBcIjUwMHB4XCIsXG4gICAgICAgIG92ZXJmbG93OiBcInNjcm9sbFwiLFxuICAgICAgICBtc092ZXJmbG93U3R5bGU6IFwibm9uZVwiLFxuICAgICAgICBzY3JvbGxiYXJXaWR0aDogXCJub25lXCIsXG4gICAgICAgIFwiJjo6LXdlYmtpdC1zY3JvbGxiYXJcIjoge1xuICAgICAgICAgIGRpc3BsYXk6IFwibm9uZVwiXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgc2Nyb2xsV3JhcDogY3NzKHtcbiAgICAgICAgcG9zaXRpb246IFwiYWJzb2x1dGVcIixcbiAgICAgICAgdG9wOiBcIjIwcHhcIixcbiAgICAgICAgcmlnaHQ6IFwiMFwiLFxuICAgICAgICBoZWlnaHQ6IFwiNDYwcHhcIixcbiAgICAgICAgd2lkdGg6IFwiMTBweFwiLFxuICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2NjY1wiLFxuICAgICAgfSksXG4gICAgICBzY3JvbGxCYXI6IGNzcyh7XG4gICAgICAgIHBvc2l0aW9uOiBcImFic29sdXRlXCIsXG4gICAgICAgIGxlZnQ6IDAsXG4gICAgICAgIHRvcDogMCxcbiAgICAgICAgd2lkdGg6IFwiMTBweFwiLFxuICAgICAgICBoZWlnaHQ6IFwiNTBweFwiLFxuICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiIzU1NVwiXG4gICAgICB9KSxcbiAgICAgIGNvZGVzOiBjc3Moe1xuICAgICAgICBmb250U2l6ZTogXCIxM3B4IWltcG9ydGFudFwiXG4gICAgICB9KVxuICAgIH1cbiAgfVxufVxuXG5WaWV3LmNyZWF0ZUNvbXBvbmVudChcIiNzY3JvbGxiYXJcIiwgU2Nyb2xsZXIpO1xuQ29kZSgpO1xuVmlld1BvcnQoKTsiXX0=
