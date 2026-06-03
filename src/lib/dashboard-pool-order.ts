export function applySavedPoolOrder(savedOrder: string[], activePoolIds: string[]): string[] {
  const activeSet = new Set(activePoolIds)
  const ordered = savedOrder.filter(poolId => activeSet.has(poolId))
  const orderedSet = new Set(ordered)
  const newPoolIds = activePoolIds.filter(poolId => !orderedSet.has(poolId))
  return [...ordered, ...newPoolIds]
}

export function movePoolId(poolIds: string[], draggedPoolId: string, targetPoolId: string): string[] {
  if (draggedPoolId === targetPoolId) return poolIds
  if (!poolIds.includes(draggedPoolId) || !poolIds.includes(targetPoolId)) return poolIds

  const withoutDragged = poolIds.filter(poolId => poolId !== draggedPoolId)
  const targetIndex = withoutDragged.indexOf(targetPoolId)
  if (targetIndex < 0) return poolIds
  return [
    ...withoutDragged.slice(0, targetIndex),
    draggedPoolId,
    ...withoutDragged.slice(targetIndex),
  ]
}
