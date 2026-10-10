import { describe, expect, it } from 'vitest'
import { findPeerGroup } from './peer-groups'

describe('Peer Groups', () => {
  it('should find the group of a ticker regardless of case and spaces', () => {
    expect(findPeerGroup(' itub4 ')?.key).toBe('BANKS')
  })

  it('should return null for a ticker outside every group', () => {
    expect(findPeerGroup('PETR4')).toBeNull()
  })
})
