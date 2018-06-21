// For old node.js versions, we use es5
const ignore = require('../')
const {test} = require('tap')
const cases = require('./fixtures/cases')

const IS_WINDOWS = process.platform === 'win32'
const SHOULD_TEST_WINDOWS = !process.env.IGNORE_TEST_WIN32
  && IS_WINDOWS

const make_win32 = path => path.replace(/\//g, '\\')

cases((
  description,
  patterns,
  paths_object,
  skip_test_test,
  paths,
  expected,
  expect_result
) => {
  test(`.filter():        ${description}`, t => {
    const ig = ignore()
    const result = ig
    .addPattern(patterns)
    .filter(paths)

    expect_result(t, result)
    t.end()
  })

  test(`.createFilter():  ${description}`, t => {
    const result = paths.filter(
      ignore()
      .addPattern(patterns)
      .createFilter(),
      // thisArg should be binded
      null
    )

    expect_result(t, result)
    t.end()
  })

  test(`.ignores(path):   ${description}`, t => {
    const ig = ignore().addPattern(patterns)

    Object.keys(paths_object).forEach(path => {
      t.is(ig.ignores(path), !!paths_object[path])
    })
    t.end()
  })

  if (!SHOULD_TEST_WINDOWS) {
    return
  }

  test(`win32: .filter(): ${description}`, t => {
    const win_paths = paths.map(make_win32)

    const ig = ignore()
    const result = ig
    .addPattern(patterns)
    .filter(win_paths)

    expect_result(t, result, make_win32)
    t.end()
  })
})

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

test('')
