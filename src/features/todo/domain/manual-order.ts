export function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) {
    return [...items];
  }
  const result = [...items];
  const [item] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, item);
  return result;
}

export function reorderById<T extends { id: string }>(items: readonly T[], activeId: string, overId: string): T[] {
  return moveItem(items, items.findIndex((item) => item.id === activeId), items.findIndex((item) => item.id === overId));
}
