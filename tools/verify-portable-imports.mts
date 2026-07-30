import { readdir, readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoots = [
  resolve(root, 'packages/spike-core/src'),
  resolve(root, 'packages/runtime/src'),
  resolve(root, 'packages/location/src'),
  resolve(root, 'packages/spike-trace/src'),
  resolve(root, 'packages/todo/src'),
  resolve(root, 'packages/story/src'),
]
const banned = [
  /^node:/,
  /^@nativescript(?:\/|$)/,
  /^nativescript(?:\/|$)/,
  /^(?:react-dom|jsdom|happy-dom|linkedom)(?:\/|$)/,
]

const sourceFiles = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        return sourceFiles(path)
      }
      return Promise.resolve(
        entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [],
      )
    }),
  )
  return files.flat()
}

const failures: Array<string> = []
for (const file of (await Promise.all(sourceRoots.map(sourceFiles))).flat()) {
  const source = await readFile(file, 'utf8')
  const specifiers = [
    ...source.matchAll(/\b(?:from\s*|import\s*)['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ]
  for (const match of specifiers) {
    const specifier = match[1]
    if (specifier !== undefined && banned.some((pattern) => pattern.test(specifier))) {
      failures.push(`${relative(root, file)} imports ${specifier}`)
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Portable source has platform imports:\n${failures.join('\n')}`)
}

console.log(
  JSON.stringify({
    status: 'pass',
    packages: sourceRoots.map((path) => relative(root, path).replaceAll('\\', '/')),
  }),
)
