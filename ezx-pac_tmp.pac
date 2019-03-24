/* PAC template using gfwlist + easylist. #20170910 @lifenjoiner %GPL
	Matching part is from ABP (v2.9.1). Required from last to first! No ElemHide part.
	https://github.com/adblockplus/adblockpluscore/tree/master/lib
		test by cscript:
		* for prototype, clean 'get', 'set'; add ': function';
		* replace 'let ' with 'var ';
		* split '[] = //.exec()';
		* clean 'var {}';
		* define 'Object.create';
		* define 'extend';
		* define 'String.prototype.includes';
		* define 'Object.defineProperty'
		* replace 'for (var * of *)'
		* replace 'null' with 'undefined'
		* remove call 'isActiveOnDomain'
		* use 'regexp()' for 'RegExpFilter' at 1st time
		* correct 'Matcher.add' with '[]' for all
		* change 'ElemHide' to 'InvalidFilter'
		* Matcher.add only select "whitelist" and "blocking"
		* use 'substr' for String instead of '[]'
		* change keywords pattern to '[a-z0-9%]+', seems a little better performance
		? it could cause high cpu resume. example url: 'http://www.b.com/b5fa786048c47b454f127bdb1eb30c0d616c6b640d3ef4a206dc071f9820cb388c142043.mp3'
	'FindProxyForURL' part from SSR.
	https://github.com/breakwa11/gfw_whitelist/tree/master/ssr
        * ensure item is valid, in case of "new RegExp('','').test()"
	https://msdn.microsoft.com/en-us/library/windows/desktop/aa384240.aspx
	https://blogs.msdn.microsoft.com/askie/2014/02/07/optimizing-performance-with-automatic-proxyconfiguration-scripts-pac/
*/

// ! too complex rule pattern in gfwlist: '/^https?:\/\/([^\/]+\.)*google\.(ac|ad|ae|af|al|am|as|at|az|ba|be|bf|bg|bi|bj|bs|bt|by|ca|cat|cd|cf|cg|ch|ci|cl|cm|co.ao|co.bw|co.ck|co.cr|co.id|co.il|co.in|co.jp|co.ke|co.kr|co.ls|co.ma|com|com.af|com.ag|com.ai|com.ar|com.au|com.bd|com.bh|com.bn|com.bo|com.br|com.bz|com.co|com.cu|com.cy|com.do|com.ec|com.eg|com.et|com.fj|com.gh|com.gi|com.gt|com.hk|com.jm|com.kh|com.kw|com.lb|com.ly|com.mm|com.mt|com.mx|com.my|com.na|com.nf|com.ng|com.ni|com.np|com.om|com.pa|com.pe|com.pg|com.ph|com.pk|com.pr|com.py|com.qa|com.sa|com.sb|com.sg|com.sl|com.sv|com.tj|com.tr|com.tw|com.ua|com.uy|com.vc|com.vn|co.mz|co.nz|co.th|co.tz|co.ug|co.uk|co.uz|co.ve|co.vi|co.za|co.zm|co.zw|cv|cz|de|dj|dk|dm|dz|ee|es|eu|fi|fm|fr|ga|ge|gg|gl|gm|gp|gr|gy|hk|hn|hr|ht|hu|ie|im|iq|is|it|it.ao|je|jo|kg|ki|kz|la|li|lk|lt|lu|lv|md|me|mg|mk|ml|mn|ms|mu|mv|mw|mx|ne|nl|no|nr|nu|org|pl|pn|ps|pt|ro|rs|ru|rw|sc|se|sh|si|sk|sm|sn|so|sr|st|td|tg|tk|tl|tm|tn|to|tt|us|vg|vn|vu|ws)\/.*/'

/* debug
IE: https://github.com/lifenjoiner/pacdbger
firefox: Ctrl+Shift+J, reload; https://github.com/pacparser/pacparser
*/

exports = {};

if (!Object.create) { // >= IE9
    Object.create = function(proto, properties) {
        var retclass = new Object(proto);
        for (var i in properties)
        {
            retclass[i] = properties[i];
        }
        return retclass;
    }
}

if (!Object.defineProperty) {
    Object.defineProperty = function(obj, prop, descriptor) {
        if (descriptor['value']) {
			obj[prop] = descriptor['value'];
        }
        else if (descriptor['get']) {
			obj[prop] = (descriptor['get'])();
        }
    };
}

if (!Object.getOwnPropertyDescriptor) {
    Object.getOwnPropertyDescriptor = function(obj, prop) {
        if (obj.hasOwnProperty(prop)) {
            return obj[prop];
        }
        return null;
	}
}

function extend(superclass, properties)
{
    var cleanclass = function(){};
    var retclass = function(){};
    cleanclass.prototype = superclass.prototype;
    retclass.prototype = new cleanclass();
    for (var i in properties)
    {
        retclass.prototype[i] = properties[i];
    }
    return new retclass();
}
exports.extend = extend;

if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
        if (typeof start !== 'number') {
            start = 0;
        }

        if (start + search.length > this.length) {
            return false;
        } else {
            return this.indexOf(search, start) !== -1;
        }
    };
}

/* common */
/**
 * Converts filter text into regular expression string
 * @param {string} text as in Filter()
 * @return {string} regular expression representation of filter text
 */
function filterToRegExp(text)
{
  return text
    // remove multiple wildcards
    .replace(/\*+/g, "*")
    // remove anchors following separator placeholder
    .replace(/\^\|$/, "^")
    // escape special symbols
    .replace(/\W/g, "\\$&")
    // replace wildcards by .*
    .replace(/\\\*/g, ".*")
    // process separator placeholders (all ANSI characters but alphanumeric
    // characters and _%.-)
    .replace(/\\\^/g, "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)")
    // process extended anchor at expression start
    .replace(/^\\\|\\\|/, "^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?")
    // process anchor at expression start
    .replace(/^\\\|/, "^")
    // process anchor at expression end
    .replace(/\\\|$/, "$")
    // remove leading wildcards
    .replace(/^(\.\*)/, "")
    // remove trailing wildcards
    .replace(/(\.\*)$/, "");
}

/* 1 of the 2 main Object for the matching modle */

/**
 * Abstract base class for filters
 *
 * @param {string} text   string representation of the filter
 * @constructor
 */
function Filter(text)
{
  this.text = text;
  this.subscriptions = [];
}
exports.Filter = Filter;

Filter.prototype =
{
  /**
   * String representation of the filter
   * @type {string}
   */
  text: null,

  /**
   * Filter subscriptions the filter belongs to
   * @type {Subscription[]}
   */
  subscriptions: null,

  /**
   * Filter type as a string, e.g. "blocking".
   * @type {string}
   */
  type: function()
  {
    throw new Error("Please define filter type in the subclass");
  },

  /**
   * Serializes the filter to an array of strings for writing out on the disk.
   * @param {string[]} buffer  buffer to push the serialization results into
   */
  serialize: function(buffer)
  {
    buffer.push("[Filter]");
    buffer.push("text=" + this.text);
  },

  toString: function()
  {
    return this.text;
  }
};

/**
 * Cache for known filters, maps string representation to filter objects.
 * @type {Object}
 */
Filter.knownFilters = Object.create(null);

/**
 * Regular expression that element hiding filters should match
 * @type {RegExp}
 */
Filter.elemhideRegExp =  /^([^\/*|@"!]*?)#([@?])?#(.+)$/;
/**
 * Regular expression that RegExp filters specified as RegExps should match
 * @type {RegExp}
 */
Filter.regexpRegExp = /^(@@)?\/.*\/(?:\$~?[\w-]+(?:=[^,\s]+)?(?:,~?[\w-]+(?:=[^,\s]+)?)*)?$/;
/**
 * Regular expression that options on a RegExp filter should match
 * @type {RegExp}
 */
Filter.optionsRegExp = /\$(~?[\w-]+(?:=[^,\s]+)?(?:,~?[\w-]+(?:=[^,\s]+)?)*)$/;

/**
 * Creates a filter of correct type from its text representation - does the
 * basic parsing and calls the right constructor then.
 *
 * @param {string} text   as in Filter()
 * @return {Filter}
 */
Filter.fromText = function(text)
{
  text = text || '';
  if (text in Filter.knownFilters)
    return Filter.knownFilters[text];

  var ret;
  var match = (text.includes("#") ? Filter.elemhideRegExp.exec(text) : null);
  if (match)
  {
    ret = new InvalidFilter(text, "ElemHide");
  }
  else if (text.substr(0,1) == "!")
    ret = new CommentFilter(text);
  else
    ret = RegExpFilter.fromText(text);

  Filter.knownFilters[ret.text] = ret;
  return ret;
};

/**
 * Deserializes a filter
 *
 * @param {Object}  obj map of serialized properties and their values
 * @return {Filter} filter or null if the filter couldn't be created
 */
Filter.fromObject = function(obj)
{
  var ret = Filter.fromText(obj.text);
  if (ret instanceof ActiveFilter)
  {
    if ("disabled" in obj)
      ret._disabled = (obj.disabled == "true");
    if ("hitCount" in obj)
      ret._hitCount = parseInt(obj.hitCount, 10) || 0;
    if ("lastHit" in obj)
      ret._lastHit = parseInt(obj.lastHit, 10) || 0;
  }
  return ret;
};

/**
 * Removes unnecessary whitespaces from filter text, will only return null if
 * the input parameter is null.
 * @param {string} text
 * @return {string}
 */
Filter.normalize = function(text)
{
  if (!text)
    return text;

  // Remove line breaks and such
  text = text.replace(/[^\S ]/g, "");

  if (/^\s*!/.test(text))
  {
    // Don't remove spaces inside comments
    return text.trim();
  }
  else if (Filter.elemhideRegExp.test(text))
  {
    // Special treatment for element hiding filters, right side is allowed to
    // contain spaces
    var tmp = /^(.*?)(#@?#?)(.*)$/.exec(text);
    var domain = tmp[1], separator = tmp[2], selector = tmp[3];
    return domain.replace(/\s/g, "") + separator + selector.trim();
  }
  return text.replace(/\s/g, "");
};

/**
 * @see filterToRegExp
 */
Filter.toRegExp = filterToRegExp;

/**
 * Class for invalid filters
 * @param {string} text see Filter()
 * @param {string} reason Reason why this filter is invalid
 * @constructor
 * @augments Filter
 */
function InvalidFilter(text, reason)
{
  Filter.call(this, text);

  this.reason = reason;
}
exports.InvalidFilter = InvalidFilter;

InvalidFilter.prototype = extend(Filter, {
  type: "invalid",

  /**
   * Reason why this filter is invalid
   * @type {string}
   */
  reason: null,

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize: function(buffer) {}
});

/**
 * Class for comments
 * @param {string} text see Filter()
 * @constructor
 * @augments Filter
 */
function CommentFilter(text)
{
  Filter.call(this, text);
}
exports.CommentFilter = CommentFilter;

CommentFilter.prototype = extend(Filter, {
  type: "comment",

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize: function(buffer) {}
});

/**
 * Abstract base class for filters that can get hits
 * @param {string} text
 *   see Filter()
 * @param {string} [domains]
 *   Domains that the filter is restricted to separated by domainSeparator
 *   e.g. "foo.com|bar.com|~baz.com"
 * @constructor
 * @augments Filter
 */
function ActiveFilter(text, domains)
{
  Filter.call(this, text);

  this.domainSource = domains;
}
exports.ActiveFilter = ActiveFilter;

ActiveFilter.prototype = extend(Filter, {
  _disabled: false,
  _hitCount: 0,
  _lastHit: 0,

  /**
   * Defines whether the filter is disabled
   * @type {boolean}
   */
  disabled: function()
  {
    return this._disabled;
  },
  disabled: function(value)
  {
    if (value != this._disabled)
    {
      var oldValue = this._disabled;
      this._disabled = value;
      FilterNotifier.triggerListeners("filter.disabled", this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * Number of hits on the filter since the last reset
   * @type {number}
   */
  hitCount: function()
  {
    return this._hitCount;
  },
  hitCount: function(value)
  {
    if (value != this._hitCount)
    {
      var oldValue = this._hitCount;
      this._hitCount = value;
      FilterNotifier.triggerListeners("filter.hitCount", this, value, oldValue);
    }
    return this._hitCount;
  },

  /**
   * Last time the filter had a hit (in milliseconds since the beginning of the
   * epoch)
   * @type {number}
   */
  lastHit: function()
  {
    return this._lastHit;
  },
  lastHit: function(value)
  {
    if (value != this._lastHit)
    {
      var oldValue = this._lastHit;
      this._lastHit = value;
      FilterNotifier.triggerListeners("filter.lastHit", this, value, oldValue);
    }
    return this._lastHit;
  },

  /**
   * String that the domains property should be generated from
   * @type {string}
   */
  domainSource: null,

  /**
   * Separator character used in domainSource property, must be
   * overridden by subclasses
   * @type {string}
   */
  domainSeparator: null,

  /**
   * Determines whether the trailing dot in domain names isn't important and
   * should be ignored, must be overridden by subclasses.
   * @type {boolean}
   */
  ignoreTrailingDot: true,

  /**
   * Determines whether domainSource is already upper-case,
   * can be overridden by subclasses.
   * @type {boolean}
   */
  domainSourceIsUpperCase: false,

  /**
   * Map containing domains that this filter should match on/not match
   * on or null if the filter should match on all domains
   * @type {Object}
   */
  domains: function()
  {
    // Despite this property being cached, the getter is called
    // several times on Safari, due to WebKit bug 132872
    var prop = Object.getOwnPropertyDescriptor(this, "domains");
    if (prop)
      return prop.value;

    var domains = null;

    if (this.domainSource)
    {
      var source = this.domainSource;
      if (!this.domainSourceIsUpperCase)
      {
        // RegExpFilter already have uppercase domains
        source = source.toUpperCase();
      }
      var list = source.split(this.domainSeparator);
      if (list.length == 1 && list[0].substr(0,1) != "~")
      {
        // Fast track for the common one-domain scenario
        domains = Object.create(null);
        domains[""] = false;
        if (this.ignoreTrailingDot)
          list[0] = list[0].replace(/\.+$/, "");
        domains[list[0]] = true;
      }
      else
      {
        var hasIncludes = false;
        for (var i = 0; i < list.length; i++)
        {
          var domain = list[i];
          if (this.ignoreTrailingDot)
            domain = domain.replace(/\.+$/, "");
          if (domain == "")
            continue;

          var include;
          if (domain.substr(0,1) == "~")
          {
            include = false;
            domain = domain.substr(1);
          }
          else
          {
            include = true;
            hasIncludes = true;
          }

          if (!domains)
            domains = Object.create(null);

          domains[domain] = include;
        }
        if (domains)
          domains[""] = !hasIncludes;
      }

      this.domainSource = null;
    }

    Object.defineProperty(this, "domains", {value: domains, enumerable: true});
    return this.domains;
  },

  /**
   * Array containing public keys of websites that this filter should apply to
   * @type {string[]}
   */
  sitekeys: null,

  /**
   * Checks whether this filter is active on a domain.
   * @param {string} docDomain domain name of the document that loads the URL
   * @param {string} [sitekey] public key provided by the document
   * @return {boolean} true in case of the filter being active
   */
  isActiveOnDomain: function(docDomain, sitekey)
  {
    // Sitekeys are case-sensitive so we shouldn't convert them to
    // upper-case to avoid false positives here. Instead we need to
    // change the way filter options are parsed.
    if (this.sitekeys &&
        (!sitekey || this.sitekeys.indexOf(sitekey.toUpperCase()) < 0))
    {
      return false;
    }

    // If no domains are set the rule matches everywhere
    if (!this.domains)
      return true;

    // If the document has no host name, match only if the filter
    // isn't restricted to specific domains
    if (!docDomain)
      return this.domains[""];

    if (this.ignoreTrailingDot)
      docDomain = docDomain.replace(/\.+$/, "");
    docDomain = docDomain.toUpperCase();

    while (true)
    {
      if (docDomain in this.domains)
        return this.domains[docDomain];

      var nextDot = docDomain.indexOf(".");
      if (nextDot < 0)
        break;
      docDomain = docDomain.substr(nextDot + 1);
    }
    return this.domains[""];
  },

  /**
   * Checks whether this filter is active only on a domain and its subdomains.
   * @param {string} docDomain
   * @return {boolean}
   */
  isActiveOnlyOnDomain: function(docDomain)
  {
    if (!docDomain || !this.domains || this.domains[""])
      return false;

    if (this.ignoreTrailingDot)
      docDomain = docDomain.replace(/\.+$/, "");
    docDomain = docDomain.toUpperCase();

    for (var domain in this.domains)
    {
      if (this.domains[domain] && domain != docDomain)
      {
        if (domain.length <= docDomain.length)
          return false;

        if (!domain.endsWith("." + docDomain))
          return false;
      }
    }

    return true;
  },

  /**
   * Checks whether this filter is generic or specific
   * @return {boolean}
   */
  isGeneric: function()
  {
    return !(this.sitekeys && this.sitekeys.length) &&
            (!this.domains || this.domains[""]);
  },

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize: function(buffer)
  {
    if (this._disabled || this._hitCount || this._lastHit)
    {
      Filter.prototype.serialize.call(this, buffer);
      if (this._disabled)
        buffer.push("disabled=true");
      if (this._hitCount)
        buffer.push("hitCount=" + this._hitCount);
      if (this._lastHit)
        buffer.push("lastHit=" + this._lastHit);
    }
  }
});

/**
 * Abstract base class for RegExp-based filters
 * @param {string} text see Filter()
 * @param {string} regexpSource
 *   filter part that the regular expression should be build from
 * @param {number} [contentType]
 *   Content types the filter applies to, combination of values from
 *   RegExpFilter.typeMap
 * @param {boolean} [matchCase]
 *   Defines whether the filter should distinguish between lower and upper case
 *   letters
 * @param {string} [domains]
 *   Domains that the filter is restricted to, e.g. "foo.com|bar.com|~baz.com"
 * @param {boolean} [thirdParty]
 *   Defines whether the filter should apply to third-party or first-party
 *   content only
 * @param {string} [sitekeys]
 *   Public keys of websites that this filter should apply to
 * @constructor
 * @augments ActiveFilter
 */
function RegExpFilter(text, regexpSource, contentType, matchCase, domains,
                      thirdParty, sitekeys)
{
  ActiveFilter.call(this, text, domains, sitekeys);

  if (contentType != null)
    this.contentType = contentType;
  if (matchCase)
    this.matchCase = matchCase;
  if (thirdParty != null)
    this.thirdParty = thirdParty;
  if (sitekeys != null)
    this.sitekeySource = sitekeys;

  if (regexpSource.length >= 2 &&
      regexpSource.substr(0,1) == "/" &&
      regexpSource.substr(regexpSource.length - 1, 1) == "/")
  {
    // The filter is a regular expression - convert it immediately to
    // catch syntax errors
    var regexp = new RegExp(regexpSource.substr(1, regexpSource.length - 2),
                            this.matchCase ? "" : "i");
    Object.defineProperty(this, "regexp", {value: regexp});
  }
  else
  {
    // No need to convert this filter to regular expression yet, do it on demand
    this.regexpSource = regexpSource;
  }
}
exports.RegExpFilter = RegExpFilter;

RegExpFilter.prototype = extend(ActiveFilter, {
  /**
   * @see ActiveFilter.domainSourceIsUpperCase
   */
  domainSourceIsUpperCase: true,

  /**
   * Number of filters contained, will always be 1 (required to
   * optimize Matcher).
   * @type {number}
   */
  length: 1,

  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: "|",

  /**
   * Expression from which a regular expression should be generated -
   * for delayed creation of the regexp property
   * @type {string}
   */
  regexpSource: null,
  /**
   * Regular expression to be used when testing against this filter
   * @type {RegExp}
   */
  regexp: function()
  {
    // Despite this property being cached, the getter is called
    // several times on Safari, due to WebKit bug 132872
    var prop = Object.getOwnPropertyDescriptor(this, "regexp");
    if (prop)
      return prop.value;

    var source = Filter.toRegExp(this.regexpSource);
    var regexp = new RegExp(source, this.matchCase ? "" : "i");
    Object.defineProperty(this, "regexp", {value: regexp});
    return regexp;
  },
  /**
   * Content types the filter applies to, combination of values from
   * RegExpFilter.typeMap
   * @type {number}
   */
  contentType: 0x7FFFFFFF,
  /**
   * Defines whether the filter should distinguish between lower and
   * upper case letters
   * @type {boolean}
   */
  matchCase: false,
  /**
   * Defines whether the filter should apply to third-party or
   * first-party content only. Can be null (apply to all content).
   * @type {boolean}
   */
  thirdParty: null,

  /**
   * String that the sitekey property should be generated from
   * @type {string}
   */
  sitekeySource: null,

  /**
   * Array containing public keys of websites that this filter should apply to
   * @type {string[]}
   */
  sitekeys: function()
  {
    // Despite this property being cached, the getter is called
    // several times on Safari, due to WebKit bug 132872
    var prop = Object.getOwnPropertyDescriptor(this, "sitekeys");
    if (prop)
      return prop.value;

    var sitekeys = null;

    if (this.sitekeySource)
    {
      sitekeys = this.sitekeySource.split("|");
      this.sitekeySource = null;
    }

    Object.defineProperty(
      this, "sitekeys", {value: sitekeys, enumerable: true}
    );
    return this.sitekeys;
  },

  /**
   * Tests whether the URL matches this filter
   * @param {string} location URL to be tested
   * @param {number} typeMask bitmask of content / request types to match
   * @param {string} docDomain domain name of the document that loads the URL
   * @param {boolean} thirdParty should be true if the URL is a third-party
   *                             request
   * @param {string} sitekey public key provided by the document
   * @return {boolean} true in case of a match
   */
  matches: function(location, typeMask, docDomain, thirdParty, sitekey)
  {
    if (this.contentType & typeMask &&
        (this.thirdParty == null || this.thirdParty == thirdParty) &&
        (this.regexp.test?this.regexp:this.regexp()).test(location))
    {
      return true;
    }
    return false;
  }
});

// Required to optimize Matcher, see also RegExpFilter.prototype.length
Object.defineProperty(RegExpFilter.prototype, "0", {
  get: function() { return this; }
});

/**
 * Creates a RegExp filter from its text representation
 * @param {string} text   same as in Filter()
 * @return {Filter}
 */
RegExpFilter.fromText = function(text)
{
  var blocking = true;
  var origText = text;
  if (text.indexOf("@@") == 0)
  {
    blocking = false;
    text = text.substr(2);
  }

  var contentType = null;
  var matchCase = null;
  var domains = null;
  var sitekeys = null;
  var thirdParty = null;
  var collapse = null;
  var options;
  var match = (text.indexOf("$") >= 0 ? Filter.optionsRegExp.exec(text) : null);
  if (match)
  {
    options = match[1].toUpperCase().split(",");
    text = match.input.substr(0, match.index);
    for (var i in options)
    {
      option = options[i];
      var value = null;
      var separatorIndex = option.indexOf("=");
      if (separatorIndex >= 0)
      {
        value = option.substr(separatorIndex + 1);
        option = option.substr(0, separatorIndex);
      }
      option = option.replace(/-/, "_");
      if (option in RegExpFilter.typeMap)
      {
        if (contentType == null)
          contentType = 0;
        contentType |= RegExpFilter.typeMap[option];
      }
      else if (option.substr(0,1) == "~" && option.substr(1) in RegExpFilter.typeMap)
      {
        if (contentType == null)
          (contentType = RegExpFilter.prototype);
        contentType &= ~RegExpFilter.typeMap[option.substr(1)];
      }
      else if (option == "MATCH_CASE")
        matchCase = true;
      else if (option == "~MATCH_CASE")
        matchCase = false;
      else if (option == "DOMAIN" && typeof value != "undefined")
        domains = value;
      else if (option == "THIRD_PARTY")
        thirdParty = true;
      else if (option == "~THIRD_PARTY")
        thirdParty = false;
      else if (option == "COLLAPSE")
        collapse = true;
      else if (option == "~COLLAPSE")
        collapse = false;
      else if (option == "SITEKEY" && typeof value != "undefined")
        sitekeys = value;
      else
        return new InvalidFilter(origText, "filter_unknown_option");
    }
  }

  try
  {
    if (blocking)
    {
      return new BlockingFilter(origText, text, contentType, matchCase, domains,
                                thirdParty, sitekeys, collapse);
    }
    return new WhitelistFilter(origText, text, contentType, matchCase, domains,
                               thirdParty, sitekeys);
  }
  catch (e)
  {
    return new InvalidFilter(origText, "filter_invalid_regexp");
  }
};

/**
 * Maps type strings like "SCRIPT" or "OBJECT" to bit masks
 */
RegExpFilter.typeMap = {
  OTHER: 1,
  SCRIPT: 2,
  IMAGE: 4,
  STYLESHEET: 8,
  OBJECT: 16,
  SUBDOCUMENT: 32,
  DOCUMENT: 64,
  WEBSOCKET: 128,
  WEBRTC: 256,
  XBL: 1,
  PING: 1024,
  XMLHTTPREQUEST: 2048,
  OBJECT_SUBREQUEST: 4096,
  DTD: 1,
  MEDIA: 16384,
  FONT: 32768,

  BACKGROUND: 4,    // Backwards compat, same as IMAGE

  POPUP: 0x10000000,
  GENERICBLOCK: 0x20000000,
  ELEMHIDE: 0x40000000,
  GENERICHIDE: 0x80000000
};

// DOCUMENT, ELEMHIDE, POPUP, GENERICHIDE and GENERICBLOCK options shouldn't
// be there by default
RegExpFilter.prototype.contentType &= ~(RegExpFilter.typeMap.DOCUMENT |
                                        RegExpFilter.typeMap.ELEMHIDE |
                                        RegExpFilter.typeMap.POPUP |
                                        RegExpFilter.typeMap.GENERICHIDE |
                                        RegExpFilter.typeMap.GENERICBLOCK);

/**
 * Class for blocking filters
 * @param {string} text see Filter()
 * @param {string} regexpSource see RegExpFilter()
 * @param {number} contentType see RegExpFilter()
 * @param {boolean} matchCase see RegExpFilter()
 * @param {string} domains see RegExpFilter()
 * @param {boolean} thirdParty see RegExpFilter()
 * @param {string} sitekeys see RegExpFilter()
 * @param {boolean} collapse
 *   defines whether the filter should collapse blocked content, can be null
 * @constructor
 * @augments RegExpFilter
 */
function BlockingFilter(text, regexpSource, contentType, matchCase, domains,
                        thirdParty, sitekeys, collapse)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains,
                    thirdParty, sitekeys);

  this.collapse = collapse;
}
exports.BlockingFilter = BlockingFilter;

BlockingFilter.prototype = extend(RegExpFilter, {
  type: "blocking",

  /**
   * Defines whether the filter should collapse blocked content.
   * Can be null (use the global preference).
   * @type {boolean}
   */
  collapse: null
});

/**
 * Class for whitelist filters
 * @param {string} text see Filter()
 * @param {string} regexpSource see RegExpFilter()
 * @param {number} contentType see RegExpFilter()
 * @param {boolean} matchCase see RegExpFilter()
 * @param {string} domains see RegExpFilter()
 * @param {boolean} thirdParty see RegExpFilter()
 * @param {string} sitekeys see RegExpFilter()
 * @constructor
 * @augments RegExpFilter
 */
function WhitelistFilter(text, regexpSource, contentType, matchCase, domains,
                         thirdParty, sitekeys)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains,
                    thirdParty, sitekeys);
}
exports.WhitelistFilter = WhitelistFilter;

WhitelistFilter.prototype = extend(RegExpFilter, {
  type: "whitelist"
});


/* 1 of the 2 main Object for the matching modle */

/**
 * Blacklist/whitelist filter matching
 * @constructor
 */
function Matcher()
{
  this.clear();
}

Matcher.prototype = {
  /**
   * Lookup table for filters by their associated keyword
   * @type {Object}
   */
  filterByKeyword: null,

  /**
   * Lookup table for keywords by the filter text
   * @type {Object}
   */
  keywordByFilter: null,

  /**
   * Removes all known filters
   */
  clear: function()
  {
    this.filterByKeyword = new Object(null);
    this.keywordByFilter = new Object(null);
  },

  /**
   * Adds a filter to the matcher
   * @param {RegExpFilter} filter
   */
  add: function(filter)
  {
    if (filter.type != "whitelist" && filter.type != "blocking")
      return;
    if (filter.text in this.keywordByFilter)
      return;

    // Look for a suitable keyword
    var keyword = this.findKeyword(filter);
    var oldEntry = this.filterByKeyword[keyword];
    if (typeof oldEntry == "undefined")
      this.filterByKeyword[keyword] = [filter]; // all should be []
    else
      oldEntry.push(filter);
    this.keywordByFilter[filter.text] = keyword;
  },

  /**
   * Removes a filter from the matcher
   * @param {RegExpFilter} filter
   */
  remove: function(filter)
  {
    if (!(filter.text in this.keywordByFilter))
      return;

    var keyword = this.keywordByFilter[filter.text];
    var list = this.filterByKeyword[keyword];
    if (list.length <= 1)
      delete this.filterByKeyword[keyword];
    else
    {
      var index = list.indexOf(filter);
      if (index >= 0)
      {
        list.splice(index, 1);
        if (list.length == 1)
          this.filterByKeyword[keyword] = list[0];
      }
    }

    delete this.keywordByFilter[filter.text];
  },

  /**
   * Chooses a keyword to be associated with the filter
   * @param {Filter} filter
   * @return {string} keyword or an empty string if no keyword could be found
   */
  findKeyword: function(filter)
  {
    var result = "";
    var text = filter.text;
    if (Filter.regexpRegExp.test(text))
      return result;

    // Remove options
    var match = Filter.optionsRegExp.exec(text);
    if (match)
      text = match.input.substr(0, match.index);

    // Remove whitelist marker
    if (text.substr(0, 2) == "@@")
      text = text.substr(2);

    var candidates = text.toLowerCase().match(/[^a-z0-9%*][a-z0-9%]+(?=[^a-z0-9%*])/g);
    if (!candidates)
      return result;

    var hash = this.filterByKeyword;
    var resultCount = 0xFFFFFF;
    var resultLength = 0;
    for (var i = 0, l = candidates.length; i < l; i++)
    {
      var candidate = candidates[i].substr(1);
      var count = (candidate in hash ? hash[candidate].length : 0);
      if (count < resultCount ||
          (count == resultCount && candidate.length > resultLength))
      {
        result = candidate;
        resultCount = count;
        resultLength = candidate.length;
      }
    }
    return result;
  },

  /**
   * Checks whether a particular filter is being matched against.
   * @param {RegExpFilter} filter
   * @return {boolean}
   */
  hasFilter: function(filter)
  {
    return (filter.text in this.keywordByFilter);
  },

  /**
   * Returns the keyword used for a filter, null for unknown filters.
   * @param {RegExpFilter} filter
   * @return {string}
   */
  getKeywordForFilter: function(filter)
  {
    if (filter.text in this.keywordByFilter)
      return this.keywordByFilter[filter.text];
    return null;
  },

  /**
   * Checks whether the entries for a particular keyword match a URL
   * @param {string} keyword
   * @param {string} location
   * @param {number} typeMask
   * @param {string} docDomain
   * @param {boolean} thirdParty
   * @param {string} sitekey
   * @param {boolean} specificOnly
   * @return {?Filter}
   */
  _checkEntryMatch: function(keyword, location, typeMask, docDomain, thirdParty, sitekey,
                   specificOnly)
  {
    var list = this.filterByKeyword[keyword];
    for (var i = 0; i < list.length; i++)
    {
      var filter = list[i];

      if (specificOnly && filter.isGeneric() &&
          !(filter instanceof WhitelistFilter))
        continue;

      if (filter.matches(location, typeMask, docDomain, thirdParty, sitekey))
        return filter;
    }
    return null;
  },

  /**
   * Tests whether the URL matches any of the known filters
   * @param {string} location
   *   URL to be tested
   * @param {number} typeMask
   *   bitmask of content / request types to match
   * @param {string} docDomain
   *   domain name of the document that loads the URL
   * @param {boolean} thirdParty
   *   should be true if the URL is a third-party request
   * @param {string} sitekey
   *   public key provided by the document
   * @param {boolean} specificOnly
   *   should be true if generic matches should be ignored
   * @return {?RegExpFilter}
   *   matching filter or null
   */
  matchesAny: function(location, typeMask, docDomain, thirdParty, sitekey, specificOnly)
  {
    var candidates = location.toLowerCase().match(/[a-z0-9%]+/g);
    if (candidates === null)
      candidates = [];
    candidates.push(""); // no keyword parts as ""
    for (var i = 0, l = candidates.length; i < l; i++)
    {
      var substr = candidates[i];
      if (substr in this.filterByKeyword)
      {
        var result = this._checkEntryMatch(substr, location, typeMask,
                                           docDomain, thirdParty, sitekey,
                                           specificOnly);
        if (result)
          return result;
      }
    }

    return null;
  }
};


/**
 * Combines a matcher for blocking and exception rules, automatically sorts
 * rules into two Matcher instances.
 * @constructor
 * @augments Matcher
 */
function CombinedMatcher()
{
  this.blacklist = new Matcher();
  this.whitelist = new Matcher();
  this.resultCache = new Object(null);
}

/**
 * Maximal number of matching cache entries to be kept
 * @type {number}
 */
CombinedMatcher.maxCacheEntries = 1000;

CombinedMatcher.prototype =
{
  /**
   * Matcher for blocking rules.
   * @type {Matcher}
   */
  blacklist: null,

  /**
   * Matcher for exception rules.
   * @type {Matcher}
   */
  whitelist: null,

  /**
   * Lookup table of previous matchesAny results
   * @type {Object}
   */
  resultCache: null,

  /**
   * Number of entries in resultCache
   * @type {number}
   */
  cacheEntries: 0,

  /**
   * @see Matcher#clear
   */
  clear: function()
  {
    this.blacklist.clear();
    this.whitelist.clear();
    this.resultCache = new Object(null);
    this.cacheEntries = 0;
  },

  /**
   * @see Matcher#add
   * @param {Filter} filter
   */
  add: function(filter)
  {
    if (filter instanceof WhitelistFilter)
      this.whitelist.add(filter);
    else
      this.blacklist.add(filter);

    if (this.cacheEntries > 0)
    {
      this.resultCache = new Object(null);
      this.cacheEntries = 0;
    }
  },

  /**
   * @see Matcher#remove
   * @param {Filter} filter
   */
  remove: function(filter)
  {
    if (filter instanceof WhitelistFilter)
      this.whitelist.remove(filter);
    else
      this.blacklist.remove(filter);

    if (this.cacheEntries > 0)
    {
      this.resultCache = new Object(null);
      this.cacheEntries = 0;
    }
  },

  /**
   * @see Matcher#findKeyword
   * @param {Filter} filter
   * @return {string} keyword
   */
  findKeyword: function(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this.whitelist.findKeyword(filter);
    return this.blacklist.findKeyword(filter);
  },

  /**
   * @see Matcher#hasFilter
   * @param {Filter} filter
   * @return {boolean}
   */
  hasFilter: function(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this.whitelist.hasFilter(filter);
    return this.blacklist.hasFilter(filter);
  },

  /**
   * @see Matcher#getKeywordForFilter
   * @param {Filter} filter
   * @return {string} keyword
   */
  getKeywordForFilter: function(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this.whitelist.getKeywordForFilter(filter);
    return this.blacklist.getKeywordForFilter(filter);
  },

  /**
   * Checks whether a particular filter is slow
   * @param {RegExpFilter} filter
   * @return {boolean}
   */
  isSlowFilter: function(filter)
  {
    var matcher = (
      filter instanceof WhitelistFilter ? this.whitelist : this.blacklist
    );
    if (matcher.hasFilter(filter))
      return !matcher.getKeywordForFilter(filter);
    return !matcher.findKeyword(filter);
  },

  /**
   * Optimized filter matching testing both whitelist and blacklist matchers
   * simultaneously. For parameters see Matcher.matchesAny().
   * @see Matcher#matchesAny
   * @inheritdoc
   */
  matchesAnyInternal: function(location, typeMask, docDomain, thirdParty, sitekey,
                     specificOnly)
  {
    var candidates = location.toLowerCase().match(/[a-z0-9%]+/g);
    if (candidates === null)
      candidates = [];
    candidates.push(""); // no keyword parts as ""

    var blacklistHit = null;
    for (var i = 0, l = candidates.length; i < l; i++)
    {
      var substr = candidates[i];
      if (substr in this.whitelist.filterByKeyword)
      {
        var result = this.whitelist._checkEntryMatch(
          substr, location, typeMask, docDomain, thirdParty, sitekey
        );
        if (result)
          return result;
      }
      if (substr in this.blacklist.filterByKeyword && blacklistHit === null)
      {
        blacklistHit = this.blacklist._checkEntryMatch(
          substr, location, typeMask, docDomain, thirdParty, sitekey,
          specificOnly
        );
      }
    }
    return blacklistHit;
  },

  /**
   * @see Matcher#matchesAny
   * @inheritdoc
   */
  matchesAny: function(location, typeMask, docDomain, thirdParty, sitekey, specificOnly)
  {
    var key = location + " " + typeMask + " " + docDomain + " " + thirdParty +
      " " + sitekey + " " + specificOnly;
    if (key in this.resultCache)
      return this.resultCache[key];

    var result = this.matchesAnyInternal(location, typeMask, docDomain,
                                         thirdParty, sitekey, specificOnly);

    if (this.cacheEntries >= CombinedMatcher.maxCacheEntries)
    {
      this.resultCache = new Object(null);
      this.cacheEntries = 0;
    }

    this.resultCache[key] = result;
    this.cacheEntries++;

    return result;
  }
};

/* New instance */

var AdsListMatcher = new CombinedMatcher();
var BlackListMatcher = new CombinedMatcher();
var ProxyListMatcher = new CombinedMatcher();

/* Proxy part */

var proxies = "PROXY 127.0.0.1:1080; PROXY 127.0.0.1:9666; PROXY 127.0.0.1:8580;";

var direct = "__DIRECT__";
if (direct == "__DIR" + "ECT__") direct = "DIRECT";

var wall_proxy = function(){ return proxies +" DIRECT"; };
var wall_v6_proxy = function(){ return "PROXY [::1]:1080; PROXY [::1]:9666; PROXY [::1]:8580; DIRECT"; };
var ads_blocking = function(){ return "0.0.0.0"; };

var nowall_proxy = function(){ return direct; };
var ip_proxy = function(){ return nowall_proxy(); };
var ipv6_proxy = function(){ return nowall_proxy(); };

/* Executing */

var subnetIpRangeList = [
0,1,
167772160,184549376,    //10.0.0.0/8
2886729728,2887778304,	//172.16.0.0/12
3232235520,3232301056,	//192.168.0.0/16
2130706432,2130706688	//127.0.0.0/24
];

function convertAddress(ipchars) {
    var bytes = ipchars.split('.');
    var result = (bytes[0] << 24) |
    (bytes[1] << 16) |
    (bytes[2] << 8) |
    (bytes[3]);
    return result >>> 0;
}

function check_ipv4(host) {
    var re_ipv4 = /^\d+\.\d+\.\d+\.\d+$/g;
    if (re_ipv4.test(host)) {
        return true;
    }
}
function check_ipv6(host) {
    var re_ipv6 = /^\[?([a-fA-F0-9]{0,4}\:){1,7}[a-fA-F0-9]{0,4}\]?$/g;
    if (re_ipv6.test(host)) {
        return true;
    }
}
function check_ipv6_dns(dnsstr) {
    var re_ipv6 = /([a-fA-F0-9]{0,4}\:){1,7}[a-fA-F0-9]{0,4}(%[0-9]+)?/g;
    if (re_ipv6.test(dnsstr)) {
        return true;
    }
}
function isInSubnetRange(ipRange, intIp) {
    for ( var i = 0; i < 10; i += 2 ) {
        if ( ipRange[i] <= intIp && intIp < ipRange[i+1] )
            return true;
    }
}
function getProxyFromIP(strIp) {
    var intIp = convertAddress(strIp);
    if ( isInSubnetRange(subnetIpRangeList, intIp) ) {
        return direct;
    }
    return ip_proxy();
}

function FindProxyForURL(url, host) {
    if ( isPlainHostName(host) === true ) {
        return direct;
    }
    if ( (BlackListMatcher.matchesAny(url, 1, host) instanceof BlockingFilter)
    || (AdsListMatcher.matchesAny(url, 1, host) instanceof BlockingFilter) ) { // only exclude 64
        return ads_blocking();
    }
    if (ProxyListMatcher.matchesAny(url, 1, host) instanceof BlockingFilter) { // only exclude 64
        return wall_proxy();
    }
    if ( check_ipv4(host) === true ) {
        return getProxyFromIP(host);
    }
    return direct;
}

/* data definition */
var rules_blacklist = __RULES_BLACKLIST__;
var rules_easylist_in_gfw = __RULES_EASYLIST_IN_GFW__;
var rules_gfw = __RULES__;

/* Initializing Filter */
for (var i = 0; i < rules_blacklist.length; i++) {
    if (rules_blacklist[i]) {
        BlackListMatcher.add(Filter.fromText(rules_blacklist[i]));
    }
}
for (var i = 0; i < rules_easylist_in_gfw.length; i++) {
    if (rules_easylist_in_gfw[i]) {
        AdsListMatcher.add(Filter.fromText(rules_easylist_in_gfw[i]));
    }
}
for (var i = 0; i < rules_gfw.length; i++) {
    if (rules_gfw[i]) { // in case of ''
        ProxyListMatcher.add(Filter.fromText(rules_gfw[i]));
    }
}
