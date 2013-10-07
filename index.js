'use strict';

module.exports = ignore;
ignore.Ignore = Ignore;

var EE        = require('events').EventEmitter;
var node_util = require('util');
var node_fs   = require('fs');

function ignore (options){
    return new Ignore(options);
}

var exists = node_fs.existsSync ?
    function (file) {
        return node_fs.existsSync(file);
    } :

    // if node <= 0.6, there's no fs.existsSync method.
    function (file) {
        try {
            node_fs.statSync(file);
            return true;
        } catch(e) {
            return false;
        }
    };

// Select the first existing file of the file list
ignore.select = function (files) {
    var selected;

    files.some(function (file) {
        if( exists(file) ){
            selected = file;
            return true;
        }
    });

    return selected;
};


// @param {Object} options
// - ignore: {Array}
// - twoGlobstars: {boolean=false} enable pattern `'**'` (two consecutive asterisks), default to `false`.
//      If false, ignore patterns with two globstars will be omitted
// - matchCase: {boolean=true} case sensitive.
//      By default, git is case-insensitive
function Ignore (options){
    options = options || {};

    this.options = options;
    this._patterns = [];
    this._rules = [];
    this._ignoreFiles = [];

    options.ignore = options.ignore || [
        // Some files or directories which we should ignore for most cases.
        '.git',
        '.svn',
        '.DS_Store'
    ];

    this.addPattern(options.ignore);
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
Ignore.prototype.addPattern = function(pattern) {
    makeArray(pattern).forEach(this._addPattern, this);
    return this;
};


Ignore.prototype._addPattern = function(pattern) {
    if(this._simpleTest(pattern)){
        var rule = this._createRule(pattern);
        this._rules.push(rule);
    }
};


Ignore.prototype.filter = function(paths) {
    return paths.filter(this._filter, this);
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
            code: 'WGLOBSTARS',
            data: {
                pattern: origin
            },
            message: '`**` found, which is not compatible cross all platforms.' 
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
    var rule_object = {
        origin: pattern
    };

    var match_start;

    if(pattern.indexOf('!') === 0){
        rule_object.negative = true;
        pattern = pattern.substr(1);
    }

    pattern = pattern
        .replace(REGEX_LEADING_EXCLAMATION, '!')
        .replace(REGEX_LEADING_HASH, '#');

    rule_object.pattern = pattern;

    rule_object.regex = this.makeRegex(pattern);

    return rule_object;
};

// > If the pattern ends with a slash, it is removed for the purpose of the following description, but it would only find a match with a directory. In other words, foo/ will match a directory foo and paths underneath it, but will not match a regular file or a symbolic link foo (this is consistent with the way how pathspec works in general in Git).
// '`foo/`' will not match regular file '`foo`' or symbolic link '`foo`'
// -> ignore-rules will not deal with it, because it costs extra `fs.stat` call
//      you could use option `mark: true` with `glob`

// '`foo/`' should not continue with the '`..`'
var REPLACERS = [
    // leading slash
    [

        // > A leading slash matches the beginning of the pathname. For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
        // A leading slash matches the beginning of the pathname 
        /^\//,
        '^'
    ],

    [
        // > A leading "**" followed by a slash means match in all directories. For example, "**/foo" matches file or directory "foo" anywhere, the same as pattern "foo". "**/foo/bar" matches file or directory "bar" anywhere that is directly under directory "foo".
        /\*\*\//,

        // '**/foo' <-> 'foo'
        // just remove it
        '' 
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
        // > A slash followed by two consecutive asterisks then a slash matches zero or more directories. For example, "a/**/b" matches "a/b", "a/x/b", "a/x/y/b" and so on.
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

    return new RegExp(source, this.options.matchCase ? '' : 'i');
};


Ignore.prototype._filter = function(path) {
    var rules = this._rules;
    var i = 0;
    var length = rules.length;
    var matched;
    var rule;

    for(; i < length; i ++){
        rule = rules[i];

        // if matched = true, then we only test negative rules
        // if matched = false, then we test non-negative rules
        if( !( matched ^ rule.negative ) ){
            matched = rule.negative ^ rule.regex.test(path);

        }else{
            continue;
        }
    }

    return !matched;
};


Ignore.prototype.createFilter = function() {
    var self = this;

    return function (path) {
        return self._filter(path);
    };
};


// @param {Array.<path>|path} a
Ignore.prototype.addIgnoreFile = function(files) {
    makeArray(files).forEach(this._addIgnoreFile, this);
    return this;
};


Ignore.prototype._addIgnoreFile = function (file) {
    if(this._checkRuleFile(file)){
        this._ignoreFiles.push(file);

        var content;

        try {
            content = node_fs.readFileSync(file);
        } catch(e) {
        }

        if(content){
            this.addPattern( content.toString().split(/\r?\n/) );
        }
    }
};


Ignore.prototype._checkRuleFile = function(file) {
    return file !== '.' &&
           file !== '..' &&
           ! ~ this._ignoreFiles.indexOf(file);
};


