import { describe, expect, it } from 'vitest'
import { deleteDigit, emptyEntry, entryFromCode, entryValue, isFull, moveCursor, typeDigit, type Entry } from './entry'

const typeAll = (e: Entry, s: string) => [...s].reduce(typeDigit, e)

describe('entry', () => {
  it('fills from the leftmost digit by default', () => {
    const e = typeAll(emptyEntry(), '123')
    expect(e.digits).toEqual(['1', '2', '3', ''])
    expect(e.cursor).toBe(3)
    const full = typeDigit(e, '4')
    expect(entryValue(full)).toBe('1234')
    expect(isFull(full)).toBe(true)
    expect(full.cursor).toBe(4)
  })

  it('types into a selected slot and then moves to the next empty one, wrapping around', () => {
    let e = typeDigit(moveCursor(emptyEntry(), 2), '7')
    expect(e.digits).toEqual(['', '', '7', ''])
    expect(e.cursor).toBe(3)
    e = typeDigit(e, '8')
    expect(e.cursor).toBe(0)
    e = typeAll(e, '12')
    expect(entryValue(e)).toBe('1278')
    expect(e.cursor).toBe(4)
  })

  it('overwrites a filled slot when it is selected', () => {
    const e = typeDigit(moveCursor(entryFromCode('1234'), 1), '9')
    expect(entryValue(e)).toBe('1934')
    expect(e.cursor).toBe(4)
  })

  it('ignores typing when every slot is filled and nothing is selected', () => {
    const e = entryFromCode('1234')
    expect(typeDigit(e, '5')).toBe(e)
  })

  it('backspaces like a text field in the default order', () => {
    let e = deleteDigit(typeAll(emptyEntry(), '1234'))
    expect(e.digits).toEqual(['1', '2', '3', ''])
    expect(e.cursor).toBe(3)
    e = deleteDigit(e)
    expect(e.digits).toEqual(['1', '2', '', ''])
    expect(e.cursor).toBe(2)
  })

  it('deletes the selected digit in place', () => {
    const e = deleteDigit(moveCursor(entryFromCode('1234'), 1))
    expect(e.digits).toEqual(['1', '', '3', '4'])
    expect(e.cursor).toBe(1)
  })

  it('does nothing when there is nothing to delete to the left', () => {
    const e = typeDigit(moveCursor(emptyEntry(), 2), '5')
    const moved = moveCursor(e, 1)
    expect(deleteDigit(moved)).toBe(moved)
  })

  it('clamps cursor moves to the slots', () => {
    expect(moveCursor(emptyEntry(), -1).cursor).toBe(0)
    expect(moveCursor(emptyEntry(), 9).cursor).toBe(3)
  })
})
