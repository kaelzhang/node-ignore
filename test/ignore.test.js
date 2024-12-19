const {
  test,
  only
} = require('tap')

const ignore = require('..')
const {
  cases,
  checkEnv,
  SHOULD_TEST_WINDOWS
} = require('./fixtures/cases')

const make_win32 = path => path.replace(/\//g, '\\')

cases(({
  description,
  scopes,
  patterns,
  paths_object,
  test_only,
  paths,
  expect_result
}) => {
  const tt = test_only
    ? only
    : test

  const check = (env, scope) => {
    if (!checkEnv(env)) {
      return false
    }

    if (!scope || scopes === false) {
      return true
    }

    return scopes.includes(scope)
  }

  check('IGNORE_ONLY_FILTER', 'filter')
  && tt(`.filter():        ${description}`, t => {
    const ig = ignore()
    const result = ig
    .addPattern(patterns)
    .filter(paths)

    expect_result(t, result)
    t.end()
  })

  check('IGNORE_ONLY_CREATE_FILTER', 'createFilter')
  && tt(`.createFilter():  ${description}`, t => {
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

  const run_ignores = name => {
    tt(`.${name}(path):   ${description}`, t => {
      const ig = ignore().addPattern(patterns)

      Object.keys(paths_object).forEach(path => {
        const should_ignore = !!paths_object[path]
        const not = should_ignore ? '' : 'not '

        t.equal(
          ig[name](path),
          should_ignore,
          `path: "${path}" should ${not}be ignored`
        )
      })
      t.end()
    })
  }

  check('IGNORE_ONLY_IGNORES', 'ignores')
  && run_ignores('ignores')

  check('IGNORE_ONLY_CHECK_IGNORE', 'checkIgnore')
  && run_ignores('checkIgnore')

  if (!SHOULD_TEST_WINDOWS) {
    return
  }

  check('IGNORE_ONLY_WIN32')
  && tt(`win32: .filter(): ${description}`, t => {
    const win_paths = paths.map(make_win32)

    const ig = ignore()
    const result = ig
    .addPattern(patterns)
    .filter(win_paths)

    expect_result(t, result, make_win32)
    t.end()
  })
})
