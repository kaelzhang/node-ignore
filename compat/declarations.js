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
//   be reset -- baseline bumped, claims emptied -- so declarations never
//   outlive the release that ships them.

// A bracket expression that is real to the pattern grammar: an unescaped
//   `[` opens one.
const REGEX_HAS_BRACKET = /(?:^|[^\\])\[/

module.exports = {
  baseline: '7.0.6',

  changes: [
    {
      reason: 'a trailing "/**/" no longer matches the bare directory or a '
        + 'direct file inside it, matching `git check-ignore` (#164)',
      refs: ['#164'],
      claims: difference => difference.kind === 'behaviour'
        && difference.patterns.some(pattern => pattern.endsWith('/**/'))
    },

    {
      reason: 'bracket expressions follow the wildmatch sub-grammar of real '
        + 'git: POSIX classes, "]" as a first member, escaped members, "*" '
        + 'and "?" as literal members, and no bracket expression matches a '
        + 'slash (#162, #163, and the follow-up slash fix)',
      refs: ['#162', '#163', 'd64793f'],
      claims: difference => difference.kind === 'behaviour'
        && difference.patterns.some(
          pattern => REGEX_HAS_BRACKET.test(pattern)
        )
    }
  ]
}
