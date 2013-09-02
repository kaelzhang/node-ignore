# Ignore-rules

Ignore-rules is a manager and filter for .gitignore rules.

## Installation

	npm install ignore-rules --save
	
## Usage

```js
var ignoreRules = require('ignore-rules');

var rules = ignoreRules({
	ignore: [
		'.abc/*'
	]
});

rules.add('!.abc/d/');

rules.filter([
	'.abc/a.js', 	// filtered out
	'.abc/d/e.js' 	// included
]); // ['.abc/d/e.js'];
```

## Why another fstream-ignore?

1. Ignore-rules is a standalone module, and is much simpler so that it could easily work with other programs, unlike [isaacs](https://npmjs.org/~isaacs)'s [fstream-ignore](https://npmjs.org/package/fstream-ignore) which must work with the modules of the fstream family.

2. Ignore-rules only contains utility methods to filter paths according to ignore rules.

3. Exactly according to [gitignore man page](http://git-scm.com/docs/gitignore), fixes some known matching issues of fstream-ignore, such as:
	- '`/*.js`' should match '`a.js`', but not '`abc/a.js`'.
	- '`**/foo`' should match '`foo`' anywhere.




## Methods

### rules.add(rule)

Adds a rule or several rules to the current manager.

##### Returns `this`

##### Rule `String|Array.<String>`

The ignore rule or a array of rules.

### rules.filter(paths)

Filters the given array of pathnames, and returns the filtered array.

##### paths `Array`

The array of paths to be filtered

### Constructor: ignoreRules(options)

##### options.noCase `boolean=true`

By default, all ignore rules will be treated as case-insensitive ones as well as the git does. 

##### options.twoGlobstars `boolean=false`

By defailt, `ignoreRules` will omit every pattern that includes '`**`' (two consecutive asterisks) which is not compatible cross operating systems, because the behavior of file .gitignore depends on the implementation of command `fnmatch` in shell.

By the way, Mac OS doesn't support '`**`'.

##### options.ignore `Array.<String>`

The ignore rules to be added.

You can also use `.add()` method to do this.

