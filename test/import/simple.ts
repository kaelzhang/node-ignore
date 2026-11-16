import ignore, {isPathValid} from '../..'
import type {
  Ignore,
  IgnoreRule,
  Options,
  Pattern,
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

// Marked patterns can be supplied as arrays, including readonly mixed inputs
const markedPatterns = ['foo/*', '!foo/keep'].map((pattern, index) => ({
  pattern,
  mark: String(index + 1)
}))
const ig8 = ignore()
const added8: typeof ig8 = ig8.add(markedPatterns)
equal(added8, ig8, 'adding marked patterns returns this')
equal(ig8.checkIgnore('foo/file').rule?.mark, '1', 'array preserves rule marks')
equal(ig8.test('foo/keep').unignored, true, 'array preserves negative patterns')

const readonlyMarkedPatterns: readonly PatternParams[] = markedPatterns
ignore().add(readonlyMarkedPatterns)

const ig9 = ignore().add([
  'first',
  {pattern: 'second', mark: 'second-line'},
  ignore().add('third')
] as const)
equal(ig9.ignores('first'), true, 'mixed array accepts strings')
equal(ig9.test('second').rule?.mark, 'second-line', 'mixed array accepts marks')
equal(ig9.ignores('third'), true, 'mixed array accepts Ignore instances')

// Optional properties accept explicit undefined under exactOptionalPropertyTypes
const conditionalMarks = ['alpha', 'beta'].map((pattern, index) => ({
  pattern,
  mark: index === 0 ? '1' : undefined
}))
const ig10 = ignore({
  ignorecase: undefined,
  ignoreCase: undefined,
  allowRelativePaths: undefined
}).add(conditionalMarks).add({pattern: 'gamma', mark: undefined})
equal(ig10.checkIgnore('alpha').rule?.mark, '1', 'explicit mark preserved')
equal(ig10.checkIgnore('beta').rule?.mark, undefined, 'undefined mark preserved')
equal(ig10.checkIgnore('gamma').rule?.mark, undefined, 'single undefined mark preserved')

const unannotatedRule = ignore().add('plain').checkIgnore('plain').rule
equal(
  unannotatedRule ? 'mark' in unannotatedRule : false,
  true,
  'IgnoreRule always carries an own mark property at runtime'
)
equal(unannotatedRule?.mark, undefined, 'unmarked IgnoreRule.mark is undefined')
equal(
  'rule' in ignore().add('plain').checkIgnore('other'),
  false,
  'TestResult omits rule property when not ignored'
)

interface CustomIgnore extends Ignore {
  readonly customTag: string
}

interface RichPattern extends PatternParams {
  readonly file: string
  readonly line: number
}

// Compile-time boundary and negative type assertions (not invoked at runtime)
function assertTypeBoundaries (custom: CustomIgnore, rich: readonly RichPattern[]) {
  const chained: CustomIgnore = custom.add(markedPatterns)
  const singlePattern: Pattern = {pattern: 'a', mark: '1'}
  const nsPattern: ignore.Pattern = singlePattern
  const nsOptions: Options = {ignorecase: false}
  chained.add(nsPattern).add(rich)
  ignore(nsOptions)

  const maybeRule = ignore().add('foo').checkIgnore('foo').rule
  if (maybeRule && 'mark' in maybeRule) {
    // @ts-expect-error IgnoreRule always has own `mark` property which may be undefined
    maybeRule.mark.toUpperCase()
  }

  // @ts-expect-error number element in pattern array
  ignore().add([123])
  // @ts-expect-error null element in pattern array
  ignore().add([null])
  // @ts-expect-error undefined element in pattern array
  ignore().add([undefined])
  // @ts-expect-error empty object in pattern array
  ignore().add([{}])
  // @ts-expect-error missing pattern property in array element
  ignore().add([{mark: '1'}])
  // @ts-expect-error non-string pattern in array element
  ignore().add([{pattern: 123}])
  // @ts-expect-error non-string mark in array element
  ignore().add([{pattern: 'a', mark: 123}])
  // @ts-expect-error nested pattern arrays are not flattened at runtime
  ignore().add([['nested']])
  // @ts-expect-error unknown excess property on inline object literal in array
  ignore().add([{pattern: 'a', mark: '1', unknownProp: true}])
}
