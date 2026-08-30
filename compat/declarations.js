// Intentional behaviour changes since the latest release.
//
// The compatibility gate (`node compat`) compares the working tree against
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
// `baseline` names the tag these declarations diverge from. Publishing a
//   release moves the latest tag, and the gate then requires this file to
//   be reset -- which is what `node compat/reset` does -- so declarations
//   never outlive the release that ships them.

module.exports = {
  baseline: '7.0.7',

  changes: []
}
