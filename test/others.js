const {test} = require('tap')
const ignore = require('..')

const {isPathValid} = ignore

const IS_WINDOWS = process.platform === 'win32'
const SHOULD_TEST_WINDOWS = process.env.IGNORE_TEST_WIN32
  || IS_WINDOWS

test('.add(<Ignore>)', t => {
  const a = ignore().add(['.abc/*', '!.abc/d/'])
  const b = ignore().add(a).add('!.abc/e/')

  const paths = [
    '.abc/a.js',    // filtered out
    '.abc/d/e.js',  // included
    '.abc/e/e.js'   // included by b, filtered out by a
  ]

  t.deepEqual(a.filter(paths), ['.abc/d/e.js'])
  t.deepEqual(b.filter(paths), ['.abc/d/e.js', '.abc/e/e.js'])
  t.end()
})

test('fixes babel class', t => {
  const {constructor} = ignore()

  try {
    constructor()
  } catch (e) {
    t.end()
    return
  }

  t.is('there should be an error', 'no error found')
  t.end()
})

test('#32', t => {
  const KEY_IGNORE = typeof Symbol !== 'undefined'
    ? Symbol.for('node-ignore')
    : 'node-ignore'

  const a = ignore().add(['.abc/*', '!.abc/d/'])

  // aa is actually not an IgnoreBase instance
  const aa = {}

  /* eslint no-underscore-dangle: ["off"] */
  aa._rules = a._rules.slice()
  aa[KEY_IGNORE] = true

  const b = ignore().add(aa).add('!.abc/e/')

  const paths = [
    '.abc/a.js',    // filtered out
    '.abc/d/e.js',  // included
    '.abc/e/e.js'   // included by b, filtered out by a
  ]

  t.deepEqual(a.filter(paths), ['.abc/d/e.js'])
  t.deepEqual(b.filter(paths), ['.abc/d/e.js', '.abc/e/e.js'])
  t.end()
})

test('options.ignorecase', t => {
  const ig = ignore({
    ignorecase: false
  })

  ig.add('*.[jJ][pP]g')

  t.is(ig.ignores('a.jpg'), true)
  t.is(ig.ignores('a.JPg'), true)
  t.is(ig.ignores('a.JPG'), false)
  t.end()
})

test('special case: invalid paths, throw', t => {
  const ig = ignore()

  const emptyMessage = 'path must be a string, but got ""'

  t.throws(() => ig.ignores(''), emptyMessage)

  t.throws(
    () => ig.ignores(false),
    'path must be a string, but got `false`'
  )

  t.throws(
    () => ig.ignores('/a'),
    'path must be `path.relative()`d, but got "/a"'
  )

  t.throws(() => ig.filter(['']), emptyMessage)

  t.throws(() => [''].filter(ig.createFilter()), emptyMessage)

  t.end()
})

test('isPathValid', t => {
  const paths = [
    '.',
    './foo',
    '../foo',
    '/foo',
    false,
    'foo'
  ]

  if (SHOULD_TEST_WINDOWS) {
    paths.push(
      '..\\foo',
      '.\\foo',
      '\\foo',
      '\\\\foo'
    )
  }

  t.deepEqual(
    paths.filter(isPathValid),
    [
      'foo'
    ]
  )

  t.end()
})

const IGNORE_TEST_CASES = [
  [
    'test: no rule',
    null,
    'foo',
    [false, false]
  ],
  [
    'test: has rule, no match',
    'bar',
    'foo',
    [false, false]
  ],
  [
    'test: only negative',
    '!foo',
    'foo',
    [false, true]
  ],
  [
    'test: ignored then unignored',
    ['foo', '!foo'],
    'foo',
    [false, true]
  ],
  [
    'test: dir ignored then unignored -> not matched',
    ['foo', '!foo'],
    'foo/bar',
    [false, false]
  ],
  [
    'test: ignored by wildcard, then unignored',
    ['*.js', '!a/a.js'],
    'a/a.js',
    [false, true]
  ]
]

IGNORE_TEST_CASES.forEach(([d, patterns, path, [ignored, unignored]]) => {
  test(d, t => {
    const ig = ignore()
    if (patterns) {
      ig.add(patterns)
    }

    t.deepEqual(ig.test(path), {
      ignored, unignored
    })

    t.end()
  })
})
