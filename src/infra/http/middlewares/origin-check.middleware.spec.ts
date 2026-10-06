import { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { originCheck } from './origin-check.middleware'

const ALLOWED = 'http://localhost:5173'

function makeRequest(method: string, origin?: string) {
  return { method, headers: origin ? { origin } : {} } as Request
}

function makeResponse() {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)

  return res as unknown as Response & typeof res
}

let sut: ReturnType<typeof originCheck>

describe('Origin Check Middleware', () => {
  beforeEach(() => {
    sut = originCheck([ALLOWED])
  })

  it('should be able to pass a request from an allowed origin', () => {
    const next = vi.fn()

    sut(makeRequest('POST', ALLOWED), makeResponse(), next)

    expect(next).toHaveBeenCalled()
  })

  it('should be able to pass a request without origin', () => {
    const next = vi.fn()

    sut(makeRequest('DELETE'), makeResponse(), next)

    expect(next).toHaveBeenCalled()
  })

  it('should be able to pass a safe method from any origin', () => {
    const next = vi.fn()

    sut(makeRequest('GET', 'https://evil.example'), makeResponse(), next)

    expect(next).toHaveBeenCalled()
  })

  it('should not be able to pass an unsafe method from another origin', () => {
    const next = vi.fn()
    const res = makeResponse()

    sut(makeRequest('POST', 'https://evil.example'), res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
