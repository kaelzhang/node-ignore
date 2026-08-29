// One version of the library, measured in a process of its own.
//
// Two versions cannot share a process and still be compared honestly. The
//   suite closures that call into them are shared code, and V8 specialises a
//   call site to the shapes it has seen there: the version that arrives first
//   keeps a monomorphic inline cache, the second one turns the site
//   polymorphic and both then run slower than either does alone. Measured on
//   this repository, two *byte-identical* copies of `index.js` came out 10%
//   apart when they ran together, stably, across processes and in both
//   orderings -- and came out equal when each ran alone. A 10% phantom is
//   larger than most of the wins this benchmark exists to detect.
//
// So each version gets a process, and the parent interleaves their samples
//   over IPC: no shared call sites, and the machine's own drift still lands
//   on both alike.

const {suites} = require('./suites')

const ignore = require(process.argv[2])

const NS_PER_MS = 1e6

/* istanbul ignore next */
const collect = typeof global.gc === 'function'
  ? () => global.gc()
  : () => {}

const takeSample = (run, batch) => {
  const started = process.hrtime.bigint()

  for (let i = 0; i < batch; i ++) {
    run()
  }

  return Number(process.hrtime.bigint() - started) / batch
}

// Warmup does not need nanosecond resolution -- it only has to last long
//   enough for the JIT to settle -- so the wall clock is plenty.
const warmUp = (run, warmupMs) => {
  const deadline = Date.now() + warmupMs

  while (Date.now() < deadline) {
    run()
  }
}

// Grow the batch until one pass spans `targetMs`, so the timer's resolution
//   stops being part of the measurement.
const calibrate = (run, targetMs) => {
  const target = targetMs * NS_PER_MS
  let batch = 1

  for (;;) {
    const started = process.hrtime.bigint()

    for (let i = 0; i < batch; i ++) {
      run()
    }

    const elapsed = Number(process.hrtime.bigint() - started)

    if (elapsed >= target) {
      return batch
    }

    // Grow by the ratio still needed, but never by more than 8x at a time, so
    //   a very fast case converges without overshooting into a batch that
    //   takes seconds.
    batch *= elapsed > 0
      ? Math.min(8, Math.ceil(target / elapsed))
      : 8
  }
}

let prepared = null

const commands = {
  // Set up one suite and report what batch size it needs. The parent collects
  //   every worker's answer and hands back the one they will all use, so that
  //   a sample means the same amount of work everywhere.
  prepare ({suite, warmupMs, targetMs}) {
    const found = suites.find(one => one.name === suite)

    if (!found) {
      throw new Error(`unknown suite "${suite}"`)
    }

    const {run} = found.setup(ignore)

    prepared = run

    warmUp(run, warmupMs)

    return {
      batch: calibrate(run, targetMs)
    }
  },

  sample ({batch}) {
    collect()

    return {
      nsPerCall: takeSample(prepared, batch)
    }
  }
}

process.on('message', message => {
  const command = commands[message.type]

  try {
    process.send(Object.assign(
      {id: message.id},
      command(message)
    ))
  } catch (error) {
    process.send({id: message.id, error: error.message})
  }
})
