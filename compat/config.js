// The released versions this working tree promises to stay compatible with.
//
// `node compat` checks each one the only way a promise of compatibility can
//   honestly be checked: it runs that version's own test suite against the
//   current `index.js`. The tests are the contract -- what a version tested
//   is what it guaranteed -- so passing them means the current code still
//   honours everything that version promised. Behaviour a version never
//   tested was never promised, and changing it is not a break.
//
// To promise compatibility further back, add an older tag. When you
//   deliberately change a behaviour a listed version tested -- a breaking
//   change -- that version's suite will fail against the new code, and you
//   drop it from this list: the promise to it is what you are ending.
//
// The latest tag is always checked, listed here or not, so an accidental
//   break of the release dependents actually run can never slip through.
module.exports = [
  '7.0.6'
]
