#!/usr/bin/env node

// The compatibility gate.
//
//   node compat            check every promised version, plus the latest tag
//   node compat --win32    the same, with Windows path handling switched on
//
// A promise of compatibility with a released version means one thing: code
//   written against that version keeps working. The honest way to check it is
//   to take that version's own test suite -- the contract it shipped -- and
//   run it against the current `index.js`. If the old tests still pass, the
//   current code still honours what that version guaranteed. If one fails, a
//   guarantee has been broken: either a regression to fix, or a deliberate
//   breaking change, in which case that version is dropped from
//   `compat/config.js` because the promise to it is ending.
//
// Which versions are checked: everything in `compat/config.js`, plus the
//   latest tag, so an accidental break of the release dependents run cannot
//   slip through even if the config forgets it.
//
// How: each version is checked out into a throwaway git worktree, its
//   `index.js` is replaced with the working tree's, and its `ignore` and
//   `others` test files -- the ones that exercise the library -- are run
//   there with tap. (Its `git-check-ignore` suite is skipped: that one checks
//   fixtures against the real git binary, not the library, so it says nothing
//   about the current code.)
//
// Exit codes: 0 every promise holds, 1 one does not, 2 the gate could not run
//   (no tags, tap missing, a worktree that would not create).

const fs = require('fs')
const os = require('os')
const path = require('path')
const {execFileSync, spawnSync} = require('child_process')

const ROOT = path.join(__dirname, '..')

const configured = require('./config')

const git = args => execFileSync('git', args, {
  cwd: ROOT,
  maxBuffer: 1 << 26,
  // Capture stderr rather than let it through -- `worktree add` narrates
  //   itself there, and a real failure still arrives on the thrown error.
  stdio: ['ignore', 'pipe', 'pipe']
}).toString()

const latestTag = () => git(['describe', '--tags', '--abbrev=0']).trim()

const TAP = path.join(ROOT, 'node_modules', '.bin', 'tap')

// The test files that actually run patterns and paths through the library.
//   `git-check-ignore` is a git oracle over the fixtures, not a test of the
//   library, so it is not part of the contract a new build has to keep.
const SUITES = ['test/ignore.test.js', 'test/others.test.js']

// Run one version's suite against the working tree's index.js.
// @returns {{ok: boolean, output: string}}
const checkVersion = (version, win32) => {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'ignore-compat-'))

  // A fresh checkout of the tag, detached so nothing touches a branch.
  git(['worktree', 'add', '--detach', '--force', worktree, version])

  try {
    // The version's tests, its fixtures -- but the current library.
    fs.copyFileSync(path.join(ROOT, 'index.js'), path.join(worktree, 'index.js'))

    // tap and the test helpers live in the working tree's node_modules; the
    //   worktree has none of its own.
    fs.symlinkSync(
      path.join(ROOT, 'node_modules'),
      path.join(worktree, 'node_modules')
    )

    const result = spawnSync(
      TAP,
      ['--reporter', 'classic', '--no-check-coverage', ...SUITES],
      {
        cwd: worktree,
        encoding: 'utf8',
        maxBuffer: 1 << 26,
        env: Object.assign({}, process.env, win32
          ? {IGNORE_TEST_WIN32: '1'}
          : {})
      }
    )

    return {
      ok: result.status === 0,
      output: `${result.stdout || ''}${result.stderr || ''}`
    }
  } finally {
    git(['worktree', 'remove', '--force', worktree])
  }
}

const main = argv => {
  const win32 = argv.indexOf('--win32') >= 0

  let latest
  try {
    latest = latestTag()
  } catch (error) {
    process.stderr.write(
      'cannot resolve the latest tag -- the gate needs the tags and the '
      + 'history that reaches them\n(in CI, check out with fetch-depth: 0)\n'
    )
    return 2
  }

  if (!fs.existsSync(TAP)) {
    process.stderr.write(
      'tap is not installed -- the gate runs each version\'s test suite, so '
      + 'it needs the dev dependencies (`npm install`)\n'
    )
    return 2
  }

  // Every configured version, plus the latest tag, without a duplicate and in
  //   a stable order.
  const versions = configured.indexOf(latest) < 0
    ? configured.concat(latest)
    : configured.slice()

  process.stdout.write(
    `compat${win32 ? ' (win32)' : ''}: `
    + `the working tree against ${versions.join(', ')}\n`
  )

  const broken = []

  versions.forEach(version => {
    let result
    try {
      result = checkVersion(version, win32)
    } catch (error) {
      process.stderr.write(`  ${version}: could not run -- ${error.message}\n`)
      broken.push(version)
      return
    }

    process.stdout.write(`  ${version}: ${result.ok ? 'ok' : 'FAILED'}\n`)

    if (!result.ok) {
      broken.push(version)
      // The failing assertions, indented, so the break is named in place.
      result.output
      .split('\n')
      .filter(line => /^\s*not ok/.test(line))
      .slice(0, 20)
      .forEach(line => process.stdout.write(`      ${line.trim()}\n`))
    }
  })

  if (broken.length) {
    process.stdout.write(
      `\nThe working tree breaks the test suite of ${broken.join(', ')}.\n`
      + 'If that is a regression, fix it. If it is a deliberate breaking '
      + 'change,\ndrop the version from compat/config.js -- the promise to it '
      + 'is ending.\n'
    )
    return 1
  }

  return 0
}

/* istanbul ignore next */
if (require.main === module) {
  process.exitCode = main(process.argv.slice(2))
}

module.exports = {main}
