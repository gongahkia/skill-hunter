function roundToTwo(value) {
  return Number(Number(value).toFixed(2))
}

export function distributeMemberWeights(members) {
  const activeMembers = members.filter((member) => member.hasContribution)
  if (!activeMembers.length) {
    return members.map((member) => ({
      ...member,
      weight: 0,
    }))
  }

  const remainingBasisPoints = 10000
  const baseWeight = Math.floor(remainingBasisPoints / activeMembers.length)
  let extraWeight = remainingBasisPoints - (baseWeight * activeMembers.length)

  return members.map((member) => {
    if (!member.hasContribution) {
      return {
        ...member,
        weight: 0,
      }
    }

    const nextWeight = baseWeight + (extraWeight > 0 ? 1 : 0)
    if (extraWeight > 0) {
      extraWeight -= 1
    }

    return {
      ...member,
      weight: roundToTwo(nextWeight / 100),
    }
  })
}

export function totalAssignedWeight(members) {
  return roundToTwo(
    members
      .filter((member) => member.hasContribution)
      .reduce((total, member) => total + Number(member.weight || 0), 0),
  )
}

export function buildWeightsPayload(members) {
  return {
    members: members
      .filter((member) => member.hasContribution)
      .map((member) => ({
        id: member.id,
        weight: roundToTwo(member.weight || 0),
      })),
  }
}
