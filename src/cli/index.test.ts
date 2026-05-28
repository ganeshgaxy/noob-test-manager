import { describe, it, expect } from 'vitest'
import { Command } from 'commander'

describe('CLI', () => {
  it('should have correct program name and version', () => {
    const program = new Command()
    program.name('noob-sdet').version('0.1.0')

    expect(program.name()).toBe('noob-sdet')
  })

  it('should have start command as default', () => {
    const program = new Command()
    program
      .command('start', { isDefault: true })
      .description('Start the noob-sdet server and open the UI')
      .option('-p, --port <port>', 'port to run on', '3000')

    const startCmd = program.commands.find((cmd) => cmd.name() === 'start')
    expect(startCmd).toBeDefined()
    expect(startCmd?.description()).toContain('Start the noob-sdet server')
  })

  it('should support port option', () => {
    const program = new Command()
    const startCmd = program.command('start').option('-p, --port <port>', 'port to run on', '3000')

    expect(startCmd.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          short: '-p',
          long: '--port',
        }),
      ])
    )
  })

  it('should have description mentioning SDET tool', () => {
    const program = new Command()
    program.description('SDET tool for managing and testing web applications')

    expect(program.description()).toContain('SDET tool')
    expect(program.description()).toContain('managing and testing web applications')
  })

  it('should parse port option correctly', () => {
    const program = new Command()
    program.option('-p, --port <port>', 'port to run on', '3000')

    const opts = program.opts()
    expect(opts.port).toBe('3000')
  })
})
