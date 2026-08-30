#!/usr/bin/env node

// Rewrite compat/declarations.js to a clean steady state.
//
//   node compat/reset            compat = the latest tag, no declarations
//   node compat/reset 7.0.8      compat = the given version, no declarations
//
// Nothing requires running this after a release: tagging the prepared
//   version is what settles the promise, and shipped declarations go dead by
//   themselves. This exists for the two moments the gate points at it --
//   catching the promise up after a release it never covered, and sweeping
//   out declarations that have shipped.

const fs = require('fs')
const path = require('path')
const {execFileSync} = require('child_process')

const ROOT = path.join(__dirname, '..')
const DECLARATIONS = path.join(__dirname, 'declarations.js')

const TEMPLATE = compat => `// The compatibility promise, and the changes on their way to breaking it
//   on purpose.
//
// \`compat\` names the release this working tree stays behaviour-compatible
//   with. The gate (\`node compat\`) holds every commit to that promise by
//   comparing the tree against the latest release, and where \`compat\`
//   stands relative to that release is what the gate reads as intent:
//
//   - \`compat\` IS the latest release: nothing may change, at all.
//   - \`compat\` is AHEAD of it: that version is being prepared, and each
//     difference must be claimed by a declaration below stamped with it.
//   - \`compat\` is BEHIND it: a release the promise never covered has
//     shipped, and the gate fails until this file catches up.
//
// So changing what dependents see -- a breaking change, or a bug fix that
//   alters behaviour -- starts here, in a reviewed commit: raise \`compat\`
//   to the version that will ship the change, and declare it:
//
//   {
//     version: '${compat}'  the release this change ships with
//     reason:  one sentence a dependent could read in release notes
//     refs:    the pull requests, issues or commits that decided it
//     claims:  difference => boolean -- whether this declaration accounts
//              for the difference; see compat/compare.js for its shape
//   }
//
// A claim should be as narrow as the change: one that claims everything
//   would turn the gate off while leaving it green. Tagging the prepared
//   version ends the cycle -- every declaration stamped with a version the
//   latest release now covers is dead, kept or deleted, and can never
//   excuse a future difference.

module.exports = {
  compat: '${compat}',

  changes: []
}
`

const main = argv => {
  const compat = argv[0] || execFileSync(
    'git',
    ['describe', '--tags', '--abbrev=0'],
    {cwd: ROOT}
  )
  .toString()
  .trim()

  fs.writeFileSync(DECLARATIONS, TEMPLATE(compat))

  process.stdout.write(
    `compat/declarations.js reset: compatible with "${compat}", `
    + 'no pending declarations\n'
  )

  return 0
}

/* istanbul ignore next */
if (require.main === module) {
  process.exitCode = main(process.argv.slice(2))
}

module.exports = {main, TEMPLATE}
