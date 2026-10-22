const fs = require('fs')
const path = require('path')

const tap = require('tap')
const spawn = require('spawn-sync')
const tmp = require('tmp').dirSync
const mkdirp = require('mkdirp').mkdirp.sync
const rm = require('rimraf').sync
const {removeEnding} = require('pre-suf')
const {
  debug,
  cases,
  checkEnv,
  IS_WINDOWS
} = require('./fixtures/cases')

const {test} = tap

const ignore = require('..')

const UNDEFINED = undefined

// This test file is related to dealing with file systems which takes time
tap.setTimeout(600000)

const touch = (root, file, content) => {
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

const containsInOthers = (_path, index, paths) => {
  _path = removeEnding(_path, '/')

  return paths.some((p, i) => {
    if (index === i) {
      return false
    }

    return p === _path
    || p.indexOf(_path) === 0 && p[_path.length] === '/'
  })
}

let tmpCount = 0
const tmpRoot = tmp().name

const createUniqueTmp = () => {
  const dir = path.join(tmpRoot, String(tmpCount ++))
  // Make sure the dir not exists,
  // clean up dirty things
  rm(dir)
  mkdirp(dir)
  return dir
}

const debugSpawn = (...args) => {
  const out = spawn(...args)
  debug(out.output.toString())
}

const isGitBuiltin = filename => filename.indexOf('.git/') === 0

const mapObjectRule = rule =>
  typeof rule === 'string'
    ? rule
    : rule.pattern

const getNativeGitIgnoreResults = (rules, paths) => {
  const dir = createUniqueTmp()

  const gitignore = typeof rules === 'string'
    ? rules
    : rules.map(mapObjectRule).join('\n')

  touch(dir, '.gitignore', gitignore)

  paths.forEach((p, i) => {
    if (p === '.gitignore') {
      return
    }

    // `git init` creates `.git/` itself, with the files a fixture asks
    //   about; creating them first would hand `git init` a broken repository.
    if (isGitBuiltin(p)) {
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

  debugSpawn('ls', ['-alF'], {
    cwd: dir
  })

  debugSpawn('cat', ['.gitignore'], {
    cwd: dir
  })

  const lines = gitignore.split('\n')

  // For every path, the line of the rule `git check-ignore -v` reports when
  //   that rule ignores the path, or `undefined` when the path is not ignored.
  const reported = Object.create(null)

  paths.forEach(p => {
    // `-z` asks for machine-parseable output: the matched path comes back
    //   raw, NUL-terminated, with none of the C-quoting that would otherwise
    //   mangle a path holding a backslash, a tab or a non-ASCII character.
    // It insists on `--stdin`, so the path goes in the same way, NUL-ended.
    //
    // node-ignore matches case-insensitively by default, while a new
    //   repository takes `core.ignorecase` from the file system it lives on,
    //   so git is told to do as node-ignore does on every platform.
    //
    // `-v -n` reports `<source> <linenum> <pattern> <pathname>` for every
    //   path, all four empty when no rule matches it.
    const out = spawn('git', [
      '-c',
      'core.ignorecase=true',
      'check-ignore',
      '--no-index',
      '-v',
      '-n',
      '-z',
      '--stdin'
    ], {
      cwd: dir,
      input: `${p}\u0000`
    })
    .stdout
    .toString()

    const [source, linenum, pattern] = out.split('\u0000')

    // A negative pattern that matches leaves the path unignored
    const ignored = !!source && pattern[0] !== '!'

    debug('git check-ignore -v %s: %j -> ignored: %s', p, out, ignored)

    // git drops the line's trailing CR
    reported[p] = ignored
      ? lines[linenum - 1].replace(/\r$/, '')
      : UNDEFINED
  })

  return reported
}

const notIgnored = reported => Object.keys(reported)
.filter(p => reported[p] === UNDEFINED)

// The pattern of a rule, as the line of the .gitignore it stands for
const lineOf = rule => rule.pattern.replace(/[\r\n]+$/, '')

checkEnv('IGNORE_ONLY_FIXTURES') && cases(({
  description,
  patterns,
  skip_test_fixture,
  paths,
  expect_result
}) => {
  if (
    // In some platform, the behavior of git command about trailing spaces
    // is not implemented as documented, so skip testing
    skip_test_fixture
    // Tired to handle test cases for test cases for windows
    || IS_WINDOWS
    // `git check-ignore` could only handles non-empty filenames
    || !paths.some(Boolean)
  ) {
    return
  }

  test(`test for test:    ${description}`, t => {
    const reported = getNativeGitIgnoreResults(patterns, paths)

    expect_result(t, notIgnored(reported).sort())

    // `.checkIgnore()` names the rule `git check-ignore -v` reports
    const ig = ignore().add(patterns)

    paths.forEach(p => {
      if (reported[p] === UNDEFINED) {
        return
      }

      const {rule} = ig.checkIgnore(p)

      t.equal(
        rule && lineOf(rule),
        reported[p],
        `path: "${p}" is ignored by the rule git reports`
      )
    })

    t.end()
  })
})

test(`dummy test for windows`, t => {
  t.pass()
  t.end()
})
