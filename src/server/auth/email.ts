import type {
  EmailProvider,
  SmtpEmailProvider,
  ResendEmailProvider,
  SendgridEmailProvider,
} from './config.js'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface EmailSender {
  send(to: string, subject: string, html: string): Promise<void>
}

// ─── SMTP (Nodemailer) ────────────────────────────────────────────────────────

async function makeSmtpSender(cfg: SmtpEmailProvider): Promise<EmailSender> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodemailer = (await import('nodemailer')) as any
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  })
  return {
    async send(to, subject, html) {
      await transporter.sendMail({ from: cfg.from, to, subject, html })
    },
  }
}

// ─── Resend ───────────────────────────────────────────────────────────────────

async function makeResendSender(cfg: ResendEmailProvider): Promise<EmailSender> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Resend } = (await import('resend')) as any
  const resend = new Resend(cfg.apiKey)
  return {
    async send(to, subject, html) {
      const result = await resend.emails.send({ from: cfg.from, to, subject, html })
      if (result.error) throw new Error(`Resend error: ${result.error.message}`)
    },
  }
}

// ─── SendGrid ─────────────────────────────────────────────────────────────────

async function makeSendgridSender(cfg: SendgridEmailProvider): Promise<EmailSender> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sgMail = (await import('@sendgrid/mail')) as any
  sgMail.setApiKey(cfg.apiKey)
  return {
    async send(to, subject, html) {
      await sgMail.send({ from: cfg.from, to, subject, html })
    },
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Returns an EmailSender backed by whichever provider is configured. */
export async function makeEmailSender(provider: EmailProvider): Promise<EmailSender> {
  switch (provider.type) {
    case 'smtp':
      return makeSmtpSender(provider)
    case 'resend':
      return makeResendSender(provider)
    case 'sendgrid':
      return makeSendgridSender(provider)
  }
}

// ─── Test connection helper ───────────────────────────────────────────────────

/**
 * Sends a real test email to `to`. Returns `{ ok: true }` on success or
 * `{ ok: false, error: string }` on failure. Does NOT throw.
 */
export async function testEmailConnection(
  provider: EmailProvider,
  to: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sender = await makeEmailSender(provider)
    await sender.send(
      to,
      'noob-sdet — email connection test',
      '<p>Your email provider is configured correctly.</p>'
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Password reset email template ───────────────────────────────────────────

export function buildPasswordResetEmail(resetUrl: string, expiresInMinutes: number): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your noob-sdet account. Click the button below to set a new password.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
          Reset Password
        </a>
      </p>
      <p style="color:#71717a;font-size:13px">This link expires in ${expiresInMinutes} minutes. If you did not request a password reset, you can safely ignore this email.</p>
    </div>
  `
}
