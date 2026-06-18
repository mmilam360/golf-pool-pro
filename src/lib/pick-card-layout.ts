export function pickGridColumnCount(count: number) {
  if (count <= 0) return 1
  if (count <= 3) return count
  if (count === 6) return 3
  if (count === 12) return 4
  if (count % 5 === 0) return 5
  if (count % 4 === 0) return 4
  if (count % 3 === 0) return 3
  return Math.min(4, Math.ceil(count / 2))
}
