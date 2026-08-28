import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('===================================================')
console.log('       AgentJob 1-Click Build & Release            ')
console.log('===================================================')

// 1. Verify key exists
const keyPath = path.join(rootDir, 'src-tauri', 'agentjob.key')
if (!fs.existsSync(keyPath)) {
  console.error(`\n[ERROR] Private signing key not found at: ${keyPath}`)
  process.exit(1)
}

// 2. Bump version in package.json and tauri.conf.json
const packageJsonPath = path.join(rootDir, 'package.json')
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json')

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'))

const currentVersion = pkg.version || '0.1.0'
const parts = currentVersion.split('.').map((p) => parseInt(p, 10))

if (parts.length === 3 && !parts.some(isNaN)) {
  parts[2] += 1
} else {
  parts[0] = 0
  parts[1] = 1
  parts[2] = 1
}

const nextVersion = parts.join('.')
console.log(`\n==> Incrementing version: v${currentVersion} -> v${nextVersion}`)

pkg.version = nextVersion
tauriConf.version = nextVersion

fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8')

// 3. Git commit & push
const commitMsg = process.argv.slice(2).join(' ').trim() || `feat: release v${nextVersion}`
console.log(`\n==> Pushing updated code and version to GitHub ("${commitMsg}")...`)

try {
  execSync('git add .', { cwd: rootDir, stdio: 'inherit' })
  try {
    execSync(`git commit -m "${commitMsg}"`, { cwd: rootDir, stdio: 'inherit' })
  } catch {
    console.log('(No extra changes to commit besides version bump)')
  }
  execSync('git push origin main', { cwd: rootDir, stdio: 'inherit' })
} catch (err) {
  console.warn('[Warning] Git push encountered an issue, proceeding with local build...', err.message)
}

// 4. Build & Cryptographically Sign
console.log(`\n==> Compiling and cryptographically signing release binaries...`)
const buildEnv = {
  ...process.env,
  TAURI_SIGNING_PRIVATE_KEY_PATH: keyPath,
}

try {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit', env: buildEnv })
  execSync('npx @tauri-apps/cli build', { cwd: rootDir, stdio: 'inherit', env: buildEnv })
} catch (err) {
  console.error('\n[ERROR] Tauri build failed. Check compiler output above.')
  process.exit(1)
}

// 5. Gather all release assets into a clean folder
const distFolder = path.join(rootDir, 'dist_release', `v${nextVersion}`)
if (fs.existsSync(distFolder)) {
  fs.rmSync(distFolder, { recursive: true, force: true })
}
fs.mkdirSync(distFolder, { recursive: true })

const bundleDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle')

function copyAssets(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      copyAssets(fullPath)
    } else {
      const lower = entry.name.toLowerCase()
      if (
        lower.endsWith('.exe') ||
        lower.endsWith('.msi') ||
        lower.endsWith('.json') ||
        lower.endsWith('.zip') ||
        lower.endsWith('.sig') ||
        lower.endsWith('.tar.gz')
      ) {
        fs.copyFileSync(fullPath, path.join(distFolder, entry.name))
        console.log(`  + Packaged: ${entry.name}`)
      }
    }
  }
}

console.log(`\n==> Collecting release assets into: ${distFolder}`)
copyAssets(bundleDir)

console.log('\n==================================================')
console.log(`  RELEASE v${nextVersion} READY FOR GITHUB!  `)
console.log('==================================================')
console.log(`Folder: ${distFolder}\n`)

// 6. Open release folder & GitHub release page
if (process.platform === 'win32') {
  try {
    execSync(`explorer.exe "${distFolder}"`)
    const releaseUrl = `https://github.com/byronjreyes/Agent-Job/releases/new?tag=v${nextVersion}&title=AgentJob%20v${nextVersion}`
    execSync(`start "" "${releaseUrl}"`)
  } catch {}
}

console.log('-> Browser & Folder opened! Drag and drop all files into GitHub and click "Publish release"!\n')
