# Ignore

Ignore-rules is a manager and filter for .gitignore rules.

## Installation

	npm install ignore-rules --save
	
## Usage

```js
var ignoreRules = require('ignore-rules');

var rules = ignoreRules({
	rules: [
		'.abc/*'
	]
});

rules.add('!.abc/d/');

rules.filter([
	'.abc/a.js', 	// filtered out
	'.abc/d/e.js' 	// included
]); // ['.abc/d/e.js'];
```

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


