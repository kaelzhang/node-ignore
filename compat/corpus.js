// The behavioural corpus: what gets compared between two builds of the
//   library. Everything here is deterministic and self-contained -- no
//   dependencies, no randomness -- so that two runs can only differ if the
//   two builds do.
//
// The pattern sets lean deliberately on the dark corners: bracket
//   expressions, globstars, negation and re-inclusion, escapes, trailing
//   spaces and slashes, character ranges -- because that is where a change
//   breaks a dependent without failing an ordinary test.

const PATTERN_SETS = [
  // plain literals and anchoring
  ['a'],
  ['a/'],
  ['/a'],
  ['/a/'],
  ['a/b'],
  ['a/b/'],
  ['node_modules/'],
  ['.env'],
  ['a b/'],
  ['#comment', 'a'],
  ['\\#literal'],
  ['\\!important'],

  // wildcards
  ['*'],
  ['*.log'],
  ['*.py[cod]'],
  ['foo/*'],
  ['foo/*/bar'],
  ['?/b'],
  ['a?c'],
  ['\\*'],
  ['a\\*b'],

  // globstars, every position
  ['**/foo'],
  ['**/**/foo'],
  ['foo/**'],
  ['foo/**/'],
  ['/foo/**/'],
  ['foo/**/**/'],
  ['a/**/b'],
  ['**/node_modules/**'],
  ['a/**'],

  // negation and re-inclusion
  ['*', '!a'],
  ['*', '!a/'],
  ['*', '!a/', 'a/b'],
  ['a/', '!a/b'],
  ['a', '!a/b', 'a/b/c'],
  ['dist', '!dist/keep.txt'],
  ['a/**/*.js', '!a/keep/**'],
  ['.a/', '!.a/b'],
  ['!a'],

  // bracket expressions, the wildmatch sub-grammar
  ['[abc].js'],
  ['[a-c].js'],
  ['[!a]/b'],
  ['[^a]/b'],
  ['x[!y]z'],
  ['*.[oa]'],
  ['[[:digit:]].log'],
  ['x[![:digit:]]y'],
  ['[[:alnum:]_].o'],
  ['*.[]]'],
  ['*.[!]]'],
  ['*.[\\]]'],
  ['x[\\^]y'],
  ['n[a\\-c]m'],
  ['*.[*]'],
  ['x[?]y'],
  ['*.[[]'],
  ['[a-'],
  ['*.[a-\\c]'],
  ['[c-a]'],
  ['[[:foo:]]'],
  ['*.[[:alpha:'],
  ['[!]'],
  ['a[.-0]c'],
  ['lit[/]x'],

  // escapes and trailing whitespace
  ['a\\ b'],
  ['a \\  '],
  ['abc\\  '],
  ['src/\\[foo\\]'],
  ['src/\\[bar]'],
  ['\\?'],
  ['a\\?b'],
  ['\\d'],
  ['e\\bf'],
  ['\\1x'],
  ['g\\/h'],
  ['a\\/b'],
  ['a\t'],
  ['b '],
  ['\t'],
  ['a\tb'],

  // combinations a real .gitignore accumulates
  [
    'logs', '*.log', 'npm-debug.log*', 'pids', '*.pid', 'coverage',
    '.nyc_output', 'node_modules/', '*.tsbuildinfo', '.npm', '.eslintcache',
    '.env', 'dist', '.cache', '!.env.example'
  ],
  [
    'packages/*/dist', 'packages/*/*.tmp', '**/__snapshots__/',
    '!packages/core/dist', 'apps/**/build'
  ]
]

// Path segments the sets above care about, combined systematically below.
const SEGMENTS = [
  'a', 'b', 'c', 'x', 'z', 'foo', 'bar', 'dist', 'node_modules', 'keep',
  'keep.txt', 'a.log', 'b.js', 'x.o', 'a.py', 'a.pyc', '1.log', '5',
  '.a', '.env', '.env.example', 'a b', 'a  ', '!a', '#comment', '*',
  '?', '[abc]', ']', '[', '^', 'core', 'build', '__snapshots__'
]

const buildPaths = () => {
  const paths = new Set()

  SEGMENTS.forEach(one => {
    paths.add(one)
    paths.add(`${one}/`)

    SEGMENTS.forEach(two => {
      paths.add(`${one}/${two}`)
      paths.add(`${one}/${two}/`)
    })
  })

  // three levels deep, for the re-inclusion sets
  const THREE = ['a', 'b', 'c', 'dist', 'keep', 'packages', 'core', 'apps']

  THREE.forEach(one => {
    THREE.forEach(two => {
      THREE.forEach(three => {
        paths.add(`${one}/${two}/${three}`)
        paths.add(`${one}/${two}/${three}/`)
      })
    })
  })

  // deep nesting, and the shapes that are accepted but not prefix-clean
  const EXTRA = [
    'a/b/c/d/e/f/g/h/i/j/k.js',
    'packages/core/dist/index.js',
    'packages/x/dist/index.js',
    'apps/web/build/main.js',
    'a//b',
    'a///b',
    'a/./b',
    'a/../b',
    'a//',
    'x/y/a  ',
    'src/[foo]',
    'src/[bar]',

    // discriminators for the escape and whitespace escapes above
    'a?b',
    'axb',
    'd',
    'g/h',
    'ebf',
    '1x',
    'a\t',
    'a\tb',
    'a ',
    '\t',

    // On POSIX a backslash is an ordinary filename character; with the
    //   Windows setup these are the paths that get their separators
    //   converted. Either way both builds must read them alike.
    'a\\b',
    'a\\b\\c.js',
    'C:/x/a.log',
    'c:/x/a.log'
  ]

  EXTRA.forEach(path => paths.add(path))

  return [...paths]
}

const PATHS = buildPaths()

// Inputs that must keep throwing (or keep not throwing) exactly as before.
const INVALID_INPUTS = [
  '',
  '.',
  '..',
  './',
  '../',
  './a',
  '../a',
  '/absolute',
  null,
  undefined,
  0,
  false,
  {}
]

// Option objects the public constructor accepts.
const OPTION_SETS = [
  ['default', undefined],
  ['ignorecase-off', {ignorecase: false}],
  ['ignoreCase-off', {ignoreCase: false}],
  ['allow-relative', {allowRelativePaths: true}]
]

module.exports = {
  PATTERN_SETS,
  PATHS,
  INVALID_INPUTS,
  OPTION_SETS
}
