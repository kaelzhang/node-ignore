'use strict';

var ignore = require('../');
var expect = require('chai').expect;

describe(".makeRegex(), normal options, pattern 'foo':", function(){
    var ig = ignore();
    var r_foo = ig.makeRegex('foo');

    console.log('foo', r_foo)

    it("'foo' should match 'foo'", function(){
        expect( r_foo.test('foo') ).to.equal(true);
    });

    it("'foo' should match 'foo/'", function(){
        expect( r_foo.test('foo/') ).to.equal(true);
    });

    it("'foo' should match '/foo'", function(){
        expect( r_foo.test('/foo') ).to.equal(true);
    });

    it("'foo' should not match 'fooo'", function(){
        expect( r_foo.test('fooo') ).to.equal(false);
    });

    it("'foo' should not match 'ofoo'", function(){
        expect( r_foo.test('ofoo') ).to.equal(false);
    });
});


describe(".makeRegex(), normal options, pattern '**/foo' matches 'foo' anywhere:", function(){
    var ig = ignore();
    var r_foo = ig.makeRegex('**/foo');

    console.log('**/foo', r_foo);

    it("'**/foo' should match 'foo'", function(){
        expect( r_foo.test('foo') ).to.equal(true);
    });

    it("'**/foo' should match 'foo/'", function(){
        expect( r_foo.test('foo/') ).to.equal(true);
    });

    it("'**/foo' should match '/foo'", function(){
        expect( r_foo.test('/foo') ).to.equal(true);
    });

    it("'**/foo' should not match 'fooo'", function(){
        expect( r_foo.test('fooo') ).to.equal(false);
    });

    it("'**/foo' should not match 'ofoo'", function(){
        expect( r_foo.test('ofoo') ).to.equal(false);
    });
});

describe(".makeRegex(), normal options, pattern 'foo/':", function(){
    var ig = ignore();
    var r_foo_slash = ig.makeRegex('foo/');

    console.log('foo/', r_foo_slash)

    it("'foo' should match 'foo/'", function(){
        expect( r_foo_slash.test('foo/') ).to.equal(true);
    });

    it("'foo' should match 'foo/a'", function(){
        expect( r_foo_slash.test('foo/a') ).to.equal(true);
    });

    it("'foo' should match '/foo/'", function(){
        expect( r_foo_slash.test('/foo/') ).to.equal(true);
    });

    it("'foo' should not match 'foo'", function(){
        expect( r_foo_slash.test('foo') ).to.equal(false);
    });

    it("'foo' should not match '/foo'", function(){
        expect( r_foo_slash.test('/foo') ).to.equal(false);
    });
});


describe(".makeRegex(), normal options, pattern '/.js':", function(){
    var ig = ignore();
    var r_slash_dot_js = ig.makeRegex('/.js');

    console.log('/.js', r_slash_dot_js);

    it("collection:", function(){
        expect( r_slash_dot_js.test('.js') ).to.equal(true);
        expect( r_slash_dot_js.test('.js/') ).to.equal(true);
        expect( r_slash_dot_js.test('.js/a') ).to.equal(true);

        expect( r_slash_dot_js.test('/.js') ).to.equal(false);
        expect( r_slash_dot_js.test('.jsa') ).to.equal(false);
    });
});


describe(".makeRegex(), normal options, pattern '/*.js':", function(){
    var ig = ignore();
    var r_slash_wild_dot_js = ig.makeRegex('/*.js');

    console.log('/*.js', r_slash_wild_dot_js);

    it("collection:", function(){
        expect( r_slash_wild_dot_js.test('.js') ).to.equal(true);
        expect( r_slash_wild_dot_js.test('.js/') ).to.equal(true);
        expect( r_slash_wild_dot_js.test('.js/a') ).to.equal(true);
        expect( r_slash_wild_dot_js.test('a.js/a') ).to.equal(true);
        expect( r_slash_wild_dot_js.test('a.js/a.js') ).to.equal(true);

        expect( r_slash_wild_dot_js.test('/.js') ).to.equal(false);
        expect( r_slash_wild_dot_js.test('.jsa') ).to.equal(false);
    });
});


describe(".makeRegex(), normal options, pattern '*.js':", function(){
    var ig = ignore();
    var r_wild_dot_js = ig.makeRegex('*.js');

    console.log('*.js', r_wild_dot_js);

    it("collection:", function(){
        expect( r_wild_dot_js.test('.js') ).to.equal(true);
        expect( r_wild_dot_js.test('.js/') ).to.equal(true);
        expect( r_wild_dot_js.test('.js/a') ).to.equal(true);
        expect( r_wild_dot_js.test('a.js/a') ).to.equal(true);
        expect( r_wild_dot_js.test('a.js/a.js') ).to.equal(true);
        expect( r_wild_dot_js.test('/.js') ).to.equal(true);

        expect( r_wild_dot_js.test('.jsa') ).to.equal(false);
    });
});


describe(".makeRegex(), normal options, pattern '.js*':", function(){
    var ig = ignore();
    var r_dot_js_wild = ig.makeRegex('.js*');

    console.log('.js*', r_dot_js_wild);

    it("collection:", function(){
        expect( r_dot_js_wild.test('.js') ).to.equal(true);
        expect( r_dot_js_wild.test('.js/') ).to.equal(true);
        expect( r_dot_js_wild.test('.js/a') ).to.equal(true);

        // pay attension
        expect( r_dot_js_wild.test('a.js/a') ).to.equal(false);
        expect( r_dot_js_wild.test('a.js/a.js') ).to.equal(false);

        expect( r_dot_js_wild.test('/.js') ).to.equal(true);
        
        expect( r_dot_js_wild.test('.jsa') ).to.equal(true);
    });
});


describe(".makeRegex(), normal options, pattern 'foo/**/':", function(){
    var ig = ignore();
    var r_foo_globstar_slash = ig.makeRegex('foo/**/');

    console.log('foo/**/', r_foo_globstar_slash);

    it("should match 'foo/'", function(){
        expect( r_foo_globstar_slash.test('foo/') ).to.equal(true);
    });

    it("should match 'foo/abc/'", function(){
        expect( r_foo_globstar_slash.test('foo/abc/') ).to.equal(true);
    });

    it("should match 'foo/x/y/z/'", function(){
        expect( r_foo_globstar_slash.test('foo/x/y/z/') ).to.equal(true);
    });

    it("should match 'foo/x/y/z/'", function(){
        expect( r_foo_globstar_slash.test('foo/x/y/z/') ).to.equal(true);
    });

    it("should not match 'foo'", function(){
        expect( r_foo_globstar_slash.test('foo') ).to.equal(false);
    });

    it("should not match '/foo'", function(){
        expect( r_foo_globstar_slash.test('/foo') ).to.equal(false);
    });
});


describe(".filter()", function(){
    it("could filter paths", function(){
        var ig = ignore({
            ignore: [
                'abc',
                '!abc/b'
            ]
        });

        var filtered = ig.filter([
            'abc/a.js',
            'abc/b/b.js'
        ]);
        
        console.log('filtered', filtered);

        expect(filtered).to.deep.equal(['abc/b/b.js']);
    });
});
