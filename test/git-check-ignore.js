var expect = require('chai').expect
var spawn = require('spawn-sync')
var tmp = require('tmp').dirSync
var mkdirp = require('mkdirp').sync
var rm = require('rimraf').sync
var fs = require('fs')
var path = require('path')
var removeEnding = require('pre-suf').removeEnding
var cases = require('./fixtures/cases')

var IS_WINDOWS = process.platform === 'win32'

describe("cases", function() {
  cases(function (
    description,
    patterns,
    paths_object,
    skip_test_test,
    paths,
    expected,
    expect_result
  ) {
    // In some platform, the behavior of git command about trailing spaces
    // is not implemented as documented, so skip test
    !skip_test_test
    // Tired to handle test cases for test cases for windows
    && !IS_WINDOWS
    // `git check-ignore` could only handles non-empty filenames
    && paths.some(Boolean)
    // `git check-ignore` will by default ignore .git/ directory
    // which `node-ignore` should not do as well
    && expected.every(notGitBuiltin)
    && it('test for test:    ' + description, function () {
      var result = getNativeGitIgnoreResults(patterns, paths).sort()

      expect_result(result)
    })
  })
})

function getNativeGitIgnoreResults (rules, paths) {
  var dir = createUniqueTmp()

  var gitignore = typeof rules === 'string'
    ? rules
    : rules.join('\n')

  touch(dir, '.gitignore', gitignore)

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
    }).stdout.toString()

    out = removeEnding(out, '\n')

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
    mkdirp(path.join(root, dir))
  }

  // abc/ -> should not create file, but only dir
  if (basename) {
    fs.writeFileSync(path.join(root, file), content || '')
  }
}

var tmpCount = 0
var tmpRoot = tmp().name

function createUniqueTmp () {
  var dir = path.join(tmpRoot, String(tmpCount ++))
  // Make sure the dir not exists,
  // clean up dirty things
  rm(dir)
  mkdirp(dir)
  return dir
}

function containsInOthers (path, index, paths) {
  path = removeEnding(path, '/')

  return paths.some(function (p, i) {
    if (index === i) {
      return
    }

    return p === path
    || p.indexOf(path) === 0 && p[path.length] === '/'
  })
}

function notGitBuiltin (filename) {
  return filename.indexOf('.git/') !== 0
}
