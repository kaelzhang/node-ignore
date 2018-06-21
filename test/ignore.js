'use strict'

// For old node.js versions, we use es5
var ignore = require('../')
var test = require('tap').test
var path = require('path')
var cases = require('./fixtures/cases')

var IS_WINDOWS = process.platform === 'win32'
var SHOULD_TEST_WINDOWS = !process.env.IGNORE_TEST_WIN32
  && IS_WINDOWS

cases(function (
  description,
  patterns,
  paths_object,
  skip_test_test,
  paths,
  expected,
  expect_result
) {

  test('.filter():        ' + description, function (t) {
    var ig = ignore()
    var result = ig
      .addPattern(patterns)
      .filter(paths)

    expect_result(t, result)
    t.end()
  })

  test('.createFilter():  ' + description, function (t) {
    var result = paths.filter(
      ignore()
      .addPattern(patterns)
      .createFilter(),
      // thisArg should be binded
      null
    )

    expect_result(t, result)
    t.end()
  })

  test('.ignores(path):   ' + description, function (t) {
    var ig = ignore().addPattern(patterns)

    Object.keys(paths_object).forEach(function (path) {
      t.is(ig.ignores(path), !!paths_object[path])
    })
    t.end()
  })

  SHOULD_TEST_WINDOWS && test('win32: .filter(): ' + description, function (t) {
    var win_paths = paths.map(make_win32)

    var ig = ignore()
    var result = ig
      .addPattern(patterns)
      .filter(win_paths)

    expect_result(t, result, make_win32)
    t.end()
  })
})

test('.add(<Ignore>)', function (t) {
  var a = ignore().add(['.abc/*', '!.abc/d/'])
  var b = ignore().add(a).add('!.abc/e/')

  var paths = [
    '.abc/a.js',    // filtered out
    '.abc/d/e.js',  // included
    '.abc/e/e.js'   // included by b, filtered out by a
  ]

  t.deepEqual(a.filter(paths), ['.abc/d/e.js'])
  t.deepEqual(b.filter(paths), ['.abc/d/e.js', '.abc/e/e.js'])
  t.end()
})

function make_win32 (path) {
  return path.replace(/\//g, '\\')
}

test('fixes babel class', function (t) {
  var constructor = ignore().constructor

  try {
    constructor()
  } catch (e) {
    t.end()
    return
  }

  t.is('there should be an error', 'no error found')
  t.end()
})

test('#32', function (t) {
  var KEY_IGNORE = typeof Symbol !== 'undefined'
    ? Symbol.for('node-ignore')
    : 'node-ignore'

  var a = ignore().add(['.abc/*', '!.abc/d/'])

  // aa is actually not an IgnoreBase instance
  var aa = {}
  aa._rules = a._rules.slice()
  aa[KEY_IGNORE] = true

  var b = ignore().add(aa).add('!.abc/e/')

  var paths = [
    '.abc/a.js',    // filtered out
    '.abc/d/e.js',  // included
    '.abc/e/e.js'   // included by b, filtered out by a
  ]

  t.deepEqual(a.filter(paths), ['.abc/d/e.js']);
  t.deepEqual(b.filter(paths), ['.abc/d/e.js', '.abc/e/e.js'])
  t.end()
})

test('')
