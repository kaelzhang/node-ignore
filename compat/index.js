#!/usr/bin/env node

// The compatibility gate.
//
//   node compat                 check the working tree against the promise
//   node compat --against <ref> ad-hoc: diff against any tag or ref
//   node compat --win32         compare with Windows path handling switched on
//   node compat --list          print every difference, claimed or not
//
// The library is depended on by millions of projects, so its contract is
//   whatever its releases observably do -- not what its tests assert. The
//   promise is stated, explicitly, in `compat/declarations.js`:
//
//     compat: '7.0.7'
//
// names the release the working tree stays behaviour-compatible with, and
//   the gate holds every commit to it by loading that release's `index.js`
//   out of git and comparing the two over the corpus in `compat/corpus.js`:
//   every public method, the errors invalid input must keep throwing, the
//   module surface, and the type declarations.
//
// Where `compat` stands relative to the latest tag is what the gate reads
//   as intent:
//
// - `compat` IS the latest tag: steady state. The tree must behave exactly
//     like that release. Changing behaviour -- fixing a bug changes
//     behaviour too -- starts with raising `compat` to the version that
//     will ship the change, in the same reviewed commit.
// - `compat` is AHEAD of the latest tag: that version is being prepared.
//     The gate still diffs against the latest release, because that is what
//     dependents run today, but a difference may now be claimed by a
//     declaration stamped with the version being prepared. Unclaimed
//     differences still fail: an accident does not become intentional by
//     happening near a declared change.
// - `compat` is BEHIND the latest tag: a release happened that the promise
//     never covered. The gate fails until the file catches up.
//
// Publishing is what closes the loop: tagging the prepared version turns
//   "ahead" into "steady" by itself, and every declaration stamped with a
//   now-released version goes dead -- kept or deleted, it can never excuse
//   a future difference.
//
// Exit codes: 0 the promise holds, 1 it does not (or the declarations file
//   contradicts itself), 2 the gate could not run (no tags reachable, say).

const fs = require('fs')
const os = require('os')
const path = require('path')
const {execFileSync} = require('child_process')

const {compare} = require('./compare')
const declarations = require('./declarations')

const ROOT = path.join(__dirname, '..')

const git = args => execFileSync('git', args, {
  cwd: ROOT,
  maxBuffer: 1 << 26
}).toString()

const latestTag = () => git(['describe', '--tags', '--abbrev=0']).trim()

const fileAt = (ref, file) => git(['show', `${ref}:${file}`])

const loadBuild = ref => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ignore-compat-'))
  const file = path.join(dir, 'baseline.js')

  fs.writeFileSync(file, fileAt(ref, 'index.js'))

  return require(file)
}

const REGEX_VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/

const parseVersion = version => {
  const matched = REGEX_VERSION.exec(version)

  return matched && matched.slice(1).map(Number)
}

const compareVersions = (a, b) =>
  a[0] - b[0]
  || a[1] - b[1]
  || a[2] - b[2]

const printDifference = (difference, index) => {
  const lines = [`  ${index + 1}. [${difference.kind}]`]

  if (difference.kind === 'behaviour' || difference.kind === 'error-behaviour') {
    lines.push(
      `     ${difference.method}(${JSON.stringify(difference.path)})`
      + ` with ${JSON.stringify(difference.patterns)}${
        difference.options && difference.options !== 'default'
          ? ` [${difference.options}]`
          : ''}`,
      `     was: ${difference.was}`,
      `     is:  ${difference.is}`
    )
  } else {
    lines.push(`     was: ${difference.was}`, `     is:  ${difference.is}`)
  }

  return lines.join('\n')
}

// Sort the declarations into what the promise makes of them: dead ones that
//   shipped with a release the latest tag already covers, live ones stamped
//   with the version being prepared, and contradictions.
//
// @returns {{error} | {active, shipped, preparing}}
const readDeclarations = latest => {
  const declared = declarations.compat
  const declaredVersion = parseVersion(declared)

  if (!declaredVersion) {
    return {
      error: `compat/declarations.js: \`compat\` is "${declared}", `
        + 'which is not an <major>.<minor>.<patch> version.\n'
    }
  }

  const latestVersion = parseVersion(latest)
  const standing = compareVersions(declaredVersion, latestVersion)

  if (standing < 0) {
    return {
      error: `compat/declarations.js promises compatibility with "${declared}", `
        + `but "${latest}" has been released.\n`
        + 'A release the promise never covered has shipped. If it was '
        + `intended, set \`compat\` to "${latest}" -- \`node compat/reset\` `
        + 'does exactly that -- and review what it changed.\n'
    }
  }

  const active = []
  const shipped = []

  const {changes} = declarations

  for (let i = 0; i < changes.length; i ++) {
    const change = changes[i]
    const version = parseVersion(change.version)

    if (!version) {
      return {
        error: 'compat/declarations.js: a declaration ships in '
          + `"${change.version}", which is not a version: "${change.reason}"\n`
      }
    }

    if (compareVersions(version, latestVersion) <= 0) {
      // Shipped with a release the latest tag covers: dead, whatever it
      //   claims to claim.
      shipped.push(change)
    } else if (change.version === declared) {
      active.push(change)
    } else {
      return {
        error: `compat/declarations.js: a declaration ships in `
          + `"${change.version}", but \`compat\` prepares "${declared}": `
          + `"${change.reason}"\n`
          + 'One of the two is wrong -- a change is declared for the version '
          + 'that `compat` says is being prepared.\n'
      }
    }
  }

  return {
    active,
    shipped,
    preparing: standing > 0
  }
}

const main = argv => {
  const list = argv.indexOf('--list') >= 0
  const againstAt = argv.indexOf('--against')

  const adHoc = againstAt >= 0
  let against = adHoc
    ? argv[againstAt + 1]
    : null

  if (adHoc && !against) {
    process.stderr.write('--against needs a ref\n')
    return 2
  }

  if (!against) {
    try {
      against = latestTag()
    } catch (error) {
      process.stderr.write(
        'cannot resolve the latest tag -- the gate needs the full history\n'
        + '(in CI, check out with fetch-depth: 0)\n'
      )
      return 2
    }

    if (!parseVersion(against)) {
      process.stderr.write(
        `the latest tag is "${against}", which is not a version `
        + 'this gate can reason about\n'
      )
      return 2
    }
  }

  // In ad-hoc mode the ref is whatever the caller wants to look at, and the
  //   promise machinery stays out of the way: no claims, plain differences.
  const read = adHoc
    ? {active: [], shipped: [], preparing: false}
    : readDeclarations(against)

  if (read.error) {
    process.stderr.write(read.error)
    return 1
  }

  const {active, shipped, preparing} = read

  const baseline = loadBuild(against)
  const candidate = require(path.join(ROOT, 'index.js'))

  // Windows path handling rewrites separators and widens the relative-path
  //   check. It is switched on per module instance, so flipping it on both
  //   builds compares that half of the behaviour too. The environment
  //   variable the test suite uses does not reach `index.js` itself.
  if (argv.indexOf('--win32') >= 0) {
    baseline[Symbol.for('setupWindows')]()
    candidate[Symbol.for('setupWindows')]()
  }

  const types = {
    was: fileAt(against, 'index.d.ts'),
    is: fs.readFileSync(path.join(ROOT, 'index.d.ts')).toString()
  }

  // Every difference is judged as it is found -- all forty thousand of a
  //   systematic change, not a sample. Only what gets *printed* is capped.
  const KEEP = 200
  const claimCounts = active.map(() => 0)
  const undeclaredSamples = []
  const claimedSamples = []
  let claimed = 0
  let undeclared = 0

  const judge = difference => {
    const at = active.findIndex(
      declaration => declaration.claims(difference)
    )

    if (at < 0) {
      undeclared ++

      if (undeclaredSamples.length < KEEP) {
        undeclaredSamples.push(difference)
      }

      return
    }

    claimed ++
    claimCounts[at] ++

    if (claimedSamples.length < KEEP) {
      claimedSamples.push({difference, at})
    }
  }

  const {checks} = compare(baseline, candidate, {types}, judge)

  process.stdout.write(
    `compat: working tree vs ${against}${
      adHoc
        ? ''
        : preparing
          ? `, preparing ${declarations.compat}`
          : ' -- the declared compatible version'
    }\n`
    + `  ${checks} checks, ${claimed + undeclared} differences`
    + ` (${claimed} claimed by declarations, ${undeclared} undeclared)\n`
  )

  active.forEach((declaration, at) => {
    process.stdout.write(
      `  declared for ${declaration.version}: ${declaration.reason}`
      + ` -- claims ${claimCounts[at]}\n`
    )
  })

  if (list) {
    claimedSamples.forEach(({difference, at}, index) => {
      process.stdout.write(
        `${printDifference(difference, index)}\n`
        + `     claimed: ${active[at].reason}\n`
      )
    })
  }

  if (undeclared) {
    process.stdout.write(
      `\nUndeclared behaviour changes against ${against}:\n\n${
        undeclaredSamples.slice(0, 20).map(printDifference).join('\n')
      }${undeclared > 20
        ? `\n  ... and ${undeclared - 20} more\n`
        : '\n'
      }\n${
        preparing || adHoc
          ? 'If these are intended, declare them in compat/declarations.js, '
            + `stamped for "${declarations.compat}" --\n`
            + 'a reviewed record of what that release changes for its '
            + 'dependents.\n'
          : `The working tree no longer behaves like "${against}", which `
            + 'compat/declarations.js promises.\nIf these changes are '
            + 'intended, raise `compat` to the version that will ship them '
            + 'and declare each one.\n'
      }If they are not, they are regressions.\n`
    )
    return 1
  }

  // A declaration claiming nothing deserves a look -- it may be stale, or
  //   the corpus may be missing the case it covers -- but it is not a
  //   failure.
  active.forEach((declaration, at) => {
    if (!claimCounts[at]) {
      process.stdout.write(
        `note: declaration claims nothing in the corpus: "${declaration.reason}"\n`
      )
    }
  })

  shipped.forEach(declaration => {
    process.stdout.write(
      `note: shipped with ${declaration.version}, safe to delete: `
      + `"${declaration.reason}"\n`
    )
  })

  return 0
}

/* istanbul ignore next */
if (require.main === module) {
  process.exitCode = main(process.argv.slice(2))
}

module.exports = {main}
