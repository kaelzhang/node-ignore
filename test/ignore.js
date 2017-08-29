'use strict'

// For old node.js versions, we use es5
var fs = require('fs')
var ignore = require('../')
var expect = require('chai').expect
var spawn = require('spawn-sync')
var tmp = require('tmp').dirSync
var mkdirp = require('mkdirp').sync
var path = require('path')
var rm = require('rimraf').sync
var removeEnding = require('pre-suf').removeEnding


var IS_WINDOWS = process.platform === 'win32'
var SHOULD_TEST_WINDOWS = !process.env.IGNORE_TEST_WIN32
  && IS_WINDOWS

var cases = [
  [
    'intermediate "\ " should be unescaped to " "',
    [
      'abc\\ d',
      'abc e',
      'a\\ b\\ c'
    ],
    {
      'abc d': 1,
      'abc e': 1,
      'abc/abc d': 1,
      'abc/abc e': 1,
      'abc/a b c': 1
    }
  ],
  [
    'special cases: invalid empty paths, just ignore',
    [
    ],
    {
      '': 1
    }
  ],
  [
    '#25',
    [
      '.git/*',
      '!.git/config',
      '.ftpconfig'
    ],
    {
      '.ftpconfig': 1,
      '.git/config': 0,
      '.git/description': 1
    }
  ],
  [
    '#26: .gitignore man page sample',
    [
      '# exclude everything except directory foo/bar',
      '/*',
      '!/foo',
      '/foo/*',
      '!/foo/bar'
    ],
    {
      'no.js': 1,
      'foo/no.js': 1,
      'foo/bar/yes.js': 0,
      'foo/bar/baz/yes.js': 0,
      'boo/no.js': 1
    }
  ],
  [
    'wildcard: special case, escaped wildcard',
    [
      '*.html',
      '!a/b/\\*/index.html'
    ],
    {
      'a/b/*/index.html': 0,
      'a/b/index.html': 1
    }
  ],
  [
    'wildcard: treated as a shell glob suitable for consumption by fnmatch(3)',
    [
      '*.html',
      '!b/\*/index.html'
    ],
    {
      'a/b/*/index.html': 1,
      'a/b/index.html': 1
    }
  ],
  [
    'wildcard: with no escape',
    [
      '*.html',
      '!a/b/*/index.html'
    ],
    {
      'a/b/*/index.html': 0,
      'a/b/index.html': 1
    }
  ],
  [
    '#24: a negative pattern without a trailing wildcard',
    [
      '/node_modules/*',
      '!/node_modules',
      '!/node_modules/package'
    ],
    {
      'node_modules/a/a.js': 1,
      'node_modules/package/a.js': 0
    }
  ],
  [
    '#21: unignore with 1 globstar, reversed order',
    [
      '!foo/bar.js',
      'foo/*'
    ],
    {
      'foo/bar.js': 1,
      'foo/bar2.js': 1,
      'foo/bar/bar.js': 1
    }
  ],

  [
    '#21: unignore with 2 globstars, reversed order',
    [
      '!foo/bar.js',
      'foo/**'
    ],
    {
      'foo/bar.js': 1,
      'foo/bar2.js': 1,
      'foo/bar/bar.js': 1
    }
  ],

  [
    '#21: unignore with several groups of 2 globstars, reversed order',
    [
      '!foo/bar.js',
      'foo/**/**'
    ],
    {
      'foo/bar.js': 1,
      'foo/bar2.js': 1,
      'foo/bar/bar.js': 1
    }
  ],

  [
    '#21: unignore with 1 globstar',
    [
      'foo/*',
      '!foo/bar.js'
    ],
    {
      'foo/bar.js': 0,
      'foo/bar2.js': 1,
      'foo/bar/bar.js': 1
    }
  ],

  [
    '#21: unignore with 2 globstars',
    [
      'foo/**',
      '!foo/bar.js'
    ],
    {
      'foo/bar.js': 0,
      'foo/bar2.js': 1,
      'foo/bar/bar.js': 1
    }
  ],

  [
    'related to #21: several groups of 2 globstars',
    [
      'foo/**/**',
      '!foo/bar.js'
    ],
    {
      'foo/bar.js': 0,
      'foo/bar2.js': 1,
      'foo/bar/bar.js': 1
    }
  ],

  // description  patterns  paths/expect  only
  [
    'ignore dot files',
    [
      '.*'
    ],
    {
      '.a': 1,
      '.gitignore': 1
    }
  ],

  [
    '#14, README example broken in `3.0.3`',
    [
      '.abc/*',
      '!.abc/d/'
    ],
    {
      '.abc/a.js': 1,
      '.abc/d/e.js': 0
    }
  ],

  [
    '#14, README example broken in `3.0.3`, not negate parent folder',
    [
      '.abc/*',
      // .abc/d will be ignored
      '!.abc/d/*'
    ],
    {
      '.abc/a.js': 1,
      // so '.abc/d/e.js' will be ignored
      '.abc/d/e.js': 1
    }
  ],

  [
    'A blank line matches no files',
    [
      ''
    ],
    {
      'a': 0,
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
    },
    true
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
      'a.js',
      'f/'
    ],
    {
      'a.js': 1,
      'b/a/a.js': 1,
      'a/a.js': 1,
      'b/a.jsa': 0,
      'f/': 1,
      'g/f/': 1
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
      'a/foo/a': 1,
      'a/b/c/foo/a': 1
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

var real_cases = cases_to_test_only.length
  ? cases_to_test_only
  : cases

describe("cases", function() {
  real_cases.forEach(function(c) {
    var description = c[0]
    var patterns = c[1]
    var paths_object = c[2]

    if (typeof patterns === 'string') {
      patterns = readPatterns(patterns)
    }

    // All paths to test
    var paths = Object.keys(paths_object)

    // paths that NOT ignored
    var expected = paths
    .filter(function(p) {
      return !paths_object[p]
    })
    .sort()

    function expect_result(result, mapper) {
      if (mapper) {
        expected = expected.map(mapper)
      }

      expect(result.sort()).to.deep.equal(expected.sort())
    }

    it('.filter():        ' + description, function() {
      var ig = ignore()
      var result = ig
        .addPattern(patterns)
        .filter(paths)

      expect_result(result)
    })

    it('.createFilter():  ' + description, function() {
      var result = paths.filter(
        ignore()
        .addPattern(patterns)
        .createFilter(),
        // thisArg should be binded
        null
      )

      expect_result(result)
    })

    it('.ignores(path):   ' + description, function () {
      var ig = ignore().addPattern(patterns)

      Object.keys(paths_object).forEach(function (path) {
        expect(ig.ignores(path)).to.equal(!!paths_object[path])
      })
    })


    // Tired to handle test cases for test cases for windows
    !IS_WINDOWS
    // `git check-ignore` could only handles non-empty filenames
    && paths.some(Boolean)
    // `git check-ignore` will by default ignore .git/ directory
    // which `node-ignore` should not do as well
    && expected.every(notGitBuiltin)
    && it('test for test:    ' + description, function () {
      var result = getNativeGitIgnoreResults(patterns, paths).sort()

      console.log(JSON.stringify(result, null, 2), JSON.stringify(expected, null, 2))
      expect_result(result)
    })

    SHOULD_TEST_WINDOWS && it('win32: .filter(): ' + description, function() {
      var win_paths = paths.map(make_win32)

      var ig = ignore()
      var result = ig
        .addPattern(patterns)
        .filter(win_paths)

      expect_result(result, make_win32)
    })
  })

  it('.add(<Ignore>)', function() {
    var a = ignore().add(['.abc/*', '!.abc/d/'])
    var b = ignore().add(a).add('!.abc/e/')

    var paths = [
      '.abc/a.js',    // filtered out
      '.abc/d/e.js',  // included
      '.abc/e/e.js'   // included by b, filtered out by a
    ]

    expect(a.filter(paths)).to.eql(['.abc/d/e.js']);
    expect(b.filter(paths)).to.eql(['.abc/d/e.js', '.abc/e/e.js']);
  })
})

function make_win32 (path) {
  return path.replace(/\//g, '\\')
}


describe('for coverage', function () {
  it('fixes babel class', function () {
    var constructor = ignore().constructor

    try {
      constructor()
    } catch (e) {
      return
    }

    expect('there should be an error').to.equal('no error found')
  })
})


var tmpCount = 0
var tmpRoot = tmp().name


function createUniqueTmp () {
  var dir = path.join(tmpRoot, String(tmpCount ++))
  // Make sure the dir not exists,
  // clean up dirty things
  rm(dir)
  console.log('exists', fs.existsSync(dir))
  mkdirp(dir)
  return dir
}


function getNativeGitIgnoreResults (rules, paths) {
  var dir = createUniqueTmp()

  var gitignore = rules.join('\n')
console.log('gitignore', gitignore)
  touch(dir, '.gitignore', gitignore)
console.log('dir', dir)
  var content = fs.readFileSync(path.join(dir, '.gitignore')).toString()
console.log('.gitignore content', fs.readFileSync(path.join(dir, '.gitignore')).toString(), content === gitignore)

  paths.forEach(function (path, i) {
    if (path === '.gitignore') {
      return
    }

    // We do not know if a path is NOT a file,
    // if we:
    // `touch a`
    // and then `touch a/b`, then boooom!
    if (containsInOthers(path, i, paths)) {
      return
    }

    touch(dir, path)
  })

  spawn('git', ['init'], {
    cwd: dir
  })

  spawn('git', ['add', '-A'], {
    cwd: dir
  })

  return paths
  .filter(function (path) {
    var out = spawn('git', [
      'check-ignore',
      // `spawn` will escape the special cases for us
      path
    ], {
      cwd: dir
    }).stdout.toString().trim()

console.log('out:', out, path)
    var ignored = out === path
    return !ignored
  })
}


function touch (root, file, content) {
  // file = specialCharInFileOrDir(file)

  var dirs = file.split('/')
  var basename = dirs.pop()

  var dir = dirs.join('/')

  if (dir) {
    mkdirp(path.posix.join(root, dir))
  }

console.log(path.join(root, file), content)
  fs.writeFileSync(path.join(root, file), content || '')
}


function containsInOthers (path, index, paths) {
  path = removeEnding(path, '/')

  return paths.some((p, i) => {
    if (index === i) {
      return
    }

    p = removeEnding(p, '/')

    return p.indexOf(path) === 0 && p[path.length] === '/'
  })
}


function notGitBuiltin (filename) {
  return filename.indexOf('.git/') !== 0
}
