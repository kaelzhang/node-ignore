#!/bin/bash

./node_modules/.bin/babel -o ignore.js index.js

npm test
