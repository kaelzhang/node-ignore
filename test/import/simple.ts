import ignore, {isPathValid} from '../..'
import type {
  Ignore,
  IgnoreRule,
  PatternParams,
  Pathname,
  TestResult
} from '../..'

const equal = (actual: unknown, expect: unknown, message: string) => {
  if (actual !== expect) {
    throw new Error(`${message}, expect: ${expect}, actual: ${actual}`)
  }
}

const paths = ['a', 'a/b', 'foo/bar']

let ig: Ignore = ignore()

ig = ig.add('*')
ig = ig.add(['!*/', '!foo/bar'])

const filter = ig.createFilter()
paths.filter(filter)
const passed: boolean = filter('a')
equal(passed, false, 'filters a out')

const filtered_paths: Array<string> = ig.filter(paths)
const ignores: boolean = ig.ignores('a')
equal(ignores, true, 'ignores a')

let ig2 = ignore()

ig2 = ig2.add('# test ig.add(Ignore)')
ig2 = ig2.add(ig)

let ig3 = ignore()
ig3 = ig3.add('*.js')

let ig4 = ignore()
ig4 = ig4.add('*.png')

ig2 = ig2.add([ig3, ig4])

const ig5 = ignore({
  ignorecase: false
})

const isValid: boolean = isPathValid('./foo')
equal(isValid, false, './foo is not valid')

// The result types are named, not spelled out, so they stay importable
const result: TestResult = ig4.test('foo')
const {
  ignored,
  unignored
} = result

equal(ignored, false, 'not ignored')
equal(unignored, false, 'not unignored')

// Filter an Readyonly array
const readonlyPaths = ['a', 'a/b', 'foo/bar'] as const
ig.filter(readonlyPaths)

// Add an Readonly array of rules
const ig6 = ignore()
ig6.add([ig3, ig4] as const)

// options.ignoreCase and options.allowRelativePaths
ignore({
  ignoreCase: false,
  allowRelativePaths: true
})

const ig7 = ignore()

const params: PatternParams = {pattern: 'foo/*', mark: '10'}
ig7.add(params)
const {
  ignored: ignored7,
  rule: ignoreRule7
} = ig7.checkIgnore('foo/')

equal(ignored7, true, 'should ignore')
equal(ignoreRule7?.mark, '10', 'mark is 10')
equal(ignoreRule7?.pattern, 'foo/*', 'ignored by foo/*')

const rule7: IgnoreRule | undefined = ignoreRule7
const pathname: Pathname = 'foo/'
equal(rule7?.negative, false, 'not a negative rule')
equal(ig7.checkIgnore(pathname).ignored, true, 'Pathname is a string')
