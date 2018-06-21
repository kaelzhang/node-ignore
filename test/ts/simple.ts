import ignore from '../../'

const paths = ['a', 'a/b', 'foo/bar']

let ig = ignore()

ig = ig.add('*')
ig = ig.add(['!*/', '!foo/bar'])

const filter = ig.createFilter()
paths.filter(filter)
const passed: boolean = filter('a')

const filtered_paths: Array<string> = ig.filter(paths)
const ignores: boolean = ig.ignores('a')

let ig2 = ignore()

ig2 = ig2.add('# test ig.add(Ignore)')
ig2 = ig2.add(ig)

let ig3 = ignore()
ig3 = ig3.add('*.js')

let ig4 = ignore()
ig4 = ig4.add('*.png')

ig2 = ig2.add([ig3, ig4])
