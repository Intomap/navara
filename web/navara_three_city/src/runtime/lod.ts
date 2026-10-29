export function updateDetailState(
  current: boolean,
  distance: number,
  enterDistance: number,
  exitRatio: number,
): boolean {
  if (current && distance >= enterDistance * exitRatio) return false;
  if (!current && distance < enterDistance) return true;
  return current;
}
