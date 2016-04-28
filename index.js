'use strict'

module.exports = () => new IgnoreBase()


// A simple implementation of make-array
function make_array (subject) {
  return Array.isArray(subject)
    ? subject
    : [subject]
}


const REGEX_BLANK_LINE = /^\s+$/
const REGEX_LEADING_EXCAPED_EXCLAMATION = /^\\\!/
const REGEX_LEADING_EXCAPED_HASH = /^\\#/
const SLASH = '/'


class IgnoreBase {
  constructor () {
    this._rules = []
    this._initCache()
  }

  _initCache () {
    this._cache = {}
  }

  // @param {Array.<string>|string|Ignore} pattern
  add (pattern) {
    this._added = false

    if (typeof pattern === 'string') {
      pattern = pattern.split(/\r?\n/g)
    }

    make_array(pattern).forEach(this._addPattern, this)

    // Some rules have just added to the ignore,
    // making the behavior changed.
    if (this._added) {
      this._initCache()
    }

    return this
  }

  // legacy
  addPattern (pattern) {
    return this.add(pattern)
  }

  _addPattern (pattern) {
    if (pattern instanceof IgnoreBase) {
      this._rules = this._rules.concat(pattern._rules)
      this._added = true;
      return
    }

    if (this._checkPattern(pattern)) {
      let rule = this._createRule(pattern)
      this._added = true
      this._rules.push(rule)
    }
  }

  _checkPattern (pattern) {
    // > A blank line matches no files, so it can serve as a separator for readability.
    return pattern
      && typeof pattern === 'string'
      && !REGEX_BLANK_LINE.test(pattern)

      // > A line starting with # serves as a comment.
      && pattern.indexOf('#') !== 0
  }

  filter (paths) {
    return make_array(paths).filter(path => this._filter(path))
  }

  createFilter () {
    return path => this._filter(path)
  }

  _createRule (pattern) {
    let rule_object = {
      origin: pattern
    }

    // > An optional prefix "!" which negates the pattern;
    if (pattern.indexOf('!') === 0) {
      rule_object.negative = true
      pattern = pattern.substr(1)
    }

    pattern = pattern
      // > Put a backslash ("\") in front of the first "!" for patterns that begin with a literal "!", for example, `"\!important!.txt"`.
      .replace(REGEX_LEADING_EXCAPED_EXCLAMATION, '!')
      // > Put a backslash ("\") in front of the first hash for patterns that begin with a hash.
      .replace(REGEX_LEADING_EXCAPED_HASH, '#')

    rule_object.pattern = pattern
    rule_object.regex = regex(pattern)

    return rule_object
  }

  _filter (path, slices) {
    if (!path) {
      return false
    }

    if (path in this._cache) {
      return this._cache[path]
    }

    if (!slices) {
      // path/to/a.js
      // ['path', 'to', 'a.js']
      slices = path.split(SLASH)

      // '/b/a.js' -> ['', 'b', 'a.js'] -> ['']
      if (slices.length && !slices[0]) {
        slices = slices.slice(1)
        slices[0] = SLASH + slices[0]
      }
    }

    slices.pop()

    return this._cache[path] = slices.length
      // > It is not possible to re-include a file if a parent directory of that file is excluded.
      // If the path contains a parent directory, check the parent first
      ? this._filter(slices.join(SLASH) + SLASH, slices)
        && this._test(path)

      // Or only test the path
      : this._test(path)
  }

  // @returns {Boolean} true if a file is NOT ignored
  _test (path) {
    // Explicitly define variable type by setting matched to `0`
    let matched = 0

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
const REPLACERS = [

  // > Trailing spaces are ignored unless they are quoted with backslash ("\")
  [
    // (a\ ) -> (a )
    // (a  ) -> (a)
    // (a \ ) -> (a  )
    /\\?\s+$/,
    function(match) {
      return match.indexOf('\\') === 0
        ? ' '
        : ''
    }
  ],

  // replace (\ ) with ' '
  [
    /\\\s/g,
    function (match) {
      return ' '
    }
  ],

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
    function () {
      return '^'
    }
  ],

  // replace special metacharacter slash after the leading slash
  [
    /\//g,
    function () {
      return '\\/'
    }
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
    function () {
      return '^(?:.*\\/)?'
    }
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
    // 'ab' will not match 'abc'
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
    // there will be no leading '/' (which has been replaced by section "leading slash")
    // If starts with '**', adding a '^' to the regular expression also works
    /^(?=[^\^])/,
    function (match) {
      return !/\/(?!$)/.test(this)
        // > If the pattern does not contain a slash /, Git treats it as a shell glob pattern
        // Actually, if there is only a trailing slash, git also treats it as a shell glob pattern
        ? '(?:^|\\/)'

        // > Otherwise, Git treats the pattern as a shell glob suitable for consumption by fnmatch(3)
        : '^'
    }
  ],

  // two globstars
  [
    /\\\/\\\*\\\*(?=\\\/|$)/g,

    // Zero, one or several directories
    // should not use '*', or it will be replaced by the next replacer
    function (m, index, str) {

      // Check if it is not the last `'/**'`
      return index + 6 < str.length

        // case: /**/
        // > A slash followed by two consecutive asterisks then a slash matches zero or more directories.
        // > For example, "a/**/b" matches "a/b", "a/x/b", "a/x/y/b" and so on.
        // '/**/'
        ? '(?:\\/[^\\/]+)*'

        // case: /**
        // > A trailing `"/**"` matches everything inside.

        // #21: everything inside but it should not include the current folder
        : '\\/.+'
    }
  ],

  // intermediate wildcards
  [
    // Never replace escaped '*'
    // ignore rule '\*' will match the path '*'

    // 'abc.*/' -> go
    // 'abc.*'  -> skip this rule
    /(^|[^\\]+)\\\*(?=.+)/g,
    function(match, p1) {
      // '*.js' matches '.js'
      // '*.js' doesn't match 'abc'
      return p1 + '[^\\/]*'
    }
  ],

  // trailing wildcard
  [
    /(\\\/)?\\\*$/,
    function (m, p1) {
      return p1 === '\\/'
        // 'a/*' does not match 'a/'
        // 'a/*' matches 'a/a'
        // 'a/'
        ? '\\/[^/]+'

        // or it will match everything after
        : ''
    }
  ],

  [
    // unescape
    /\\\\\\/g,
    function () {
      return '\\'
    }
  ]
]


// A simple cache, because an ignore rule only has only one certain meaning
let cache = {}

// @param {pattern}
function regex (pattern) {
  let r = cache[pattern]
  if (r) {
    return r
  }

  let source = REPLACERS.reduce((prev, current) => {
    return prev.replace(current[0], current[1].bind(pattern))
  }, pattern)

  return cache[pattern] = new RegExp(source, 'i')
}


// Windows
// --------------------------------------------------------------
if (
  process.env.IGNORE_TEST_WIN32
  || process.platform === 'win32'
) {

  let filter = IgnoreBase.prototype._filter
  let make_posix = str => /^\\\\\?\\/.test(str)
    || /[^\x00-\x80]+/.test(str)
      ? str
      : str.replace(/\\/g, '/')

  IgnoreBase.prototype._filter = function (path, slices) {
    path = make_posix(path)
    return filter.call(this, path, slices)
  }
}
