'use strict';

module.exports = ignore;
ignore.Ignore = Ignore;

var EE = require('events').EventEmitter;
var node_util = require('util');

function ignore (options){
    return new Ignore(options);
}


// @param {Object} options
// - rules: {Array}
// - twoGlobstars: {boolean=false} enable pattern '`**`' (two consecutive asterisks), default to `false`.
//      If false, ignore patterns with two globstars will be omitted
// - noCase: {boolean=true} case sensitive.
//      By default, git is case-insensitive
function Ignore (options){
    options = options || {};
    options.noCase = 'noCase' in options ? options.noCase : true;

    this.add(options.rules);
    this.options = options;

    this._patterns = [];
    this._rules = [];
}

// Events:
// 'warn': , 
//      will warn when encounter '`**`' (two consecutive asterisks)
//      which is not compatible with all platforms (not works on Mac OS for example)
node_util.inherits(Ignore, EE);

function makeArray (subject) {
    return Array.isArray(subject) ? 
        subject :
        subject === undefined || subject === null ?
            [] :
            [subject];
}


// @param {Array.<string>|string} pattern
Ignore.prototype.add = function(pattern) {
    makeArray(pattern).forEach(this._add, this);
    return this;
};


Ignore.prototype.filter = function(paths) {
    // body...
};


Ignore.prototype._add = function(pattern) {
    if(this._simpleTest(pattern)){
        var rule = this._createRule(pattern);
        this._rules.push(rule);
    }
};

Ignore.prototype._simpleTest = function(pattern) {
    var pass = 
        // Whitespace dirs are allowed, so only filter blank pattern.
        pattern && 
        // And not start with a '#'
        pattern.indexOf('#') !== 0 && 

        ! ~ this._patterns.indexOf(pattern);

    this._patterns.push(pattern);

    if( ~ pattern.indexOf('**') ){
        this.emit('warn', {
            pattern: origin,
            reason: '`**` found, which is not compatible with all platforms.' 
        });

        if(!this.options.twoGlobstars){
            return false;
        }
    }

    return pass;
};

var REGEX_LEADING_EXCLAMATION = /^\\\!/;
var REGEX_LEADING_HASH = /^\\#/;

Ignore.prototype._createRule = function(pattern) {
    var rule_object = {};
    var match_start;

    if(pattern.indexOf('!')){
        rule_object.negative = true;
    }

    rule_object.origin = pattern;

    pattern = pattern
        .replace(REGEX_LEADING_EXCLAMATION, '!')
        .replace(REGEX_LEADING_HASH, '#');

    rule_object.pattern = pattern;

    rule_object.regex = this._makeRegex(pattern);

    return rule_object;
};


// '`foo/`' will not match regular file '`foo`' or symbolic link '`foo`'
// -> ignore-rules will not deal with it, because it costs extra `fs.stat` call
//      you could use option `mark: true` with `glob`

// '`foo/`' should not continue with the '`..`'
var REPLACERS = [
    // leading slash
    [

        // A leading slash matches the beginning of the pathname 
        /^\//,
        '^'
    ],

    // 'f'
    // matches
    // - /f(end)
    // - /f/
    // - (start)f(end)
    // - (start)f/
    // doesn't match
    // - oof
    // - foo
    // pseudo:
    // -> (^|/)f(/|$)

    // ending
    [
        // 'js' will not match 'js.'
        /(?:[^*\/])$/,
        function (match1) {
            return match1 + '(?=$|\\/)';
        }
    ],

    // starting
    [
        // there will be no leading '/' (which has been replaced by the first replacer)
        // If starts with '**', adding a '^' to the regular expression also works
        /^(?=[^\^])/,
        '(?:^|\\/)'
    ],

    // two globstars
    [
        // '/**/'
        /\/\*\*\//g,

        // Zero, one or several directories
        // should not use '*', or it will be replaced by the next replacer
        '(?:\\/[^\\/]+){0,}\\/'
    ], 

    // wildcard
    [
        /\*+/g,

        // 'abc/*.js' matches 'abc/...js'
        '[^\\/]*'
    ]
];


// @param {pattern}
Ignore.prototype.makeRegex = function(pattern) {
    var source = REPLACERS.reduce(function (prev, current) {
        return prev.replace( current[0], current[1] );

    }, pattern);

    return new RegExp(source, this.options.noCase ? 'i' : '');
};


