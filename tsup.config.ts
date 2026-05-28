import { defineConfig } from 'tsup'

// Optional email-provider packages — only installed by users who need them.
// We intercept their imports via an esbuild onResolve plugin BEFORE esbuild
// tries to load them from disk (which would fail if they aren't installed).
const OPTIONAL_EMAIL_PACKAGES = ['nodemailer', 'resend', '@sendgrid/mail']
const optionalEmailExternals = {
  name: 'optional-email-packages',
  setup(build: { onResolve: (opts: object, cb: (args: { path: string }) => object) => void }) {
    const filter = /^(nodemailer|resend|@sendgrid\/mail)$/
    build.onResolve({ filter }, (args: { path: string }) => ({
      path: args.path,
      external: true,
    }))
  },
}

export default defineConfig({
  entry: {
    cli: 'src/cli/index.ts',
    'server/index': 'src/server/index.ts',
  },
  format: ['esm'],
  target: 'node18',
  clean: false,
  splitting: false,
  sourcemap: false,
  shims: true,
  noExternal: [],
  external: OPTIONAL_EMAIL_PACKAGES,
  esbuildOptions(options) {
    options.plugins = [optionalEmailExternals, ...(options.plugins ?? [])]
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
})
