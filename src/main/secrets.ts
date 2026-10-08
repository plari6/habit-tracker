import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import type { CoachStatus } from '@shared/types'

// The API key is encrypted with the OS keystore (DPAPI on Windows) before it
// touches disk, so the file is useless outside this user account.
export class Secrets {
  private file: string

  constructor(dataDir: string) {
    this.file = join(dataDir, 'anthropic-key.bin')
  }

  apiKey(): string | null {
    if (!existsSync(this.file) || !safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(readFileSync(this.file))
    } catch {
      return null
    }
  }

  setApiKey(key: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS encryption is unavailable, so the key was not saved.')
    }
    writeFileSync(this.file, safeStorage.encryptString(key))
  }

  clearApiKey(): void {
    rmSync(this.file, { force: true })
  }

  status(): CoachStatus {
    if (this.apiKey()) return { hasKey: true, source: 'stored' }
    if (process.env.ANTHROPIC_API_KEY) return { hasKey: true, source: 'env' }
    return { hasKey: false, source: null }
  }
}
