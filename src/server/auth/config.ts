import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve } from 'path'

// ─── Email Provider Types ─────────────────────────────────────────────────────

export type EmailProviderType = 'smtp' | 'resend' | 'sendgrid'

export interface SmtpEmailProvider {
  type: 'smtp'
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export interface ResendEmailProvider {
  type: 'resend'
  apiKey: string
  from: string
}

export interface SendgridEmailProvider {
  type: 'sendgrid'
  apiKey: string
  from: string
}

export type EmailProvider = SmtpEmailProvider | ResendEmailProvider | SendgridEmailProvider

// ─── Password Reset Types ─────────────────────────────────────────────────────

export interface AdminPasswordReset {
  type: 'admin'
}

export interface EmailPasswordReset {
  type: 'email'
  emailProvider: EmailProvider
}

export type PasswordResetConfig = AdminPasswordReset | EmailPasswordReset

// ─── SSO Types ───────────────────────────────────────────────────────────────

export interface OidcSsoConfig {
  type: 'oidc'
  clientId: string
  clientSecret: string
  /** OIDC Issuer URL — discovery doc fetched from {discoveryUrl}/.well-known/openid-configuration */
  discoveryUrl: string
  /** Auto-create a user account on first SSO sign-in (default: true) */
  autoProvision?: boolean
}

export interface GithubSsoConfig {
  type: 'github'
  clientId: string
  clientSecret: string
  /** Auto-create a user account on first SSO sign-in (default: true) */
  autoProvision?: boolean
}

export type SsoConfig = OidcSsoConfig | GithubSsoConfig

// ─── Auth Config ──────────────────────────────────────────────────────────────

export interface AuthConfig {
  /** How long browser sessions last in days (default: 7) */
  sessionDays?: number
  passwordReset: PasswordResetConfig
  /** Optional SSO configuration — omit to disable SSO */
  sso?: SsoConfig
}

const CONFIG_PATH = resolve(process.cwd(), 'noob-sdet.config.json')

export function defaultAuthConfig(): AuthConfig {
  return {
    sessionDays: 7,
    passwordReset: { type: 'admin' },
  }
}

/** Returns the active auth config from noob-sdet.config.json, falling back to defaults. */
export async function readAuthConfig(): Promise<AuthConfig> {
  if (!existsSync(CONFIG_PATH)) return defaultAuthConfig()
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const cfg = parsed.auth as Partial<AuthConfig> | undefined
    if (cfg) {
      return {
        ...defaultAuthConfig(),
        ...cfg,
        passwordReset: cfg.passwordReset ?? defaultAuthConfig().passwordReset,
      }
    }
  } catch {
    // fall through
  }
  return defaultAuthConfig()
}

/** Persists the auth config to noob-sdet.config.json (merges with existing keys). */
export async function writeAuthConfig(config: AuthConfig): Promise<void> {
  let existing: Record<string, unknown> = {}
  if (existsSync(CONFIG_PATH)) {
    try {
      existing = JSON.parse(await readFile(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
    } catch {
      // ignore — overwrite
    }
  }
  await writeFile(CONFIG_PATH, JSON.stringify({ ...existing, auth: config }, null, 2), 'utf-8')
}
