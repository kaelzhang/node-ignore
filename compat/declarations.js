// The compatibility promise, and the changes on their way to breaking it
//   on purpose.
//
// `compat` names the release this working tree stays behaviour-compatible
//   with. The gate (`node compat`) holds every commit to that promise by
//   comparing the tree against the latest release, and where `compat`
//   stands relative to that release is what the gate reads as intent:
//
//   - `compat` IS the latest release: nothing may change, at all.
//   - `compat` is AHEAD of it: that version is being prepared, and each
//     difference must be claimed by a declaration below stamped with it.
//   - `compat` is BEHIND it: a release the promise never covered has
//     shipped, and the gate fails until this file catches up.
//
// So changing what dependents see -- a breaking change, or a bug fix that
//   alters behaviour -- starts here, in a reviewed commit: raise `compat`
//   to the version that will ship the change, and declare it:
//
//   {
//     version: '7.0.8'  the release this change ships with
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

// A backslash the escaper of the previous release left with a special
//   meaning in the compiled regular expression: a word character (`\d`,
//   `\b`, `\1`), a slash (`\/`), or a question mark (`\?`). A trailing
//   literal star (`\*`) is the other half of the same change and is matched
//   on its own.
const REGEX_MISREAD_ESCAPE = /\\[\w?/]/
const REGEX_TRAILING_LITERAL_STAR = /(^|[^\\])(\\\\)*\\\*$/

// Whitespace other than a plain space -- a tab, most often -- which the
//   previous release trimmed or treated as blank along with spaces.
const REGEX_NON_SPACE_BLANK = /[^\S ]/

module.exports = {
  compat: '7.0.8',

  changes: [
    {
      version: '7.0.8',
      reason: 'a backslash makes the next character a literal, exactly as '
        + 'git does, so `\\?` is a literal question mark rather than a '
        + 'wildcard, a trailing `\\*` is a literal star, and `\\d`, `\\b`, '
        + '`\\1`, `\\/` are the plain characters rather than regular-'
        + 'expression escapes',
      refs: ['git-compatibility audit'],
      claims: difference => difference.kind === 'behaviour'
        && difference.patterns.some(pattern =>
          REGEX_MISREAD_ESCAPE.test(pattern)
          || REGEX_TRAILING_LITERAL_STAR.test(pattern)
        )
    },

    {
      version: '7.0.8',
      reason: 'only a trailing run of spaces is trimmed from a pattern, never '
        + 'a tab or other whitespace, and a line of only such whitespace is a '
        + 'pattern rather than a blank line -- matching git, which trims '
        + 'spaces alone',
      refs: ['git-compatibility audit'],
      claims: difference => difference.kind === 'behaviour'
        && difference.patterns.some(pattern => REGEX_NON_SPACE_BLANK.test(pattern))
    }
  ]
}
