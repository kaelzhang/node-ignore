[![NPM version](https://badge.fury.io/js/ignore.png)](http://badge.fury.io/js/ignore)
[![Build Status](https://travis-ci.org/kaelzhang/node-ignore.png?branch=master)](https://travis-ci.org/kaelzhang/node-ignore)
[![Dependency Status](https://gemnasium.com/kaelzhang/node-ignore.png)](https://gemnasium.com/kaelzhang/node-ignore)

# ignore

`ignore` is a manager and filter according to the .gitignore [spec](http://git-scm.com/docs/gitignore).

# Installation

	npm install ignore --save
	
# Usage

```js
var ignore = require('ignore');
var ig = ignore(options).addPattern(['.abc/*', '!.abc/d/']);
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

## With ignore files

For most cases, we'd better use only one ignore file. We could use `ignore.select` to select the first existing file.

```js
ignore().addIgnoreFile(
	ignore.select([
		'.xxxignore',
		'.gitignore',
		'.ignore'
	])
);
```

# Why another ignore?

1. `ignore` is a standalone module, and is much simpler so that it could easy work with other programs, unlike [isaacs](https://npmjs.org/~isaacs)'s [fstream-ignore](https://npmjs.org/package/fstream-ignore) which must work with the modules of the fstream family.

2. `ignore` only contains utility methods to filter paths according to the specified ignore rules.

3. Exactly according to [gitignore man page](http://git-scm.com/docs/gitignore), fixes some known matching issues of fstream-ignore, such as:
	- '`/*.js`' should match '`a.js`', but not '`abc/a.js`'.
	- '`**/foo`' should match '`foo`' anywhere.



# Methods

## .addPattern(pattern)

Adds a rule or several rules to the current manager.

#### Returns `this`

#### pattern `String|Array.<String>`

The ignore rule or a array of rules.

Notice that a line starting with `'#'`(hash) is treated as a comment. Put a backslash (`'\'`) in front of the first hash for patterns that begin with a hash, if you want to ignore a file with a hash at the beginning of the filename.

```js
ignore().addPattern('#abc').filter(['#abc']); // ['abc']
ignore().addPattern('\#abc').filter(['#abc']); // []
```


## .addIgnoreFile(path)

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

#### options.matchCase `boolean=false`

By default, all ignore rules will be treated as case-insensitive ones as well as the git does. 

#### options.twoGlobstars `boolean=false`

By defailt, `ignoreRules` will omit every pattern that includes '`**`' (two consecutive asterisks) which is not compatible cross operating systems, because the behavior of file .gitignore depends on the implementation of command `fnmatch` in shell.

By the way, Mac OS doesn't support '`**`'.

#### options.ignore `Array.<String>`

The ignore rules to be added. Default to `['.git', '.svn', '.DS_Store']`

If you want those directories to be included, you could

```js
ignore({
	ignore: []
});
```

You can also use `.addPattern()` method to do this.

