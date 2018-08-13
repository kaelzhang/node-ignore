const {test} = require('tap')
const ignore = require('..')

const {isPathValid} = ignore

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
  t.deepEqual(
    [
      '.',
      './foo',
      '../foo',
      '/foo',
      false,
      'foo'
    ].filter(isPathValid),
    [
      'foo'
    ]
  )

  t.end()
})
