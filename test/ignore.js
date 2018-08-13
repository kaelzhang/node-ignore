// For old node.js versions, we use es5
const ignore = require('..')
const {test} = require('tap')
const cases = require('./fixtures/cases')

const IS_WINDOWS = process.platform === 'win32'
const SHOULD_TEST_WINDOWS = !process.env.IGNORE_TEST_WIN32
  && IS_WINDOWS

const make_win32 = path => path.replace(/\//g, '\\')
const ENV_KEYS = [
  'IGNORE_ONLY_FILTER',
  'IGNORE_ONLY_CREATE_FILTER',
  'IGNORE_ONLY_IGNORES'
]

const envs = {}
let hasOnly = false
ENV_KEYS.forEach(key => {
  const value = !!process.env[key]
  envs[key] = value

  if (value) {
    hasOnly = true
  }
})

const checkSpec = key => hasOnly
  ? !!envs[key]
  : true

cases(({
  description,
  patterns,
  paths_object,
  paths,
  expect_result
}) => {
  checkSpec('IGNORE_ONLY_FILTER')
  && test(`.filter():        ${description}`, t => {
    const ig = ignore()
    const result = ig
    .addPattern(patterns)
    .filter(paths)

    expect_result(t, result)
    t.end()
  })

  checkSpec('IGNORE_ONLY_CREATE_FILTER')
  && test(`.createFilter():  ${description}`, t => {
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

  checkSpec('IGNORE_ONLY_IGNORES')
  && test(`.ignores(path):   ${description}`, t => {
    const ig = ignore().addPattern(patterns)

    Object.keys(paths_object).forEach(path => {
      t.is(ig.ignores(path), !!paths_object[path], `path: "${path}"`)
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
