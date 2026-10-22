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

const toGitignore = rules => typeof rules === 'string'
  ? rules
  : rules.map(mapObjectRule).join('\n')

const getNativeGitIgnoreResults = (rules, paths) => {
  const dir = createUniqueTmp()

  touch(dir, '.gitignore', toGitignore(rules))

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

  // For every path, what `git check-ignore -v` prints when a rule ignores
  //   the path, or `undefined` when the path is not ignored.
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

    reported[p] = ignored
      ? `${source}:${linenum}:${pattern}\t${p}`
      : UNDEFINED
  })

  return reported
}

const notIgnored = reported => Object.keys(reported)
.filter(p => reported[p] === UNDEFINED)

// The rules of a .gitignore, each marked with its line number, the way
//   README's `.checkIgnore()` example adds them
const addLines = rules => ignore().add(
  toGitignore(rules)
  .split('\n')
  .map((pattern, index) => ({
    pattern,
    mark: String(index + 1)
  }))
)

// git's `trim_trailing_spaces()` (dir.c): the trailing spaces go, unless a
//   backslash quotes one, and a backslash quotes whatever follows it
const trimTrailingSpaces = line => {
  let lastSpace = - 1

  for (let i = 0; i < line.length; i ++) {
    const char = line[i]

    if (char === ' ') {
      if (lastSpace < 0) {
        lastSpace = i
      }
    } else {
      if (char === '\\') {
        i ++

        if (i === line.length) {
          return line
        }
      }

      lastSpace = - 1
    }
  }

  return lastSpace < 0
    ? line
    : line.slice(0, lastSpace)
}

// A pattern as `git check-ignore -v` prints it: git reads a .gitignore
//   without the BOM it starts with, and each line without its CR and trailing
//   spaces. Doing the same is left to whoever prints, as here.
const printed = rule => {
  const line = rule.mark === '1'
    ? rule.pattern.replace(/^\uFEFF/, '')
    : rule.pattern

  return trimTrailingSpaces(line.replace(/\r$/, ''))
}

// What README's `.checkIgnore()` example prints for a path a rule ignores,
//   which is what `git check-ignore -v` prints for it
const verbose = (ig, p) => {
  const {
    ignored,
    rule
  } = ig.checkIgnore(p)

  return ignored
    ? `.gitignore:${rule.mark}:${printed(rule)}\t${p}`
    : UNDEFINED
}

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

    const ig = addLines(patterns)

    paths.forEach(p => {
      t.equal(
        verbose(ig, p),
        reported[p],
        `path: "${p}": the same line as git check-ignore -v`
      )
    })

    t.end()
  })
})

test(`dummy test for windows`, t => {
  t.pass()
  t.end()
})
