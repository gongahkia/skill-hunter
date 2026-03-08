import {
  buildWeightsPayload,
  distributeMemberWeights,
  emphasizeMemberWeights,
  normalizeMemberWeights,
  totalAssignedWeight,
} from './blend'

describe('room blend helpers', () => {
  it('balances contributing member weights to keep the total at 100', () => {
    const members = distributeMemberWeights([
      { id: 'alpha', hasContribution: true },
      { id: 'beta', hasContribution: true },
      { id: 'gamma', hasContribution: false },
    ])

    expect(totalAssignedWeight(members)).toBe(100)
    expect(members[2].weight).toBe(0)
  })

  it('builds the room weights payload from contributing members only', () => {
    const payload = buildWeightsPayload([
      { id: 'alpha', hasContribution: true, weight: 60 },
      { id: 'beta', hasContribution: false, weight: 0 },
      { id: 'gamma', hasContribution: true, weight: 40 },
    ])

    expect(payload).toEqual({
      members: [
        { id: 'alpha', weight: 60 },
        { id: 'gamma', weight: 40 },
      ],
    })
  })

  it('auto-normalizes the remaining members when one weight changes', () => {
    const members = normalizeMemberWeights([
      { id: 'alpha', hasContribution: true, weight: 50 },
      { id: 'beta', hasContribution: true, weight: 30 },
      { id: 'gamma', hasContribution: true, weight: 20 },
    ], 'alpha', 70)

    expect(totalAssignedWeight(members)).toBe(100)
    expect(members.find((member) => member.id === 'alpha').weight).toBe(70)
    expect(members.find((member) => member.id === 'beta').weight).toBe(18)
    expect(members.find((member) => member.id === 'gamma').weight).toBe(12)
  })

  it('can apply a lead preset to one member while keeping the total at 100', () => {
    const members = emphasizeMemberWeights([
      { id: 'host', hasContribution: true, weight: 33.34 },
      { id: 'guest', hasContribution: true, weight: 33.33 },
      { id: 'ally', hasContribution: true, weight: 33.33 },
    ], 'host', 60)

    expect(totalAssignedWeight(members)).toBe(100)
    expect(members.find((member) => member.id === 'host').weight).toBe(60)
    expect(members.find((member) => member.id === 'guest').weight).toBe(20)
    expect(members.find((member) => member.id === 'ally').weight).toBe(20)
  })
})
