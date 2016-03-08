export PATH=$PATH:./node_modules/.bin/
export IGNORE_TEST_WIN32=1

type babel && babel -o ignore.js index.js || echo 'warn: babel failed'

./node_modules/.bin/mocha --reporter spec ./test/ignore.js
