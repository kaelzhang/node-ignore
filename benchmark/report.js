// Rendering. Takes what `runner.compare()` produced and nothing else.
//
// The first subject is the point of reference; every other subject is
//   reported relative to it. With a single subject there is nothing to
//   compare against and only absolute figures are shown.

const NOISE_FLOOR = 1

const formatTime = ns => {
  if (ns < 1000) {
    return `${ns.toFixed(1)} ns`
  }

  if (ns < 1e6) {
    return `${(ns / 1000).toFixed(2)} us`
  }

  return `${(ns / 1e6).toFixed(2)} ms`
}

const formatSigned = percent => `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`

// A subject is faster when it takes less time, so a negative delta is the
//   good direction. Saying so in words costs one column and saves every
//   reader from having to remember which sign is which.
const describe = (percent, noisy) => {
  if (noisy) {
    return 'noise'
  }

  return percent < 0
    ? `${formatSigned(percent)} faster`
    : `${formatSigned(percent)} slower`
}

// How much a subject's own samples wobbled, as a percentage of its median.
// A delta smaller than the combined wobble of both subjects is not a result.
const spread = result => result.nsPerCall
  ? result.deviation / result.nsPerCall * 100
  : 0

const analyse = comparison => comparison.map(entry => {
  const [reference] = entry.results

  return Object.assign({}, entry, {
    results: entry.results.map((result, index) => {
      const percent = index === 0 || !reference.nsPerCall
        ? 0
        : (result.nsPerCall - reference.nsPerCall) / reference.nsPerCall * 100

      const noise = spread(reference) + spread(result) + NOISE_FLOOR

      return Object.assign({}, result, {
        percent,
        spread: spread(result),
        isReference: index === 0,
        noisy: index !== 0 && Math.abs(percent) < noise
      })
    })
  })
})

const rows = analysed => {
  const out = []

  analysed.forEach(entry => {
    entry.results.forEach(result => {
      out.push({
        suite: entry.suite,
        subject: result.name,
        perCall: formatTime(result.nsPerCall),
        perUnit: `${formatTime(result.nsPerCall / entry.weight)}/${entry.unit}`,
        spread: `+/-${result.spread.toFixed(1)}%`,
        delta: result.isReference
          ? '-'
          : describe(result.percent, result.noisy)
      })
    })
  })

  return out
}

const HEADERS = {
  suite: 'suite',
  subject: 'subject',
  perCall: 'per call',
  perUnit: 'per unit',
  spread: 'spread',
  delta: 'vs reference'
}

const columns = Object.keys(HEADERS)

const widths = data => {
  const width = {}

  columns.forEach(key => {
    width[key] = Math.max(
      HEADERS[key].length,
      ...data.map(row => row[key].length)
    )
  })

  return width
}

const text = comparison => {
  const analysed = analyse(comparison)
  const data = rows(analysed)
  const width = widths(data)

  const line = row => columns
  .map(key => row[key].padEnd(width[key]))
  .join('  ')
  .trimEnd()

  const rule = {}

  columns.forEach(key => {
    rule[key] = '-'.repeat(width[key])
  })

  const out = [line(HEADERS), line(rule)]

  let previous

  data.forEach(row => {
    // One blank line between suites, so a long table stays readable
    if (previous && previous !== row.suite) {
      out.push('')
    }

    previous = row.suite
    out.push(line(row))
  })

  return out.join('\n')
}

const markdown = comparison => {
  const analysed = analyse(comparison)
  const data = rows(analysed)

  const out = [
    `| ${columns.map(key => HEADERS[key]).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`
  ]

  data.forEach(row => {
    out.push(`| ${columns.map(key => row[key]).join(' | ')} |`)
  })

  return out.join('\n')
}

const json = comparison => JSON.stringify(analyse(comparison), null, 2)

// The worst regression any subject shows, ignoring deltas that are inside the
//   noise band. Returns `null` when there is nothing to compare.
const worstRegression = comparison => {
  let worst = null

  analyse(comparison).forEach(entry => {
    entry.results.forEach(result => {
      if (result.isReference || result.noisy || result.percent <= 0) {
        return
      }

      if (!worst || result.percent > worst.percent) {
        worst = {
          suite: entry.suite,
          subject: result.name,
          percent: result.percent
        }
      }
    })
  })

  return worst
}

module.exports = {
  analyse,
  text,
  markdown,
  json,
  worstRegression
}
