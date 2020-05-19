const {test} = require('tap')

const ignore = require('..')
const {
  cases,
  checkEnv,
  SHOULD_TEST_WINDOWS
} = require('./fixtures/cases')

const make_win32 = path => path.replace(/\//g, '\\')

cases(({
  description,
  patterns,
  paths_object,
  paths,
  expect_result
}) => {
  checkEnv('IGNORE_ONLY_FILTER')
  && test(`.filter():        ${description}`, t => {
    const ig = ignore()
    const result = ig
    .addPattern(patterns)
    .filter(paths)

    expect_result(t, result)
    t.end()
  })

  checkEnv('IGNORE_ONLY_CREATE_FILTER')
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

  checkEnv('IGNORE_ONLY_IGNORES')
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

  checkEnv('IGNORE_ONLY_WIN32')
  && test(`win32: .filter(): ${description}`, t => {
    const win_paths = paths.map(make_win32)

    const ig = ignore()
    const result = ig
    .addPattern(patterns)
    .filter(win_paths)

    expect_result(t, result, make_win32)
    t.end()
  })
})
