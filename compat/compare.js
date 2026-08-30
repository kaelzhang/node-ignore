// Compare two builds of the library over the corpus, and over the public
//   surface, and hand every observable difference to the caller.
//
// "Observable" is judged from a dependent's seat: what the four public
//   methods return (which matched rule included), what invalid input throws,
//   what the module exports, and what the type declarations say. Internals --
//   compiled regular expression sources, private fields -- are deliberately
//   not compared, so a refactor that preserves behaviour passes clean.
//
// Every difference found is reported through `onDifference`, however many
//   there are. Judging each one is the caller's job, and a cap here would
//   let an unjudged difference hide behind a judged flood.

const {
  PATTERN_SETS,
  PATHS,
  INVALID_INPUTS,
  OPTION_SETS
} = require('./corpus')

const METHODS = ['ignores', 'test', 'checkIgnore']

// Everything observable about one call, folded to a string so that two
//   answers are comparable and printable.
const describe = (ig, method, path) => {
  try {
    const answer = ig[method](path)

    if (method === 'ignores') {
      return String(answer)
    }

    return [
      answer.ignored,
      answer.unignored,
      answer.rule
        ? answer.rule.pattern
        : '-'
    ].join('|')
  } catch (error) {
    return `throw:${error.constructor.name}`
  }
}

const filterOutcome = (ignore, patterns, options) => {
  const ig = ignore(options).add(patterns)

  return ig.filter(PATHS.filter(path => {
    try {
      ignore(options).add(patterns).ignores(path)
      return true
    } catch (error) {
      return false
    }
  }))
  .join('\n')
}

const compareBehaviour = (baseline, candidate, counters, emit) => {
  OPTION_SETS.forEach(([optionsName, options]) => {
    PATTERN_SETS.forEach(patterns => {
      METHODS.forEach(method => {
        const before = baseline(options).add(patterns)
        const after = candidate(options).add(patterns)

        PATHS.forEach(path => {
          counters.checks ++

          const was = describe(before, method, path)
          const is = describe(after, method, path)

          if (was !== is) {
            emit({
              kind: 'behaviour',
              options: optionsName,
              method,
              patterns,
              path,
              was,
              is
            })
          }
        })
      })

      // filter() over the whole path list at once
      counters.checks ++

      const was = filterOutcome(baseline, patterns, options)
      const is = filterOutcome(candidate, patterns, options)

      if (was !== is) {
        emit({
          kind: 'behaviour',
          options: optionsName,
          method: 'filter',
          patterns,
          path: '(all)',
          was: '(differs)',
          is: '(differs)'
        })
      }
    })
  })
}

const compareErrors = (baseline, candidate, counters, emit) => {
  const probe = (ignore, input) => {
    try {
      return `ignores:${ignore().add('a').ignores(input)}`
    } catch (error) {
      return `throw:${error.constructor.name}:${error.message}`
    }
  }

  INVALID_INPUTS.forEach(input => {
    counters.checks ++

    const was = probe(baseline, input)
    const is = probe(candidate, input)

    if (was !== is) {
      emit({
        kind: 'error-behaviour',
        method: 'ignores',
        patterns: ['a'],
        path: String(input),
        was,
        is
      })
    }
  })
}

// What the module hands a dependent: exports, instance and prototype
//   members, the shape of a TestResult, the enumerable face of a rule.
const surfaceOf = ignore => {
  const names = object => Object.getOwnPropertyNames(object)
  .concat(Object.getOwnPropertySymbols(object).map(String))
  .sort()

  const instance = ignore()
  const result = ignore().add('a').checkIgnore('a')

  return JSON.stringify({
    module: names(ignore),
    instance: names(instance),
    prototype: names(Object.getPrototypeOf(instance)),
    isPathValid: typeof ignore.isPathValid,
    defaultExport: typeof ignore.default,
    testResult: Object.keys(result).sort(),
    ruleEnumerable: Object.keys(result.rule).sort()
  }, null, 2)
}

const compareSurface = (baseline, candidate, counters, emit) => {
  counters.checks ++

  const was = surfaceOf(baseline)
  const is = surfaceOf(candidate)

  if (was !== is) {
    emit({
      kind: 'surface',
      was,
      is
    })
  }
}

// @param {Function} baseline the build dependents currently run
// @param {Function} candidate the build under review
// @param {{types?: {was, is}}} extras non-runtime artifacts to compare
// @param {Function} onDifference receives every difference found
// @returns {{checks: number}}
const compare = (baseline, candidate, extras, onDifference) => {
  const counters = {checks: 0}

  compareBehaviour(baseline, candidate, counters, onDifference)
  compareErrors(baseline, candidate, counters, onDifference)
  compareSurface(baseline, candidate, counters, onDifference)

  if (extras && extras.types && extras.types.was !== extras.types.is) {
    counters.checks ++

    onDifference({
      kind: 'types',
      was: '(index.d.ts at the baseline tag)',
      is: '(index.d.ts in the working tree)'
    })
  }

  return {
    checks: counters.checks
  }
}

module.exports = {
  compare
}
