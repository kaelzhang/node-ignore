// The orchestrator.
//
// It owns three things, and measures none of them itself -- the timing lives
//   in `worker.js`, one worker per version under test:
//
// - **isolation**. Each version is loaded in a process of its own, because two
//     of them sharing one process contaminate each other's inline caches badly
//     enough to invent a 10% difference between identical code. See
//     `worker.js` for the measurement behind that number.
// - **interleaving**. Workers take turns, one sample each per round, and the
//     turn order flips every round. A machine that throttles or picks up
//     background load partway through therefore does so to every version at
//     once, instead of penalising whichever was still to be measured.
// - **the median, over several blocks**. The reported figure is the median of
//     the samples rather than their mean, and the spread is a median absolute
//     deviation -- one stray pause moves a mean and cannot move a median. The
//     samples are gathered in blocks with the workers torn down and respawned
//     in between, because samples taken inside one process are correlated:
//     same heap, same core assignment, same thermal state. Measuring in one
//     block made the spread look like +/-0.3% while repeated runs of the same
//     code against itself disagreed by up to 4.5%, so the spread was
//     describing the process rather than the measurement. Across blocks it
//     covers what actually varies, and the noise band built from it means
//     something.

const path = require('path')
const {fork} = require('child_process')

const WORKER = path.join(__dirname, 'worker.js')

const DEFAULTS = {
  // discarded time spent letting the JIT settle, per worker per suite
  warmupMs: 100,

  // how long one sample should span
  targetMs: 50,

  // how many samples per version
  samples: 21,

  // how many separate worker generations those samples are spread over
  blocks: 3
}

// `Object.assign` copies an explicit `undefined` straight over a default, and
//   a caller that builds its options one property per command line flag hands
//   over every key whether the flag was given or not. Letting `targetMs`
//   become `undefined` makes calibration compare elapsed time against `NaN`,
//   which is never true, so it grows the batch forever -- a hang rather than a
//   wrong number. Skip the holes instead of merging them.
const withDefaults = options => {
  const merged = Object.assign({}, DEFAULTS)

  Object.keys(options || {}).forEach(key => {
    if (options[key] !== undefined) {
      merged[key] = options[key]
    }
  })

  return merged
}

const median = numbers => {
  const sorted = numbers.slice().sort((a, b) => a - b)
  const mid = sorted.length >> 1

  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

// Median absolute deviation: how far a typical sample sits from the median.
// A standard deviation would be dragged around by a single outlier, which is
//   exactly the shape a garbage collection pause has.
const deviation = (numbers, mid) =>
  median(numbers.map(n => Math.abs(n - mid)))

// A worker, wrapped so the parent can await one request at a time.
const spawn = subject => {
  const child = fork(WORKER, [subject.path], {
    // The worker settles the heap between samples when it can, so a
    //   collection is paid for outside the clock rather than inside whichever
    //   sample happened to trip it.
    execArgv: ['--expose-gc'],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc']
  })

  const pending = new Map()
  let nextId = 0

  child.on('message', message => {
    const settle = pending.get(message.id)

    if (!settle) {
      return
    }

    pending.delete(message.id)

    if (message.error) {
      settle.reject(new Error(`${subject.name}: ${message.error}`))
      return
    }

    settle.resolve(message)
  })

  child.on('exit', code => {
    pending.forEach(settle => settle.reject(
      new Error(`${subject.name}: worker exited with code ${code}`)
    ))
    pending.clear()
  })

  return {
    name: subject.name,

    send (message) {
      const id = nextId ++

      return new Promise((resolve, reject) => {
        pending.set(id, {resolve, reject})
        child.send(Object.assign({id}, message))
      })
    },

    stop () {
      child.kill()
    }
  }
}

// Run the steps one after another rather than all at once. Two workers
//   sampling simultaneously would compete for the same cores and measure that
//   competition instead of the library.
const sequentially = (items, step) => items.reduce(
  (previous, item, index) => previous.then(() => step(item, index)),
  Promise.resolve()
)

// One block: fresh workers, one calibration, `samples` samples each.
const measureBlock = async (workers, suite, samples, options) => {
  const {warmupMs, targetMs} = withDefaults(options)

  // Every worker calibrates, and they then all use the largest batch any of
  //   them asked for, so one sample is the same amount of work everywhere.
  const prepared = await Promise.all(workers.map(worker => worker.send({
    type: 'prepare',
    suite: suite.name,
    warmupMs,
    targetMs
  })))

  const batch = Math.max(...prepared.map(one => one.batch))
  const taken = new Map(workers.map(worker => [worker.name, []]))

  const rounds = Array.from({length: samples}, (_, round) => round)

  await sequentially(rounds, round => {
    // Flip the turn order every round, so neither version is systematically
    //   the one measured while the machine is still recovering from the other.
    const order = round % 2
      ? workers.slice().reverse()
      : workers

    return sequentially(order, worker => worker
    .send({type: 'sample', batch})
    .then(({nsPerCall}) => {
      taken.get(worker.name).push(nsPerCall)
    }))
  })

  return taken
}

const summarise = (subjects, suite, collected) => ({
  suite: suite.name,
  description: suite.description,
  weight: suite.weight || 1,
  unit: suite.unit || 'op',
  results: subjects.map(subject => {
    const numbers = collected.get(subject.name)
    const mid = median(numbers)

    return {
      name: subject.name,
      nsPerCall: mid,
      deviation: deviation(numbers, mid),
      samples: numbers.length
    }
  })
})

// @param {Array<{name, path}>} subjects versions of index.js to compare
// @param {Array<Suite>} suites see `suites.js`
// @returns {Promise<Array>} one entry per suite
const compare = async (subjects, suites, options) => {
  const {samples, blocks} = withDefaults(options)
  const perBlock = Math.max(1, Math.round(samples / blocks))

  // suite name -> subject name -> every sample taken for it, all blocks
  const collected = new Map(suites.map(suite => [
    suite.name,
    new Map(subjects.map(subject => [subject.name, []]))
  ]))

  await sequentially(
    Array.from({length: blocks}, (_, block) => block),
    async () => {
      const workers = subjects.map(spawn)

      try {
        await sequentially(suites, suite =>
          measureBlock(workers, suite, perBlock, options)
          .then(taken => {
            const into = collected.get(suite.name)

            workers.forEach(worker => {
              into.get(worker.name).push(...taken.get(worker.name))
            })
          }))
      } finally {
        workers.forEach(worker => worker.stop())
      }
    }
  )

  return suites.map(suite => summarise(subjects, suite, collected.get(suite.name)))
}

module.exports = {
  compare,
  measureBlock,
  withDefaults,
  median,
  deviation,
  DEFAULTS
}
