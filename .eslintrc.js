// http://eslint.org/docs/user-guide/configuring

module.exports = {
  // Uses `require.resolve` to support npm linked eslint-config
  extends: require.resolve('eslint-config-ostai'),
  root: true,
  rules: {
    'no-underscore-dangle': ['error', {
      allowAfterThis: true,
      enforceInMethodNames: false,
      // node-ignore only
      allow: ['_rules', '_test']
    }],

    indent: ['error', 2, {
      MemberExpression: 0,

      // Eslint bug
      ignoreComments: true
    }]
  }
}
