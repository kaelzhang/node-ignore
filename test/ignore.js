'use strict';

var fs = require('fs');
var ignore = require('../');
var expect = require('chai').expect;

describe(".makeRegex(), normal options, pattern 'foo':", function() {
  var ig = ignore();
  var r_foo = ig.makeRegex('foo');

  it("'foo' should match 'foo'", function() {
    expect(r_foo.test('foo')).to.equal(true);
  });

  it("'foo' should match 'foo/'", function() {
    expect(r_foo.test('foo/')).to.equal(true);
  });

  it("'foo' should match '/foo'", function() {
    expect(r_foo.test('/foo')).to.equal(true);
  });

  it("'foo' should not match 'fooo'", function() {
    expect(r_foo.test('fooo')).to.equal(false);
  });

  it("'foo' should not match 'ofoo'", function() {
    expect(r_foo.test('ofoo')).to.equal(false);
  });
});


describe(".makeRegex(), normal options, pattern '**/foo' matches 'foo' anywhere:", function() {
  var ig = ignore();
  var r_foo = ig.makeRegex('**/foo');

  it("'**/foo' should match 'foo'", function() {
    expect(r_foo.test('foo')).to.equal(true);
  });

  it("'**/foo' should match 'foo/'", function() {
    expect(r_foo.test('foo/')).to.equal(true);
  });

  it("'**/foo' should match '/foo'", function() {
    expect(r_foo.test('/foo')).to.equal(true);
  });

  it("'**/foo' should not match 'fooo'", function() {
    expect(r_foo.test('fooo')).to.equal(false);
  });

  it("'**/foo' should not match 'ofoo'", function() {
    expect(r_foo.test('ofoo')).to.equal(false);
  });
});

describe(".makeRegex(), normal options, pattern 'foo/':", function() {
  var ig = ignore();
  var r_foo_slash = ig.makeRegex('foo/');

  it("'foo' should match 'foo/'", function() {
    expect(r_foo_slash.test('foo/')).to.equal(true);
  });

  it("'foo' should match 'foo/a'", function() {
    expect(r_foo_slash.test('foo/a')).to.equal(true);
  });

  it("'foo' should match '/foo/'", function() {
    expect(r_foo_slash.test('/foo/')).to.equal(true);
  });

  it("'foo' should not match 'foo'", function() {
    expect(r_foo_slash.test('foo')).to.equal(false);
  });

  it("'foo' should not match '/foo'", function() {
    expect(r_foo_slash.test('/foo')).to.equal(false);
  });
});


describe(".makeRegex(), normal options, pattern '/.js':", function() {
  var ig = ignore();
  var r_slash_dot_js = ig.makeRegex('/.js');

  it("collection:", function() {
    expect(r_slash_dot_js.test('.js')).to.equal(true);
    expect(r_slash_dot_js.test('.js/')).to.equal(true);
    expect(r_slash_dot_js.test('.js/a')).to.equal(true);

    expect(r_slash_dot_js.test('/.js')).to.equal(false);
    expect(r_slash_dot_js.test('.jsa')).to.equal(false);
  });
});


describe(".makeRegex(), normal options, pattern '/*.js':", function() {
  var ig = ignore();
  var r_slash_wild_dot_js = ig.makeRegex('/*.js');

  it("collection:", function() {
    expect(r_slash_wild_dot_js.test('.js')).to.equal(true);
    expect(r_slash_wild_dot_js.test('.js/')).to.equal(true);
    expect(r_slash_wild_dot_js.test('.js/a')).to.equal(true);
    expect(r_slash_wild_dot_js.test('a.js/a')).to.equal(true);
    expect(r_slash_wild_dot_js.test('a.js/a.js')).to.equal(true);

    expect(r_slash_wild_dot_js.test('/.js')).to.equal(false);
    expect(r_slash_wild_dot_js.test('.jsa')).to.equal(false);
  });
});


describe(".makeRegex(), normal options, pattern '*.js':", function() {
  var ig = ignore();
  var r_wild_dot_js = ig.makeRegex('*.js');

  it("collection:", function() {
    expect(r_wild_dot_js.test('.js')).to.equal(true);
    expect(r_wild_dot_js.test('.js/')).to.equal(true);
    expect(r_wild_dot_js.test('.js/a')).to.equal(true);
    expect(r_wild_dot_js.test('a.js/a')).to.equal(true);
    expect(r_wild_dot_js.test('a.js/a.js')).to.equal(true);
    expect(r_wild_dot_js.test('/.js')).to.equal(true);

    expect(r_wild_dot_js.test('.jsa')).to.equal(false);
  });
});


describe(".makeRegex(), normal options, pattern '.js*':", function() {
  var ig = ignore();
  var r_dot_js_wild = ig.makeRegex('.js*');

  it("collection:", function() {
    expect(r_dot_js_wild.test('.js')).to.equal(true);
    expect(r_dot_js_wild.test('.js/')).to.equal(true);
    expect(r_dot_js_wild.test('.js/a')).to.equal(true);

    // pay attension
    expect(r_dot_js_wild.test('a.js/a')).to.equal(false);
    expect(r_dot_js_wild.test('a.js/a.js')).to.equal(false);

    expect(r_dot_js_wild.test('/.js')).to.equal(true);

    expect(r_dot_js_wild.test('.jsa')).to.equal(true);
  });
});


describe(".makeRegex(), normal options, pattern 'foo/**/':", function() {
  var ig = ignore();
  var r_foo_globstar_slash = ig.makeRegex('foo/**/');

  it("should match 'foo/'", function() {
    expect(r_foo_globstar_slash.test('foo/')).to.equal(true);
  });

  it("should match 'foo/abc/'", function() {
    expect(r_foo_globstar_slash.test('foo/abc/')).to.equal(true);
  });

  it("should match 'foo/x/y/z/'", function() {
    expect(r_foo_globstar_slash.test('foo/x/y/z/')).to.equal(true);
  });

  it("should match 'foo/x/y/z/'", function() {
    expect(r_foo_globstar_slash.test('foo/x/y/z/')).to.equal(true);
  });

  it("should not match 'foo'", function() {
    expect(r_foo_globstar_slash.test('foo')).to.equal(false);
  });

  it("should not match '/foo'", function() {
    expect(r_foo_globstar_slash.test('/foo')).to.equal(false);
  });
});


var cases = [
  // description      patterns    paths     expect
  [
      'leading hash: will treat leading # as comments',
      ['#abc'],
      {
        '#abc': 0
      }
  ],
  [
      '\\#',
      ['\\#abc'],
      {
        '#abc': 1
      }
  ],
  [
      'could filter paths',
      [
        'abc',
        '!abc/b'
      ],
      {
        'abc/a.js': 1,
        'abc/b/b.js': 0
      }
  ],
  [
    'ignore.select',
    ignore.select([
      'test/fixtures/.aignore',
      'test/fixtures/.fakeignore'
    ]), {
      'abc/a.js': 1,
      'abc/b/b.js': 0,
      '#e': 0,
      '#f': 1
    }
  ],
  [
    'should excape metacharacters of regular expressions', [
      '*.js',
      '!\\*.js',
      '!a#b.js',
      '!?.js',

      // comments
      '#abc',

      '\\#abc'
    ], {
      '*.js': 0,
      'abc.js': 1,
      'a#b.js': 0,
      'abc': 0,
      '#abc': 1,
      '?.js': 0
    }
  ],

  [
    'issue #2: question mark should not break all things',
    'test/fixtures/.ignore-issue-2',
    {
      '.project': 1,
      // remain
      'abc/.project': 0,
      '.a.sw': 0,
      '.a.sw?': 1,
      'thumbs.db': 1
    }
  ],
  [
    'dir ended with "*"', [
      'abc/*'
    ], {
      'abc': 0
    }
  ],
  [
    'file ended with "*"', [
      'abc.js*',
    ], {
      'abc.js/': 1,
      'abc.js/abc': 1,
      'abc.jsa/': 1,
      'abc.jsa/abc': 1
    }
  ],
  [
    'wildcard as filename', [
      '*.b'
    ], {
      'b/a.b': 1,
      'b/.b': 1,
      'b/.ba': 0,
      'b/c/a.b': 1
    }
  ],
  [
    'slash at the beginning and come with a wildcard', [
      '/*.c'
    ], {
      '.c': 1,
      'c.c': 1,
      'c/c.c': 0,
      'c/d': 0
    }
  ],
  [
    'dot file', [
      '.d'
    ], {
      '.d': 1,
      '.dd': 0,
      'd.d': 0,
      'd/.d': 1,
      'd/d.d': 0,
      'd/e': 0
    }
  ],
  [
    'dot dir', [
      '.e'
    ], {
      '.e/': 1,
      '.ee/': 0,
      'e.e/': 0,
      '.e/e': 1,
      'e/.e': 1,
      'e/e.e': 0,
      'e/f': 0
    }
  ],
  [
    'node modules: once', [
      'node_modules/'
    ], {
      'node_modules/gulp/node_modules/abc.md': 1,
      'node_modules/gulp/node_modules/abc.json': 1
    }
  ],
  [
    'node modules: twice', [
      'node_modules/',
      'node_modules/'
    ], {
      'node_modules/gulp/node_modules/abc.md': 1,
      'node_modules/gulp/node_modules/abc.json': 1
    }
  ]
];


function readPatterns(file) {
  var content = fs.readFileSync(file);

  return content ? content.toString().split(/\r?\n/) : [];
}


describe("cases", function() {
  cases.forEach(function(c) {
    var description = c[0];
    var patterns = c[1];
    var paths_object = c[2];

    if (typeof patterns === 'string') {
      patterns = readPatterns(patterns);
    }

    var paths = Object.keys(paths_object);
    var expected = paths.filter(function(p) {
      return !paths_object[p];
    });

    it('.filter():       ' + description, function() {
      var result = ignore()
        .addPattern(patterns)
        .filter(paths);

      expect(result.sort()).to.deep.equal(expected.sort());
    });

    it(".createFilter(): " + description, function(){
      var result = paths.filter(
        ignore()
          .addPattern(patterns)
          .createFilter(),
        // thisArg should be binded
        null
      );

      expect(result.sort()).to.deep.equal(expected.sort());
    });
  });
});