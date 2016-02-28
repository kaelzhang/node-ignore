'use strict'

module.exports = (options = {}) => new Ignore(options)

var array_slice = Array.prototype.slice

function make_array (args) {
  return flatten(array_slice.call(args))
}


function flatten (array) {
  return array.reduce((prev, current) => {
    return prev.concat(current)
  }, [])
}


var REGEX_BLANK_LINE = /\s+/
var REGEX_LEADING_EXCLAMATION = /^\\\!/
var REGEX_LEADING_HASH = /^\\#/

// @param {Object} options
// - ignore: {Array}
// - twoGlobstars: {boolean=false} enable pattern `'**'` (two consecutive asterisks), default to `false`.
//      If false, ignore patterns with two globstars will be omitted
// - matchCase: {boolean=} case sensitive.
//      By default, git is case-insensitive
class Ignore {
  constructor () {
    this._patterns = []
    this._rules = []
    this._files = []

    this.add.apply(this, arguments)
  }

  // @param {Array.<string>|string} pattern
  add () {
    make_array(arguments).forEach(this._addPattern, this)
    return this
  }

  _addPattern (pattern) {
    if (this._check(pattern)) {
      var rule = this._createRule(pattern)
      this._rules.push(rule)
    }
  }

  _check (pattern) {
    if (
      typeof pattern === 'string'

      // > A blank line matches no files, so it can serve as a separator for readability.
      && pattern
      && !REGEX_BLANK_LINE.test(pattern)

      // > A line starting with # serves as a comment.
      && pattern.indexOf('#') !== 0
    ) {
      return true
    }
  }

  filter (paths) {
    return paths.filter(this._filter, this)
  }

  createFilter () {
    return path => this._filter(path)
  }

  _createRule (pattern) {
    var rule_object = {
      origin: pattern
    }

    var match_start

    if (pattern.indexOf('!') === 0) {
      rule_object.negative = true
      pattern = pattern.substr(1)
    }

    pattern = pattern
      .replace(REGEX_LEADING_EXCLAMATION, '!')
      .replace(REGEX_LEADING_HASH, '#')

    rule_object.pattern = pattern

    rule_object.regex = regex(pattern)

    return rule_object
  }

  _filter (path) {
    var matched

    this._rules.forEach(rule => {
      // if matched = true, then we only test negative rules
      // if matched = false, then we test non-negative rules
      if (!(matched ^ rule.negative)) {
        matched = rule.negative ^ rule.regex.test(path)
      }
    })

    return !matched
  }
}


// > If the pattern ends with a slash,
// > it is removed for the purpose of the following description,
// > but it would only find a match with a directory.
// > In other words, foo/ will match a directory foo and paths underneath it,
// > but will not match a regular file or a symbolic link foo
// >  (this is consistent with the way how pathspec works in general in Git).
// '`foo/`' will not match regular file '`foo`' or symbolic link '`foo`'
// -> ignore-rules will not deal with it, because it costs extra `fs.stat` call
//      you could use option `mark: true` with `glob`

// '`foo/`' should not continue with the '`..`'
var REPLACERS = [

  // Escape metacharacters
  // which is written down by users but means special for regular expressions.

  // > There are 12 characters with special meanings:
  // > - the backslash \,
  // > - the caret ^,
  // > - the dollar sign $,
  // > - the period or dot .,
  // > - the vertical bar or pipe symbol |,
  // > - the question mark ?,
  // > - the asterisk or star *,
  // > - the plus sign +,
  // > - the opening parenthesis (,
  // > - the closing parenthesis ),
  // > - and the opening square bracket [,
  // > - the opening curly brace {,
  // > These special characters are often called "metacharacters".
  [
    /[\\\^$.|?*+()\[{]/g,
    function(match) {
      return '\\' + match
    }
  ],

  // leading slash
  [

    // > A leading slash matches the beginning of the pathname.
    // > For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
    // A leading slash matches the beginning of the pathname
    /^\//,
    '^'
  ],

  [
    /\//g,
    '\\/'
  ],

  [
    // > A leading "**" followed by a slash means match in all directories.
    // > For example, "**/foo" matches file or directory "foo" anywhere,
    // > the same as pattern "foo".
    // > "**/foo/bar" matches file or directory "bar" anywhere that is directly under directory "foo".
    // Notice that the '*'s have been replaced as '\\*'
    /^\^*\\\*\\\*\\\//,

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
    function(match) {
      // 'js*' will not match 'a.js'
      // 'js/' will not match 'a.js'
      // 'js' will match 'a.js' and 'a.js/'
      return match + '(?=$|\\/)'
    }
  ],

  // starting
  [
    // there will be no leading '/' (which has been replaced by the second replacer)
    // If starts with '**', adding a '^' to the regular expression also works
    /^(?=[^\^])/,
    '(?:^|\\/)'
  ],

  // two globstars
  [
    // > A slash followed by two consecutive asterisks then a slash matches zero or more directories.
    // > For example, "a/**/b" matches "a/b", "a/x/b", "a/x/y/b" and so on.
    // '/**/'
    /\\\/\\\*\\\*\\\//g,

    // Zero, one or several directories
    // should not use '*', or it will be replaced by the next replacer
    '(?:\\/[^\\/]+)*\\/'
  ],

  // intermediate wildcards
  [
    // Never replace escaped '*'
    // ignore rule '\*' will match the path '*'

    // 'abc.*/' -> go
    // 'abc.*'  -> skip
    /(^|[^\\]+)\\\*(?=.+)/g,
    function(match, p1) {
      // '*.js' matches '.js'
      // '*.js' doesn't match 'abc'
      return p1 + '[^\\/]*'
    }
  ],

  // ending wildcard
  [
    /\\\*$/,
    // simply remove it
    ''
  ],

  [
    /\\\\\\/g,
    '\\'
  ]
]


var cache = {}

// @param {pattern}
function regex (pattern) {
  var r = cache[pattern]
  if (r) {
    return r
  }

  var source = REPLACERS.reduce((prev, current) => {
    return prev.replace(current[0], current[1])
  }, pattern)

  return cache[pattern] = new RegExp(source, 'i')
}
