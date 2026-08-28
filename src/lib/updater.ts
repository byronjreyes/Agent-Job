import { check, type Update } from '@tauri-apps/plugin-updater'
import { isTauri } from './bridge'

export interface UpdateInfo {
  available: boolean
  currentVersion: string
  version?: string
  date?: string
  notes?: string
}

export type UpdateProgressCallback = (downloaded: number, total: number | null) => void

let pendingUpdate: Update | null = null

export async function checkForAppUpdate(): Promise<UpdateInfo> {
  const currentVersion = '0.1.0'
  if (!isTauri()) {
    return {
      available: false,
      currentVersion,
      notes: 'Updater is available in the desktop application.',
    }
  }

  try {
    const update = await check()
    if (update && update.available) {
      pendingUpdate = update
      return {
        available: true,
        currentVersion: update.currentVersion || currentVersion,
        version: update.version,
        date: update.date,
        notes: update.body || 'New features, improvements, and fixes available in this release.',
      }
    }
    pendingUpdate = null
    return {
      available: false,
      currentVersion: update?.currentVersion || currentVersion,
    }
  } catch (error) {
    pendingUpdate = null
    throw error
  }
}

export async function downloadAndInstallUpdate(onProgress?: UpdateProgressCallback): Promise<void> {
  if (!pendingUpdate) {
    throw new Error('No pending update to install.')
  }

  let totalBytes: number | null = null
  let downloadedBytes = 0

  await pendingUpdate.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        totalBytes = event.data.contentLength ?? null
        onProgress?.(0, totalBytes)
        break
      case 'Progress':
        downloadedBytes += event.data.chunkLength
        onProgress?.(downloadedBytes, totalBytes)
        break
      case 'Finished':
        onProgress?.(totalBytes ?? downloadedBytes, totalBytes)
        break
    }
  })
}
