#!/usr/bin/env node

// Reset compat/declarations.js after a release.
//
//   node compat/reset            baseline = the latest tag
//   node compat/reset 7.0.7      baseline = the given tag
//
// Publishing a release moves the latest tag, which makes the declared
//   changes part of it: they are no longer pending, they have shipped. The
//   compatibility gate then refuses to run until this file is reset, and
//   this script is that reset -- baseline bumped to the new tag, claims
//   emptied, ready for the next release cycle.

const fs = require('fs')
const path = require('path')
const {execFileSync} = require('child_process')

const ROOT = path.join(__dirname, '..')
const DECLARATIONS = path.join(__dirname, 'declarations.js')

const TEMPLATE = baseline => `// Intentional behaviour changes since the latest release.
//
// The compatibility gate (\`node compat\`) compares the working tree against
//   the latest tag, and every observable difference must be claimed by a
//   declaration below, or the gate fails. This file is the explicit act that
//   failure asks for: changing behaviour for the library's dependents means
//   writing down, in a reviewed commit, what changes and why.
//
// A declaration is:
//
//   {
//     reason: one sentence a dependent could read in release notes
//     refs:   the pull requests, issues or commits that decided it
//     claims: difference => boolean -- whether this declaration accounts
//             for the difference; see compat/compare.js for its shape
//   }
//
// A claim should be as narrow as the change: one that claims everything
//   would turn the gate off while leaving it green.
//
// \`baseline\` names the tag these declarations diverge from. Publishing a
//   release moves the latest tag, and the gate then requires this file to
//   be reset -- which is what \`node compat/reset\` does -- so declarations
//   never outlive the release that ships them.

module.exports = {
  baseline: '${baseline}',

  changes: []
}
`

const main = argv => {
  const baseline = argv[0] || execFileSync(
    'git',
    ['describe', '--tags', '--abbrev=0'],
    {cwd: ROOT}
  )
  .toString()
  .trim()

  fs.writeFileSync(DECLARATIONS, TEMPLATE(baseline))

  process.stdout.write(
    `compat/declarations.js reset: baseline "${baseline}", no pending changes\n`
  )

  return 0
}

/* istanbul ignore next */
if (require.main === module) {
  process.exitCode = main(process.argv.slice(2))
}

module.exports = {main, TEMPLATE}
