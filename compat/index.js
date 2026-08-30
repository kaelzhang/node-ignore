#!/usr/bin/env node

// The compatibility gate.
//
//   node compat                 compare the working tree against the latest tag
//   node compat --against 7.0.6 compare against a specific tag or ref
//   node compat --win32         compare with Windows path handling switched on
//   node compat --list          print every difference, claimed or not
//
// The library is depended on by millions of projects, so its contract is
//   whatever the latest release observably does -- not what its tests assert.
// This gate loads `index.js` from the latest git tag, the build dependents
//   actually run, and compares it with the working tree over the corpus in
//   `compat/corpus.js`: every public method, the errors invalid input must
//   keep throwing, the module surface, and the type declarations.
//
// A difference is not necessarily wrong -- fixing a bug changes behaviour
//   too. It is *undeclared* difference that fails the gate: each one must be
//   claimed by an entry in `compat/declarations.js`, which is the explicit,
//   reviewed act of saying "this release intends to change this".
//
// Exit codes: 0 compatible (or every difference declared), 1 undeclared
//   differences or a stale declarations file, 2 the gate itself could not
//   run (no tags reachable, say).

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

const main = argv => {
  const list = argv.indexOf('--list') >= 0
  const againstAt = argv.indexOf('--against')

  let against = againstAt >= 0
    ? argv[againstAt + 1]
    : null

  if (againstAt >= 0 && !against) {
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
  }

  // A declarations file diverging from a tag that is no longer the latest
  //   has shipped: its changes are part of the new release, and keeping them
  //   would let them silently claim future, unrelated differences.
  if (againstAt < 0 && declarations.baseline !== against) {
    process.stderr.write(
      `compat/declarations.js declares changes against "${declarations.baseline}", `
      + `but the latest tag is "${against}".\n`
      + 'The declared changes have shipped. Run `node compat/reset` to set '
      + `the baseline to "${against}" and empty the claims.\n`
    )
    return 1
  }

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
  const claimCounts = declarations.changes.map(() => 0)
  const undeclaredSamples = []
  const claimedSamples = []
  let claimed = 0
  let undeclared = 0

  const judge = difference => {
    const at = declarations.changes.findIndex(
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
    `compat: working tree vs ${against}\n`
    + `  ${checks} checks, ${claimed + undeclared} differences`
    + ` (${claimed} claimed by declarations, ${undeclared} undeclared)\n`
  )

  declarations.changes.forEach((declaration, at) => {
    process.stdout.write(
      `  declared: ${declaration.reason} -- claims ${claimCounts[at]}\n`
    )
  })

  if (list) {
    claimedSamples.forEach(({difference, at}, index) => {
      process.stdout.write(
        `${printDifference(difference, index)}\n`
        + `     claimed: ${declarations.changes[at].reason}\n`
      )
    })
  }

  if (undeclared) {
    process.stdout.write(
      `\nUndeclared behaviour changes against the latest release:\n\n${
        undeclaredSamples.slice(0, 20).map(printDifference).join('\n')
      }${undeclared > 20
        ? `\n  ... and ${undeclared - 20} more\n`
        : '\n'
      }\nIf these are intended, declare them in compat/declarations.js --\n`
      + 'a reviewed record of what this release changes for its dependents.\n'
      + 'If they are not, they are regressions.\n'
    )
    return 1
  }

  // A declaration claiming nothing deserves a look -- it may be stale, or
  //   the corpus may be missing the case it covers -- but it is not a
  //   failure.
  declarations.changes.forEach((declaration, at) => {
    if (!claimCounts[at]) {
      process.stdout.write(
        `note: declaration claims nothing in the corpus: "${declaration.reason}"\n`
      )
    }
  })

  return 0
}

/* istanbul ignore next */
if (require.main === module) {
  process.exitCode = main(process.argv.slice(2))
}

module.exports = {main}
