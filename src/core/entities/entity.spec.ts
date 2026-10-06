import { describe, expect, it } from 'vitest'
import { Entity } from './entity'
import { UniqueEntityId } from './unique-entity-id'

class Dummy extends Entity<{ name: string }> {
  static create(props: { name: string }, id?: UniqueEntityId) {
    return new Dummy(props, id)
  }
}

describe('Entity', () => {
  it('should generate an id when none is given', () => {
    const entity = Dummy.create({ name: 'a' })

    expect(entity.id.toValue()).toEqual(expect.any(String))
  })

  it('should be equal to another entity with the same id', () => {
    const a = Dummy.create({ name: 'a' }, new UniqueEntityId('same-id'))
    const b = Dummy.create({ name: 'b' }, new UniqueEntityId('same-id'))

    expect(a.equals(b)).toBe(true)
  })

  it('should not be equal to an entity with a different id', () => {
    const a = Dummy.create({ name: 'a' })
    const b = Dummy.create({ name: 'a' })

    expect(a.equals(b)).toBe(false)
  })
})
