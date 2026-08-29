// Workload fixtures and the scenario catalogue.
//
// The fixtures are meant to look like what a real consumer hands the library
//   -- a `.gitignore` someone would actually commit, and paths with the shape
//   a repository walk produces: mostly misses, a few hits, `node_modules`
//   heavy -- rather than whatever makes a micro-benchmark look good.
//
// Everything here is deterministic. No `Math.random()`, so two runs on the
//   same machine differ only by the machine.

// GitHub's `Node.gitignore` template, which is what most JavaScript projects
//   actually start from.
const TYPICAL = `
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
pids
*.pid
*.seed
*.pid.lock
lib-cov
coverage
*.lcov
.nyc_output
.grunt
bower_components
.lock-wscript
build/Release
node_modules/
jspm_packages/
web_modules/
*.tsbuildinfo
.npm
.eslintcache
.stylelintcache
.rpt2_cache/
.yarn-integrity
.env
.env.development.local
.env.test.local
.env.production.local
.cache
.parcel-cache
.next
out
.nuxt
dist
.vuepress/dist
.temp
.docusaurus
.serverless/
.fusebox/
.dynamodb/
.tern-port
.vscode-test
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
.pnp.*
!.yarn/patches
!.yarn/releases
!.yarn/plugins
!.yarn/sdks
!.yarn/versions
`.trim().split('\n')

// What a monorepo accumulates: a rule set big enough that walking all of it
//   per path is the dominant cost.
const LARGE = (() => {
  const patterns = TYPICAL.slice()

  for (let i = 0; i < 450; i ++) {
    patterns.push(`packages/pkg-${i}/dist`)
    patterns.push(`packages/pkg-${i}/*.tmp`)
  }

  return patterns
})()

// A handful of small per-directory `.gitignore` files, which is how git itself
//   reads them -- one per directory as the walk descends.
const PER_DIRECTORY = [
  ['dist', '*.log'],
  ['node_modules/', '.cache'],
  ['*.tmp', '!keep.tmp', 'tmp/'],
  ['coverage', '.nyc_output', '*.lcov'],
  ['build/Release', '*.o', '*.node']
]

const DIRECTORIES = [
  '',
  'src',
  'src/components',
  'src/components/button',
  'src/utils',
  'src/utils/deep/nested/path',
  'lib',
  'test',
  'test/fixtures',
  'docs',
  'dist',
  'coverage',
  'build/Release',
  'node_modules/lodash',
  'node_modules/lodash/fp',
  'node_modules/react/lib',
  'node_modules/@babel/core/lib/config',
  '.next',
  'out'
]

const FILENAMES = [
  'index.js',
  'index.d.ts',
  'main.css',
  'README.md',
  'package.json',
  'debug.log',
  'npm-debug.log.1',
  'app.pid',
  'tsconfig.tsbuildinfo',
  '.env',
  'x.lcov',
  'component.tsx',
  'style.scss',
  'helper.mjs'
]

const join = (dir, name) => dir
  ? `${dir}/${name}`
  : name

// The paths a walk of one repository hands you.
const REPO_PATHS = (() => {
  const paths = []

  DIRECTORIES.forEach(dir => {
    FILENAMES.forEach(name => {
      paths.push(join(dir, name))
    })
  })

  return paths
})()

// Distinct paths, so that the library's own result cache can never turn a
//   measurement of matching into a measurement of a hash lookup.
const distinctPaths = count => {
  const paths = []

  for (let i = 0; paths.length < count; i ++) {
    const dir = DIRECTORIES[i % DIRECTORIES.length]
    const name = FILENAMES[i % FILENAMES.length]

    paths.push(join(dir, `${i}-${name}`))
  }

  return paths
}

const DISTINCT = distinctPaths(20000)

// What one sample of a cache-cold suite covers. Large enough that the timed
//   region dwarfs the clock's resolution, small enough that the instance's
//   result cache stays a few thousand entries rather than tens of megabytes --
//   past that the suite measures the allocator instead of the library.
const WORKING_SET = 2000

const WALK = DISTINCT.slice(0, WORKING_SET)

const DEEP = (() => {
  const paths = []
  const dir = 'a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p'

  for (let i = 0; i < WORKING_SET; i ++) {
    paths.push(`${dir}/file-${i}.js`)
  }

  return paths
})()

// A fresh instance whose lazily built regexes have all been forced, so that a
//   matching suite measures matching and not a one-off compile.
const ready = (ignore, patterns) => {
  const ig = ignore().add(patterns)

  ig.ignores('benchmark/warm-up.js')

  return ig
}

// A suite that wants an empty cache for every sample needs a fresh instance
//   every sample, and recompiling the rule set each time would put more
//   garbage in the timed region's way than the thing being measured. Adding
//   one Ignore to another copies the already-compiled rules across (#32), so
//   this hands back a fresh cache over shared rules -- cheap, and it keeps the
//   lazily built regexes warm.
const recycle = (ignore, patterns) => {
  const compiled = ready(ignore, patterns)

  return () => ignore().add(compiled)
}

// Walk a path list against an instance that has never seen any of them, so
//   the library's own result cache can never turn this into a measurement of a
//   hash lookup. The instance is built inside the timed region on purpose:
//   copying an already-compiled rule set costs a few microseconds against the
//   milliseconds of matching that follow, and paying it here means a sample
//   can cover many calls instead of exactly one -- which took the run-to-run
//   spread of these suites from +/-13% down to a couple of percent.
const walk = (fresh, paths) => () => {
  const ig = fresh()

  for (let i = 0; i < paths.length; i ++) {
    ig.ignores(paths[i])
  }
}

// A suite is `{name, description, unit, weight, setup}`, where `setup(ignore)`
//   returns `{run}` -- the function to time, closed over whatever state it
//   needs. A suite that must start cold builds that state inside `run` rather
//   than around it, so that repeating `run` repeats the cold start too.
//
// `weight` is how many logical units one call covers, so the report can show
//   a per-pattern or per-path cost next to the per-call one.
const suites = [
  {
    name: 'compile/typical',
    description: 'add() a ~55 line .gitignore',
    unit: 'pattern',
    weight: TYPICAL.length,
    setup: ignore => ({
      run: () => ignore().add(TYPICAL)
    })
  },

  {
    name: 'compile/large',
    description: 'add() a 955 pattern monorepo rule set',
    unit: 'pattern',
    weight: LARGE.length,
    setup: ignore => ({
      run: () => ignore().add(LARGE)
    })
  },

  {
    name: 'compile/per-directory',
    description: 'five small .gitignore files, the way git reads them',
    unit: 'file',
    weight: PER_DIRECTORY.length,
    setup: ignore => ({
      run: () => {
        for (let i = 0; i < PER_DIRECTORY.length; i ++) {
          ignore().add(PER_DIRECTORY[i])
        }
      }
    })
  },

  {
    name: 'match/distinct',
    description: '2k distinct paths, cache never hits (a directory walk)',
    unit: 'path',
    weight: WORKING_SET,
    setup: ignore => ({
      run: walk(recycle(ignore, TYPICAL), WALK)
    })
  },

  {
    name: 'match/repeat',
    description: '20k lookups over 266 paths, cache hits after the first pass',
    unit: 'path',
    weight: 20000,
    setup: ignore => {
      const ig = ready(ignore, TYPICAL)

      REPO_PATHS.forEach(path => ig.ignores(path))

      return {
        run: () => {
          for (let i = 0; i < 20000; i ++) {
            ig.ignores(REPO_PATHS[i % REPO_PATHS.length])
          }
        }
      }
    }
  },

  {
    name: 'match/deep',
    description: '2k distinct paths 17 levels deep (parent recursion)',
    unit: 'path',
    weight: DEEP.length,
    setup: ignore => ({
      run: walk(recycle(ignore, TYPICAL), DEEP)
    })
  },

  {
    name: 'match/many-rules',
    description: '500 distinct paths against 955 rules (the linear scan)',
    unit: 'path',
    weight: 500,
    setup: ignore => ({
      run: walk(recycle(ignore, LARGE), DISTINCT.slice(0, 500))
    })
  },

  {
    name: 'filter/bulk',
    description: 'filter() over 2k distinct paths, the most used API',
    unit: 'path',
    weight: WORKING_SET,
    setup: ignore => {
      const fresh = recycle(ignore, TYPICAL)

      return {
        run: () => fresh().filter(WALK)
      }
    }
  },

  {
    name: 'check-ignore',
    description: 'checkIgnore() over 2k distinct paths, the git equivalent',
    unit: 'path',
    weight: WORKING_SET,
    setup: ignore => {
      const fresh = recycle(ignore, TYPICAL)

      return {
        run: () => {
          const ig = fresh()

          for (let i = 0; i < WALK.length; i ++) {
            ig.checkIgnore(WALK[i])
          }
        }
      }
    }
  },

  {
    // The headline number, and the one a deferral cannot game: whatever work
    //   `add()` puts off, this suite still pays for.
    name: 'end-to-end',
    description: 'construct, add() and filter 2k paths, from cold',
    unit: 'path',
    weight: WORKING_SET,
    setup: ignore => ({
      run: () => ignore().add(TYPICAL).filter(WALK)
    })
  }
]

module.exports = {
  suites,
  TYPICAL,
  LARGE,
  REPO_PATHS,
  DISTINCT
}
