import { describe, expect, it } from 'vitest'
import { pickRememberedCamera } from './camera'

const cams = [
  { id: 'id-a', name: 'Integrated Camera' },
  { id: 'id-b', name: 'ACER HD User Facing' }
]

describe('pickRememberedCamera', () => {
  it('returns the remembered camera when it is still connected', () => {
    expect(pickRememberedCamera(cams, { id: 'id-b', name: 'ACER HD User Facing' })).toEqual(cams[1])
  })

  it('falls back to the name when the device id changed', () => {
    expect(pickRememberedCamera(cams, { id: 'old-id', name: 'ACER HD User Facing' })).toEqual(
      cams[1]
    )
  })

  it('returns null when the remembered camera is gone', () => {
    expect(pickRememberedCamera(cams, { id: 'x', name: 'USB Cam' })).toBeNull()
  })

  it('returns null when nothing was remembered', () => {
    expect(pickRememberedCamera(cams, null)).toBeNull()
  })
})
