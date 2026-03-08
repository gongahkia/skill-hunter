import {
  buildWeightsPayload,
  distributeMemberWeights,
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
})
