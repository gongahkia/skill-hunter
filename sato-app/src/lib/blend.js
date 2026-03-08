function roundToTwo(value) {
  return Number(Number(value).toFixed(2))
}

function toBasisPoints(value) {
  return Math.max(0, Math.min(10000, Math.round(Number(value || 0) * 100)))
}

function fromBasisPoints(value) {
  return roundToTwo(value / 100)
}

function activeMembers(members) {
  return members.filter((member) => member.hasContribution)
}

function distributeEvenly(totalBasisPoints, members) {
  if (!members.length) {
    return new Map()
  }

  const baseWeight = Math.floor(totalBasisPoints / members.length)
  let extraWeight = totalBasisPoints - (baseWeight * members.length)
  const allocations = new Map()

  members.forEach((member) => {
    const nextWeight = baseWeight + (extraWeight > 0 ? 1 : 0)
    if (extraWeight > 0) {
      extraWeight -= 1
    }
    allocations.set(member.id, nextWeight)
  })

  return allocations
}

function allocateByCurrentShare(totalBasisPoints, members) {
  const currentTotal = members.reduce((sum, member) => sum + toBasisPoints(member.weight), 0)
  if (currentTotal <= 0) {
    return distributeEvenly(totalBasisPoints, members)
  }

  const rawAllocations = members.map((member) => {
    const rawWeight = (toBasisPoints(member.weight) / currentTotal) * totalBasisPoints
    const floorWeight = Math.floor(rawWeight)
    return {
      id: member.id,
      floorWeight,
      remainder: rawWeight - floorWeight,
    }
  })

  let remaining = totalBasisPoints - rawAllocations.reduce((sum, entry) => sum + entry.floorWeight, 0)
  rawAllocations
    .sort((left, right) => right.remainder - left.remainder || left.id.localeCompare(right.id))
    .forEach((entry) => {
      if (remaining <= 0) {
        return
      }
      entry.floorWeight += 1
      remaining -= 1
    })

  return new Map(rawAllocations.map((entry) => [entry.id, entry.floorWeight]))
}

export function distributeMemberWeights(members) {
  const contributors = activeMembers(members)
  const allocations = distributeEvenly(10000, contributors)

  return members.map((member) => ({
    ...member,
    weight: member.hasContribution ? fromBasisPoints(allocations.get(member.id) || 0) : 0,
  }))
}

export function normalizeMemberWeights(members, targetMemberId, nextWeight) {
  const contributors = activeMembers(members)
  if (!contributors.length) {
    return members.map((member) => ({
      ...member,
      weight: 0,
    }))
  }

  const targetMember = contributors.find((member) => member.id === targetMemberId)
  if (!targetMember) {
    return distributeMemberWeights(members)
  }

  if (contributors.length === 1) {
    return members.map((member) => ({
      ...member,
      weight: member.id === targetMemberId ? 100 : 0,
    }))
  }

  const nextTargetWeight = toBasisPoints(nextWeight)
  const remainingWeight = Math.max(0, 10000 - nextTargetWeight)
  const otherMembers = contributors.filter((member) => member.id !== targetMemberId)
  const allocations = allocateByCurrentShare(remainingWeight, otherMembers)

  return members.map((member) => {
    if (!member.hasContribution) {
      return {
        ...member,
        weight: 0,
      }
    }

    if (member.id === targetMemberId) {
      return {
        ...member,
        weight: fromBasisPoints(nextTargetWeight),
      }
    }

    return {
      ...member,
      weight: fromBasisPoints(allocations.get(member.id) || 0),
    }
  })
}

export function emphasizeMemberWeights(members, targetMemberId, leadWeight = 60) {
  const contributors = activeMembers(members)
  if (!contributors.length) {
    return distributeMemberWeights(members)
  }

  if (contributors.length === 1) {
    return members.map((member) => ({
      ...member,
      weight: member.hasContribution ? 100 : 0,
    }))
  }

  const targetMember = contributors.find((member) => member.id === targetMemberId)
  if (!targetMember) {
    return distributeMemberWeights(members)
  }

  const targetWeight = Math.min(Math.max(Number(leadWeight), 0), 100)
  const remainingWeight = Math.max(0, 10000 - toBasisPoints(targetWeight))
  const otherMembers = contributors.filter((member) => member.id !== targetMemberId)
  const allocations = distributeEvenly(remainingWeight, otherMembers)

  return members.map((member) => {
    if (!member.hasContribution) {
      return {
        ...member,
        weight: 0,
      }
    }

    if (member.id === targetMemberId) {
      return {
        ...member,
        weight: roundToTwo(targetWeight),
      }
    }

    return {
      ...member,
      weight: fromBasisPoints(allocations.get(member.id) || 0),
    }
  })
}

export function totalAssignedWeight(members) {
  return roundToTwo(
    activeMembers(members)
      .reduce((total, member) => total + Number(member.weight || 0), 0),
  )
}

export function buildWeightsPayload(members) {
  return {
    members: activeMembers(members)
      .map((member) => ({
        id: member.id,
        weight: roundToTwo(member.weight || 0),
      })),
  }
}
