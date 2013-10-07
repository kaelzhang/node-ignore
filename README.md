[![Build Status](https://travis-ci.org/kaelzhang/node-ignore.png?branch=master)](https://travis-ci.org/kaelzhang/node-ignore)

# ignore

`ignore` is a manager and filter according to the .gitignore [spec](http://git-scm.com/docs/gitignore).

# Installation

	npm install ignore --save
	
# Usage

```js
var ignore = require('ignore');
var ig = ignore(options).addRule(['.abc/*', '!.abc/d/']);
```

## Filter the given paths

```js
var paths = [
    '.abc/a.js',    // filtered out
    '.abc/d/e.js'   // included
];

ig.filter(paths); // ['.abc/d/e.js']
```

## As the filter function

```js
paths.filter(ig.createFilter()); // ['.abc/d/e.js']
```

# Why another ignore?

1. `ignore` is a standalone module, and is much simpler so that it could easy work with other programs, unlike [isaacs](https://npmjs.org/~isaacs)'s [fstream-ignore](https://npmjs.org/package/fstream-ignore) which must work with the modules of the fstream family.

2. `ignore` only contains utility methods to filter paths according to the specified ignore rules.

3. Exactly according to [gitignore man page](http://git-scm.com/docs/gitignore), fixes some known matching issues of fstream-ignore, such as:
	- '`/*.js`' should match '`a.js`', but not '`abc/a.js`'.
	- '`**/foo`' should match '`foo`' anywhere.



# Methods

## .addRule(rule)

Adds a rule or several rules to the current manager.

#### Returns `this`

#### Rule `String|Array.<String>`

The ignore rule or a array of rules.


## .addRuleFile(path)

Adds rules from a ignore file or several files 

#### Returns `this`

#### Rule `String|Array.<String>`


## .filter(paths)

Filters the given array of pathnames, and returns the filtered array.

#### paths `Array`

The array of paths to be filtered

## .createFilter()

Creates a filter function which could filter an array of paths with `Array.prototype.filter`.

#### Returns `function(path)`

The filter function.


# Constructor: ignore.Ignore

```js
new ignore.Ignore(options);
ignore(options);
```

#### options.noCase `boolean=true`

By default, all ignore rules will be treated as case-insensitive ones as well as the git does. 

#### options.twoGlobstars `boolean=false`

By defailt, `ignoreRules` will omit every pattern that includes '`**`' (two consecutive asterisks) which is not compatible cross operating systems, because the behavior of file .gitignore depends on the implementation of command `fnmatch` in shell.

By the way, Mac OS doesn't support '`**`'.

#### options.ignore `Array.<String>`

The ignore rules to be added.

You can also use `.add()` method to do this.

