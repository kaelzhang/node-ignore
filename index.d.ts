/**
 * Creates new ignore manager.
 */
declare function ignore(options?: ignore.Options): ignore.Ignore
declare namespace ignore {
  /**
   * A path relative to the directory the rules belong to, as
   *   `path.relative()` returns it.
   */
  type Pathname = string

  interface PatternParams {
    /**
     * A single ignore pattern, not split into multiple rules on newlines.
     */
    pattern: string
    /**
     * Carried through to `IgnoreRule.mark`, for packages that build upon
     *   `ignore`.
     */
    mark?: string | undefined
  }

  /**
   * A single entry accepted by `Ignore.add()`, either standalone or as an
   *   element of an array.
   */
  type Pattern = string | Ignore | PatternParams

  interface IgnoreRule {
    /**
     * The original pattern.
     */
    pattern: string
    /**
     * Carried through from `PatternParams.mark`.
     */
    mark?: string | undefined
    /**
     * Whether the pattern is a negative one, such as `!foo`.
     */
    negative: boolean
  }

  interface TestResult {
    /**
     * Whether the pathname is ignored, by a rule or because a parent
     *   directory of it is.
     */
    ignored: boolean
    /**
     * True if a negative pattern matched the pathname itself, and no parent
     *   directory of it is ignored.
     *
     * Only `ignored` passes down from a parent directory, so a pathname that
     *   is not ignored only because a parent directory was unignored keeps
     *   this false, as does one no rule applies to at all. To tell those two
     *   apart, test the parent directories, each with a trailing slash.
     */
    unignored: boolean
    /**
     * The rule that ignores the pathname, or the parent directory it is
     *   ignored with: the last rule to match, which is the rule
     *   `git check-ignore -v` reports. Present exactly when `ignored` is true.
     */
    rule?: IgnoreRule
  }

  interface Ignore {
    /**
     * Adds one or several rules to the current manager.
     * @param patterns A rule or array of rules to add.
     * @returns The current `Ignore` instance.
     */
    add(patterns: Pattern | readonly Pattern[]): this

    /**
     * Filters the given array of pathnames, and returns the filtered array.
     * NOTICE that each path here should be a relative path to the root of your repository.
     * @param pathnames The array of paths to be filtered.
     * @returns The filtered array of paths.
     */
    filter(pathnames: readonly Pathname[]): Pathname[]

    /**
     * Creates a filter function which could filter
     * an array of paths with Array.prototype.filter.
     */
    createFilter(): (pathname: Pathname) => boolean

    /**
     * Returns Boolean whether pathname should be ignored.
     * @param pathname A path to check.
     * @returns Whether `pathname` is ignored.
     */
    ignores(pathname: Pathname): boolean

    /**
     * Tests the pathname against the rules. `ignored` and `unignored` can
     *   both be false: see `TestResult.unignored` for the two cases.
     * @param pathname A path to check.
     * @returns The `TestResult` for `pathname`.
     */
    test(pathname: Pathname): TestResult

    /**
     * Debugs ignore rules and returns the checking result, which is
     *   equivalent to `git check-ignore -v`.
     * @param pathname A path to check.
     * @returns The `TestResult` for `pathname`.
     */
    checkIgnore(pathname: Pathname): TestResult
  }

  interface Options {
    ignorecase?: boolean | undefined
    // For compatibility
    ignoreCase?: boolean | undefined
    allowRelativePaths?: boolean | undefined
  }

  function isPathValid(pathname: string): boolean
}

export = ignore
