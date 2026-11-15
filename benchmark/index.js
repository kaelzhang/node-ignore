#!/usr/bin/env node

// node-ignore performance benchmark.
//
//   node benchmark
//   node benchmark --baseline origin/master
//   node benchmark --baseline origin/master --format markdown
//   node benchmark --filter compile --samples 25
//
// With `--baseline`, both versions are measured in parallel processes with
//   their samples interleaved, so the machine's own drift cancels out instead
//   of landing on whichever version happened to be measured second. They get a
//   process each rather than sharing one -- see `worker.js` for why that is
//   not optional. `index.js` has no `require` of its own, so a second copy of
//   it can be loaded from anywhere.

const fs = require('fs')
const os = require('os')
const path = require('path')
const {execFileSync} = require('child_process')

const {compare} = require('./runner')
const {suites} = require('./suites')
const report = require('./report')

const ROOT = path.join(__dirname, '..')

const USAGE = `Usage: node benchmark [options]

  --baseline <ref|path>   compare against another version of index.js,
                            either a git ref or a path to a file
  --format <name>         text (default), markdown, or json
  --filter <substring>    only run suites whose name contains this
  --samples <n>           samples per subject (default 21)
  --blocks <n>            worker generations those samples are split over,
                            so the reported spread covers what varies
                            between processes too (default 3)
  --target-ms <n>         how long one sample should span (default 50)
  --warmup-ms <n>         warmup per subject before timing (default 100)
  --max-regression <n>    exit non-zero if a suite regresses by more than
                            this percentage, outside the noise band
  --help                  show this
`

const FLAGS = {
  '--baseline': 'baseline',
  '--format': 'format',
  '--filter': 'filter',
  '--samples': 'samples',
  '--blocks': 'blocks',
  '--target-ms': 'targetMs',
  '--warmup-ms': 'warmupMs',
  '--max-regression': 'maxRegression'
}

const NUMERIC = ['samples', 'blocks', 'targetMs', 'warmupMs', 'maxRegression']
const POSITIVE = ['samples', 'blocks', 'targetMs']

// A `NaN`, zero or negative count from a mistyped flag would travel into the
//   timing or block loop and either divide by zero or hang, so reject it at
//   the boundary.
const toNumber = (flag, value, key) => {
  const number = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(number) && (
    POSITIVE.indexOf(key) >= 0
      ? number > 0
      : number >= 0
  )

  if (!valid) {
    const kind = POSITIVE.indexOf(key) >= 0
      ? 'a positive number'
      : 'a non-negative number'
    throw new Error(`option "${flag}" needs ${kind}, but got "${value}"`)
  }

  return number
}

const parse = argv => {
  const options = {format: 'text'}

  for (let i = 0; i < argv.length; i ++) {
    const arg = argv[i]

    if (arg === '--help' || arg === '-h') {
      return {help: true}
    }

    const key = FLAGS[arg]

    if (!key) {
      throw new Error(`unknown option "${arg}"`)
    }

    const value = argv[++ i]

    if (value === undefined) {
      throw new Error(`option "${arg}" needs a value`)
    }

    options[key] = NUMERIC.indexOf(key) < 0
      ? value
      : toNumber(arg, value, key)
  }

  return options
}

// A baseline is either a file that is already on disk, or a git ref whose
//   `index.js` we materialise into a temporary file first. Either way what
//   comes back is a path, because the worker that loads it lives in another
//   process, plus a cleanup hook when a temporary directory was created.
const loadBaseline = reference => {
  const asPath = path.resolve(ROOT, reference)

  if (fs.existsSync(asPath) && fs.statSync(asPath).isFile()) {
    return {
      name: path.relative(ROOT, asPath) || reference,
      path: asPath,
      cleanup: () => {}
    }
  }

  const source = execFileSync('git', ['show', `${reference}:index.js`], {
    cwd: ROOT,
    maxBuffer: 1 << 26
  })

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ignore-benchmark-'))
  const file = path.join(dir, 'baseline.js')

  fs.writeFileSync(file, source)

  return {
    name: reference,
    path: file,
    cleanup: () => {
      fs.rmSync(dir, {recursive: true, force: true})
    }
  }
}

const main = async argv => {
  const options = parse(argv)

  if (options.help) {
    process.stdout.write(USAGE)
    return 0
  }

  const subjects = []
  const baseline = options.baseline
    ? loadBaseline(options.baseline)
    : null

  if (baseline) {
    subjects.push(baseline)
  }

  try {
    subjects.push({
      name: subjects.length
        ? 'working tree'
        : 'index.js',
      path: path.join(ROOT, 'index.js')
    })

    const selected = options.filter
      ? suites.filter(suite => suite.name.indexOf(options.filter) >= 0)
      : suites

    if (!selected.length) {
      throw new Error(`no suite matches "${options.filter}"`)
    }

    const comparison = await compare(subjects, selected, {
      samples: options.samples,
      blocks: options.blocks,
      targetMs: options.targetMs,
      warmupMs: options.warmupMs
    })

    const render = report[options.format]

    if (!render) {
      throw new Error(`unknown format "${options.format}"`)
    }

    process.stdout.write(`${render(comparison)}\n`)

    const limit = options.maxRegression

    if (!limit && limit !== 0) {
      return 0
    }

    const worst = report.worstRegression(comparison)

    if (worst && worst.percent > limit) {
      process.stderr.write(
        `\nregression: "${worst.suite}" is ${worst.percent.toFixed(1)}% slower `
        + `than the baseline, over the ${limit}% budget\n`
      )

      return 1
    }

    return 0
  } finally {
    if (baseline) {
      baseline.cleanup()
    }
  }
}

/* istanbul ignore next */
if (require.main === module) {
  main(process.argv.slice(2)).then(
    code => {
      process.exitCode = code
    },
    error => {
      process.stderr.write(`${error.message}\n\n${USAGE}`)
      process.exitCode = 2
    }
  )
}

module.exports = {main, parse, loadBaseline}
