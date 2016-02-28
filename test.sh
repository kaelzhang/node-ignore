#!/bin/bash

./node_modules/.bin/babel -o ignore.js index.js
./node_modules/.bin/mocha --reporter spec ./test/ignore.js
