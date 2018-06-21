const {test} = require('tap')
const spawn = require('spawn-sync')
const tmp = require('tmp').dirSync
const mkdirp = require('mkdirp').sync
const rm = require('rimraf').sync
const fs = require('fs')
const path = require('path')
const {removeEnding} = require('pre-suf')
const cases = require('./fixtures/cases')

const IS_WINDOWS = process.platform === 'win32'

function getNativeGitIgnoreResults (rules, paths) {
  const dir = createUniqueTmp()

  const gitignore = typeof rules === 'string'
    ? rules
    : rules.join('\n')

  touch(dir, '.gitignore', gitignore)

  paths.forEach((p, i) => {
    if (p === '.gitignore') {
      return
    }

    // We do not know if a path is NOT a file,
    // if we:
    // `touch a`
    // and then `touch a/b`, then boooom!
    if (containsInOthers(p, i, paths)) {
      return
    }

    touch(dir, p)
  })

  spawn('git', ['init'], {
    cwd: dir
  })

  spawn('git', ['add', '-A'], {
    cwd: dir
  })

  return paths
  .filter(p => {
    let out = spawn('git', [
      'check-ignore',
      // `spawn` will escape the special cases for us
      p
    ], {
      cwd: dir
    }).stdout.toString()

    out = removeEnding(out, '\n')

    const ignored = out === p
    return !ignored
  })
}

function touch (root, file, content) {
  const dirs = file.split('/')
  const basename = dirs.pop()

  const dir = dirs.join('/')

  if (dir) {
    mkdirp(path.join(root, dir))
  }

  // abc/ -> should not create file, but only dir
  if (basename) {
    fs.writeFileSync(path.join(root, file), content || '')
  }
}

let tmpCount = 0
const tmpRoot = tmp().name

function createUniqueTmp () {
  const dir = path.join(tmpRoot, String(tmpCount ++))
  // Make sure the dir not exists,
  // clean up dirty things
  rm(dir)
  mkdirp(dir)
  return dir
}

function containsInOthers (_path, index, paths) {
  _path = removeEnding(_path, '/')

  return paths.some((p, i) => {
    if (index === i) {
      return false
    }

    return p === _path
    || p.indexOf(_path) === 0 && p[_path.length] === '/'
  })
}

function notGitBuiltin (filename) {
  return filename.indexOf('.git/') !== 0
}

cases((
  description,
  patterns,
  paths_object,
  skip_test_test,
  paths,
  expected,
  expect_result
) => {
  if (
    // In some platform, the behavior of git command about trailing spaces
    // is not implemented as documented, so skip test
    skip_test_test
    // Tired to handle test cases for test cases for windows
    || IS_WINDOWS
    // `git check-ignore` could only handles non-empty filenames
    || !paths.some(Boolean)
    // `git check-ignore` will by default ignore .git/ directory
    // which `node-ignore` should not do as well
    || !expected.every(notGitBuiltin)
  ) {
    return
  }

  test(`test for test:    ${description}`, t => {
    const result = getNativeGitIgnoreResults(patterns, paths).sort()

    expect_result(t, result)
    t.end()
  })
})
