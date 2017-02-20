export PATH=$PATH:./node_modules/.bin/
export IGNORE_TEST_WIN32=

abort() {
  printf "\n\x1B[31mError: $@\x1B[0m\n\n"
  exit 1
}

type babel && babel -o ignore.js index.js || abort 'warn: babel failed'

./node_modules/.bin/mocha --reporter spec ./test/ignore.js || abort 'test failed'
