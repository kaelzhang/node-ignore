'use strict'

var fs = require('fs')
var ignore = require('../')
var expect = require('chai').expect

var cases = [
  // description  patterns  paths/expect  only
  [
    'A blank line matches no files',
    [
      ''
    ],
    {
      'a': 0,
      '/a': 0,
      'a/b/c': 0
    }
  ],
  [
    'A line starting with # serves as a comment.',
    ['#abc'],
    {
      '#abc': 0
    }
  ],
  [
    'Put a backslash ("\\") in front of the first hash for patterns that begin with a hash.',
    ['\\#abc'],
    {
      '#abc': 1
    }
  ],
  [
    'Trailing spaces are ignored unless they are quoted with backslash ("\")',
    [
      'abc\\  ', // only one space left -> (abc )
      'bcd  ',   // no space left -> (bcd)
      'cde \\ '  // -> (cde  )
    ],
    {
      'abc\\  ': 0,
      'abc  ': 0,
      'abc ': 1,
      'abc   ': 0,
      'bcd': 1,
      'bcd ': 0,
      'bcd  ': 0,
      'cde  ': 1,
      'cde ': 0,
      'cde   ': 0
    }
  ],
  [
    'An optional prefix "!" which negates the pattern; any matching file excluded by a previous pattern will become included again',
    [
      'abc',
      '!abc'
    ],
    {
      // the parent folder is included again
      'abc/a.js': 0,
      'abc/': 0
    }
  ],
  [
    'issue #10: It is not possible to re-include a file if a parent directory of that file is excluded',
    [
      '/abc/',
      '!/abc/a.js'
    ],
    {
      'abc/a.js': 1,
      'abc/d/e.js': 1
    }
  ],
  [
    'we did not know whether the rule is a dir first',
    [
      'abc',
      '!bcd/abc/a.js'
    ],
    {
      'abc/a.js': 1,
      'bcd/abc/a.js': 1
    }
  ],
  [
    'Put a backslash ("\\") in front of the first "!" for patterns that begin with a literal "!"',
    [
      '\\!abc',
      '\\!important!.txt'
    ],
    {
      '!abc': 1,
      'abc': 0,
      'b/!important!.txt': 1,
      '!important!.txt': 1
    }
  ],

  [
    'If the pattern ends with a slash, it is removed for the purpose of the following description, but it would only find a match with a directory',
    [
      'abc/'
    ],
    {
      // actually, node-ignore have no idea about fs.Stat,
      // you should `glob({mark: true})`
      'abc': 0,
      'abc/': 1,

      // Actually, if there is only a trailing slash, git also treats it as a shell glob pattern
      // 'abc/' should make 'bcd/abc/' ignored.
      'bcd/abc/': 1
    }
  ],

  [
    'If the pattern does not contain a slash /, Git treats it as a shell glob pattern',
    [
      'a.js'
    ],
    {
      'a.js': 1,
      'b/a/a.js': 1,
      'a/a.js': 1,
      'b/a.jsa': 0
    }
  ],
  [
    'Otherwise, Git treats the pattern as a shell glob suitable for consumption by fnmatch(3) with the FNM_PATHNAME flag',
    [
      'a/a.js'
    ],
    {
      'a/a.js': 1,
      'a/a.jsa': 0,
      'b/a/a.js': 0,
      'c/a/a.js': 0
    }
  ],

  [
    'wildcards in the pattern will not match a / in the pathname.',
    [
      'Documentation/*.html'
    ],
    {
      'Documentation/git.html': 1,
      'Documentation/ppc/ppc.html': 0,
      'tools/perf/Documentation/perf.html': 0
    }
  ],

  [
    'A leading slash matches the beginning of the pathname',
    [
      '/*.c'
    ],
    {
      'cat-file.c': 1,
      'mozilla-sha1/sha1.c': 0
    }
  ],

  [
    'A leading "**" followed by a slash means match in all directories',
    [
      '**/foo'
    ],
    {
      'foo': 1,
      'a/foo': 1,
      'foo/a': 1,
      'a/foo/a': 1
    }
  ],

  [
    '"**/foo/bar" matches file or directory "bar" anywhere that is directly under directory "foo"',
    [
      '**/foo/bar'
    ],
    {
      'foo/bar': 1,
      'abc/foo/bar': 1,
      'abc/foo/bar/': 1
    }
  ],

  [
    'A trailing "/**" matches everything inside',
    [
      'abc/**'
    ],
    {
      'abc/a/': 1,
      'abc/b': 1,
      'abc/d/e/f/g': 1,
      'bcd/abc/a': 0,
      'abc': 0
    }
  ],

  [
    'A slash followed by two consecutive asterisks then a slash matches zero or more directories',
    [
      'a/**/b'
    ],
    {
      'a/b': 1,
      'a/x/b': 1,
      'a/x/y/b': 1,
      'b/a/b': 0
    }
  ],

  [
    'add a file content',
    'test/fixtures/.aignore',
    {
      'abc/a.js': 1,
      'abc/b/b.js': 1,
      '#e': 0,
      '#f': 1
    }
  ],

  // old test cases
  [
    'should excape metacharacters of regular expressions', [
      '*.js',
      '!\\*.js',
      '!a#b.js',
      '!?.js',

      // comments
      '#abc',

      '\\#abc'
    ], {
      '*.js': 0,
      'abc.js': 1,
      'a#b.js': 0,
      'abc': 0,
      '#abc': 1,
      '?.js': 0
    }
  ],

  [
    'issue #2: question mark should not break all things',
    'test/fixtures/.ignore-issue-2', {
      '.project': 1,
      // remain
      'abc/.project': 0,
      '.a.sw': 0,
      '.a.sw?': 1,
      'thumbs.db': 1
    }
  ],
  [
    'dir ended with "*"', [
      'abc/*'
    ], {
      'abc': 0
    }
  ],
  [
    'file ended with "*"', [
      'abc.js*',
    ], {
      'abc.js/': 1,
      'abc.js/abc': 1,
      'abc.jsa/': 1,
      'abc.jsa/abc': 1
    }
  ],
  [
    'wildcard as filename', [
      '*.b'
    ], {
      'b/a.b': 1,
      'b/.b': 1,
      'b/.ba': 0,
      'b/c/a.b': 1
    }
  ],
  [
    'slash at the beginning and come with a wildcard', [
      '/*.c'
    ], {
      '.c': 1,
      'c.c': 1,
      'c/c.c': 0,
      'c/d': 0
    }
  ],
  [
    'dot file', [
      '.d'
    ], {
      '.d': 1,
      '.dd': 0,
      'd.d': 0,
      'd/.d': 1,
      'd/d.d': 0,
      'd/e': 0
    }
  ],
  [
    'dot dir', [
      '.e'
    ], {
      '.e/': 1,
      '.ee/': 0,
      'e.e/': 0,
      '.e/e': 1,
      'e/.e': 1,
      'e/e.e': 0,
      'e/f': 0
    }
  ],
  [
    'node modules: once', [
      'node_modules/'
    ], {
      'node_modules/gulp/node_modules/abc.md': 1,
      'node_modules/gulp/node_modules/abc.json': 1
    }
  ],
  [
    'node modules: twice', [
      'node_modules/',
      'node_modules/'
    ], {
      'node_modules/gulp/node_modules/abc.md': 1,
      'node_modules/gulp/node_modules/abc.json': 1
    }
  ]
]

var cases_to_test_only = cases.filter(function (c) {
  return c[3]
})

function readPatterns(file) {
  return fs.readFileSync(file).toString()
}

describe("cases", function() {
  (
    cases_to_test_only.length
      ? cases_to_test_only
      : cases

  ).forEach(function(c) {
    var description = c[0]
    var patterns = c[1]
    var paths_object = c[2]

    if (typeof patterns === 'string') {
      patterns = readPatterns(patterns)
    }

    var paths = Object.keys(paths_object)
    var expected = paths.filter(function(p) {
      return !paths_object[p]
    })

    function expect_result(result) {
      expect(result.sort()).to.deep.equal(expected.sort())
    }

    it('.filter():       ' + description, function() {
      var result = ignore()
        .addPattern(patterns)
        .filter(paths)

      expect_result(result)
    })

    it(".createFilter(): " + description, function() {
      var result = paths.filter(
        ignore()
        .addPattern(patterns)
        .createFilter(),
        // thisArg should be binded
        null
      )

      expect_result(result)
    })
  })
})