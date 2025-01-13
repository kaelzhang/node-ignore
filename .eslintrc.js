// http://eslint.org/docs/user-guide/configuring

const rules = {
  'no-underscore-dangle': ['error', {
    allowAfterThis: true,
    enforceInMethodNames: false,
    // node-ignore only
    allow: ['_rules', '_test']
  }],

  'operator-linebreak': 0,

  indent: ['error', 2, {
    MemberExpression: 0,

    // Eslint bug
    ignoreComments: true
  }]
}

if (process.platform === 'win32') {
  // Ignore linebreak-style on Windows, due to a bug of eslint
  rules['linebreak-style'] = 0
}

module.exports = {
  // Uses `require.resolve` to support npm linked eslint-config
  extends: require.resolve('eslint-config-ostai'),
  root: true,
  rules,
  overrides: [
    {
      files: ['*.ts', '*.cts', '*.mts', '*.cjs', '*.mjs'],
      extends: ['plugin:@typescript-eslint/recommended'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off'
      }
    }
  ]
}
