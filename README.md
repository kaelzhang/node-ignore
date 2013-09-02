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


