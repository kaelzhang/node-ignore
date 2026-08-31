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
  aa._rules = {
    _rules: a._rules._rules.slice()
  }
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
    // Description
    'test: no rule',
    // patterns
    null,
    // path
    'foo',
    // ignored, unignored
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

if (!SHOULD_TEST_WINDOWS) {
  IGNORE_TEST_CASES.push([
    `test: file which named '...'`,
    null,
    '...',
    [false, false]
  ])
}

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

// A bracket expression is held aside behind a NUL placeholder while the
// pattern is compiled, so a NUL written in the pattern itself must not be
// mistaken for one of those placeholders
_test('a literal NUL is not a bracket placeholder', t => {
  const ig = ignore().add('a\u00000\u0000[bc]')

  t.equal(ig.ignores('a\u00000\u0000b'), true)
  t.equal(ig.ignores('a\u00000\u0000c'), true)
  t.equal(ig.ignores('a\u00000\u0000d'), false)
  t.equal(ig.ignores('[bc]'), false)

  t.end()
})

// A POSIX class name is looked up in a table rather than branched on, so a
// wrong expansion is invisible to a coverage report. `[[:cntrl:]]` is the one
// class that can not go through test/fixtures/cases.js: `git check-ignore`
// C-quotes a control character in its output ('"x\001y"'), which the fixture
// oracle does not unquote, so the case would fail there for the wrong reason.
// Every expectation below is what `git check-ignore` answers.
_test('[[:cntrl:]] expands to the control characters', t => {
  const ig = ignore().add('x[[:cntrl:]]y')

  t.equal(ig.ignores('x\u0001y'), true)
  t.equal(ig.ignores('x\u001fy'), true)
  t.equal(ig.ignores('x\u007fy'), true)
  t.equal(ig.ignores('x y'), false)
  t.equal(ig.ignores('xay'), false)

  const neg = ignore().add('x[![:cntrl:]]y')

  t.equal(neg.ignores('xay'), true)
  t.equal(neg.ignores('x\u0001y'), false)

  t.end()
})

// A path is normally its own prefix, so the walk up to the root cuts each
// parent out of it. Two accepted shapes break that: an empty segment in the
// middle ('a//b', whose parent is 'a/', not 'a//'), and a leading separator,
// which reaches the walk because `checkIgnore` does not put the path it is
// given through the relative-path check. Both fall back to taking the path
// apart, and neither has a fixture because `git check-ignore` will not take
// them as arguments.
_test('a path with an empty segment walks to the right parent', t => {
  t.equal(ignore().add('a').ignores('a//b'), true)
  t.equal(ignore().add('a/').ignores('a//b'), true)
  t.equal(ignore().add('b').ignores('a//b'), true)

  // 'a/' is ignored, so nothing under it can be brought back
  t.equal(ignore().add(['a', '!a/b']).ignores('a//b'), true)

  t.end()
})

_test('checkIgnore() takes a path a walk cannot cut up', t => {
  // A lone separator has no parent, and asking for one used to hand back
  //   itself -- `lastIndexOf` searches from 0 rather than reporting no match
  //   when it is given a negative place to start, and the walk never ended.
  t.equal(ignore().add('a').checkIgnore('/').ignored, false)
  t.equal(ignore().add('*').checkIgnore('/').ignored, true)

  t.equal(ignore().add('a').checkIgnore('/a/').ignored, true)
  t.equal(ignore().add('a').checkIgnore('a//b/').ignored, true)

  t.end()
})

_test('options.allowRelativePaths = true', t => {
  const ig = ignore({
    allowRelativePaths: true
  })

  ig.add('foo')

  t.equal(ig.ignores('../foo/bar.js'), true)

  t.throws(() => ignore().ignores('../foo/bar.js'))

  t.end()
})

_test('options.allowRelativePaths = false (default value)', t => {
  const ig = ignore()

  ig.add('foo')

  t.throws(() => ig.ignores('../foo/bar.js'), 'path.relative')
  t.throws(() => ig.ignores('/foo/bar.js'), 'path.relative')

  t.end()
})

// A pattern can hold many wildcards in one segment, and matching a path that
// never satisfies it should still take time in proportion to the path, not to
// the number of wildcards. The budget sits far above a linear match and far
// below the alternative, so only a real change in that proportion trips it.
_test('a wildcard-heavy pattern matches in linear time', t => {
  const ig = ignore().add(`${'*a'.repeat(12)}b`)

  const started = process.hrtime.bigint()
  const ignored = ig.ignores('a'.repeat(64))
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6

  t.equal(ignored, false)
  t.ok(elapsedMs < 500, `matched in ${elapsedMs.toFixed(1)}ms`)

  t.end()
})
