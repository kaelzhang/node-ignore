export PATH=$PATH:./node_modules/.bin/

type babel && babel -o ignore.js index.js || echo 'warn: babel failed'

mocha --reporter spec ./test/ignore.js
