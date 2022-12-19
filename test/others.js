// - issues
// - options
// - static methods
// - .test()

const {test} = require('tap')
const ignore = require('..')
const {
  checkEnv,
  SHOULD_TEST_WINDOWS
} = require('./fixtures/cases')

const {isPathValid} = ignore

const _test = checkEnv('IGNORE_ONLY_OTHERS')
  ? test
  : () => {}

_test('.add(<Ignore>)', t => {
  const a = ignore().add(['.abc/*', '!.abc/d/'])
  const b = ignore().add(a).add('!.abc/e/')

  const paths = [
    '.abc/a.js',    // filtered out
    '.abc/d/e.js',  // included
    '.abc/e/e.js'   // included by b, filtered out by a
  ]

  t.same(a.filter(paths), ['.abc/d/e.js'])
  t.same(b.filter(paths), ['.abc/d/e.js', '.abc/e/e.js'])
  t.end()
})

_test('fixes babel class', t => {
  const {constructor} = ignore()

  try {
    constructor()
  } catch (e) {
    t.end()
    return
  }

  t.equal('there should be an error', 'no error found')
  t.end()
})

_test('#32', t => {
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

  t.same(a.filter(paths), ['.abc/d/e.js'])
  t.same(b.filter(paths), ['.abc/d/e.js', '.abc/e/e.js'])
  t.end()
})

_test('options.ignorecase', t => {
  const ig = ignore({
    ignorecase: false
  })

  ig.add('*.[jJ][pP]g')

  t.equal(ig.ignores('a.jpg'), true)
  t.equal(ig.ignores('a.JPg'), true)
  t.equal(ig.ignores('a.JPG'), false)
  t.end()
})

_test('special case: internal cache respects ignorecase', t => {
  const rule = '*.[jJ][pP]g'

  const ig = ignore({
    ignorecase: false
  })

  ig.add(rule)

  t.equal(ig.ignores('a.JPG'), false)

  const ig2 = ignore({
    ignorecase: true
  })

  ig2.add(rule)

  t.equal(ig2.ignores('a.JPG'), true)

  t.end()
})

_test('special case: invalid paths, throw', t => {
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

  if (SHOULD_TEST_WINDOWS) {
    t.throws(
      () => ig.ignores('c:\\a'),
      'path must be `path.relative()`d, but got "c:\\a"'
    )

    t.throws(
      () => ig.ignores('C:\\a'),
      'path must be `path.relative()`d, but got "C:\\a"'
    )
  }

  t.throws(() => ig.filter(['']), emptyMessage)

  t.throws(() => [''].filter(ig.createFilter()), emptyMessage)

  t.end()
})

_test('isPathValid', t => {
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
      '\\\\foo',
      'C:\\foo',
      'd:\\foo'
    )
  }

  t.same(
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
  _test(d, t => {
    const ig = ignore()
    if (patterns) {
      ig.add(patterns)
    }

    t.same(ig.test(path), {
      ignored, unignored
    })

    t.end()
  })
})

_test('options.allowRelativePaths', t => {
  const ig = ignore({
    allowRelativePaths: true
  })

  ig.add('foo')

  t.equal(ig.ignores('../foo/bar.js'), true)

  t.throws(() => ignore().ignores('../foo/bar.js'))

  t.end()
})
