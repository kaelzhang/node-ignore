// http://eslint.org/docs/user-guide/configuring

module.exports = {
  extends: 'airbnb-base',
  root: true,
  parserOptions: {
    sourceType: 'module'
  },
  rules: {
    semi: ['error', 'never'],

    camelcase: ['off', 'never'],

    'comma-dangle': ['error', 'never'],

    'object-curly-spacing': ['error', 'never'],

    'arrow-parens': ['error', 'as-needed'],

    indent: ['error', 2, {
      MemberExpression: 0
    }],

    'no-multi-spaces': ['error', {
      ignoreEOLComments: true
    }],

    'no-extra-semi': 'error',

    'space-before-function-paren': ['error', 'always'],

    'no-use-before-define': ['error', {
      functions: false
    }],

    'func-names': ['error', 'as-needed'],

    // allow ++
    'no-plusplus': 'off',

    'space-unary-ops': ['error', {
      words: true,
      nonwords: true,
      // a ++
      // a --
      // !a
      // !!a
      overrides: {
        '!': false,
        '!!': false
      }
    }],

    'no-param-reassign': 'off',

    'no-underscore-dangle': ['error', {
      allowAfterThis: true,
      enforceInMethodNames: false,
      // node-ignore only
      allow: ['_rules', '_filter']
    }],

    'no-return-assign': 'off',

    'no-bitwise': 'off',

    'no-confusing-arrow': 'off',

    'no-mixed-operators': 'off'
  }
}
