'use strict'

// For old node.js versions, we use es5
var ignore = require('../')
var expect = require('chai').expect
var path = require('path')
var cases = require('./fixtures/cases')

var IS_WINDOWS = process.platform === 'win32'
var SHOULD_TEST_WINDOWS = !process.env.IGNORE_TEST_WIN32
  && IS_WINDOWS

describe("cases", function() {
  cases(function (
    description,
    patterns,
    paths_object,
    skip_test_test,
    paths,
    expected,
    expect_result
  ) {

    it('.filter():        ' + description, function() {
      var ig = ignore()
      var result = ig
        .addPattern(patterns)
        .filter(paths)

      expect_result(result)
    })

    it('.createFilter():  ' + description, function() {
      var result = paths.filter(
        ignore()
        .addPattern(patterns)
        .createFilter(),
        // thisArg should be binded
        null
      )

      expect_result(result)
    })

    it('.ignores(path):   ' + description, function () {
      var ig = ignore().addPattern(patterns)

      Object.keys(paths_object).forEach(function (path) {
        expect(ig.ignores(path)).to.equal(!!paths_object[path])
      })
    })

    SHOULD_TEST_WINDOWS && it('win32: .filter(): ' + description, function() {
      var win_paths = paths.map(make_win32)

      var ig = ignore()
      var result = ig
        .addPattern(patterns)
        .filter(win_paths)

      expect_result(result, make_win32)
    })
  })

  it('.add(<Ignore>)', function() {
    var a = ignore().add(['.abc/*', '!.abc/d/'])
    var b = ignore().add(a).add('!.abc/e/')

    var paths = [
      '.abc/a.js',    // filtered out
      '.abc/d/e.js',  // included
      '.abc/e/e.js'   // included by b, filtered out by a
    ]

    expect(a.filter(paths)).to.eql(['.abc/d/e.js']);
    expect(b.filter(paths)).to.eql(['.abc/d/e.js', '.abc/e/e.js']);
  })
})

function make_win32 (path) {
  return path.replace(/\//g, '\\')
}


describe('for coverage', function () {
  it('fixes babel class', function () {
    var constructor = ignore().constructor

    try {
      constructor()
    } catch (e) {
      return
    }

    expect('there should be an error').to.equal('no error found')
  })
})


describe('github issues', function () {
  it('#32', function () {
    var KEY_IGNORE = typeof Symbol !== 'undefined'
      ? Symbol.for('node-ignore')
      : 'node-ignore';

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

    expect(a.filter(paths)).to.eql(['.abc/d/e.js']);
    expect(b.filter(paths)).to.eql(['.abc/d/e.js', '.abc/e/e.js']);
  })
})
