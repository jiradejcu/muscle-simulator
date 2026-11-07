import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { wrapSegment } from '../musclePath'

describe('wrapSegment (cylinder wrap)', () => {
  const C = new Vector3(0, 0, 0)
  const Z = new Vector3(0, 0, 1)
  // Travelling along +X with the axis +Z: winding -1 (clockwise) keeps the path above the centre.
  it('returns the straight distance when the line clears the cylinder on the correct side', () => {
    expect(wrapSegment(new Vector3(-3, 2, 0), new Vector3(3, 2, 0), C, 1, Z, -1)).toBeCloseTo(6, 6)
  })
  it('wraps over the top: tangent + arc + tangent', () => {
    expect(wrapSegment(new Vector3(-3, 0.5, 0), new Vector3(3, 0.5, 0), C, 1, Z, -1)).toBeCloseTo(6.083, 2)
  })
  it('wraps underneath with the opposite winding', () => {
    expect(wrapSegment(new Vector3(-3, 0.5, 0), new Vector3(3, 0.5, 0), C, 1, Z, 1)).toBeCloseTo(6.746, 2)
  })
  it('wraps around the required side even when the line passes on the other side', () => {
    expect(wrapSegment(new Vector3(-3, 1.5, 0), new Vector3(3, 1.5, 0), C, 1, Z, 1)).toBeGreaterThan(6.5)
  })
  it('adds the axial offset as a helix', () => {
    const flat = wrapSegment(new Vector3(-3, 0.5, 0), new Vector3(3, 0.5, 0), C, 1, Z, -1)
    const helix = wrapSegment(new Vector3(-3, 0.5, 0), new Vector3(3, 0.5, 2), C, 1, Z, -1)
    expect(helix).toBeCloseTo(Math.hypot(flat, 2), 6)
  })
  it('keeps a constant moment arm equal to the radius while wrapped', () => {
    // S rotates about the axis; while wrapped, dL/dtheta should equal r.
    const P = new Vector3(0, -3, 0)
    const lengths: number[] = []
    for (let a = 150; a <= 250; a += 1) {
      const t = (a * Math.PI) / 180
      lengths.push(wrapSegment(P, new Vector3(3 * Math.sin(t), -3 * Math.cos(t), 0), C, 1, Z, 1))
    }
    for (let i = 1; i < lengths.length; i++) expect(Math.abs((lengths[i] - lengths[i - 1]) / (Math.PI / 180))).toBeCloseTo(1, 2)
  })
  it('is continuous as the end point rotates around the centre', () => {
    let prev = -1
    for (let a = 0; a <= 200; a += 1) {
      const t = (a * Math.PI) / 180
      const len = wrapSegment(new Vector3(-0.5, -3, 0), new Vector3(3 * Math.cos(t), 3 * Math.sin(t), 0), C, 1, Z, 1)
      if (prev > 0) expect(Math.abs(len - prev)).toBeLessThan(0.08)
      prev = len
    }
  })
})
