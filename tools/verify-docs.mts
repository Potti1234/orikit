import { access, readdir, readFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const roots = [resolve(root, 'README.md'), resolve(root, 'AGENTS.md'), resolve(root, 'docs')]

const markdownFiles = async (path: string): Promise<ReadonlyArray<string>> => {
  if (extname(path) === '.md') {
    return [path]
  }
  const entries = await readdir(path, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? markdownFiles(resolve(path, entry.name))
        : Promise.resolve(entry.name.endsWith('.md') ? [resolve(path, entry.name)] : []),
    ),
  )
  return nested.flat()
}

const files = (await Promise.all(roots.map(markdownFiles))).flat()
const failures: Array<string> = []

for (const file of files) {
  const markdown = await readFile(file, 'utf8')
  for (const match of markdown.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
    const rawTarget = match[1]?.trim()
    if (
      rawTarget === undefined ||
      rawTarget.startsWith('#') ||
      /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)
    ) {
      continue
    }
    const target = rawTarget.replace(/^<|>$/g, '').split('#', 1)[0]
    if (target === undefined || target.length === 0) {
      continue
    }
    try {
      await access(resolve(dirname(file), decodeURIComponent(target)))
    } catch {
      failures.push(`${file.slice(root.length + 1)} -> ${rawTarget}`)
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Broken relative Markdown links:\n${failures.join('\n')}`)
}

console.log(JSON.stringify({ status: 'pass', markdownFiles: files.length }))
