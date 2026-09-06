export const HOME_WIDGETS = {
  clock: 'Clock', weather: 'Weather', countdowns: 'Countdowns', today: 'Today’s events',
  tasks: 'Tasks', chores: 'Chores', meals: 'Today’s meals', groceries: 'Groceries',
  school: 'School', personal: 'Us', notes: 'Pinned notes',
} as const;
export type HomeWidgetId = keyof typeof HOME_WIDGETS;
export interface HomeLayoutValue { version: 1; columns: HomeWidgetId[][]; hidden: HomeWidgetId[] }
const defaults: HomeWidgetId[][] = [
  ['clock', 'weather', 'countdowns'], ['today', 'tasks', 'chores'],
  ['meals', 'groceries', 'school', 'personal', 'notes'],
];
export function defaultHomeLayout(): HomeLayoutValue {
  return { version: 1, columns: defaults.map(c => [...c]), hidden: [] };
}
function isWidget(value: unknown): value is HomeWidgetId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HOME_WIDGETS, value);
}
export function normalizeHomeLayout(value: unknown): HomeLayoutValue {
  if (!value || typeof value !== 'object') return defaultHomeLayout();
  const raw = value as Partial<HomeLayoutValue>;
  if (raw.version !== 1 || !Array.isArray(raw.columns) || !raw.columns.length) return defaultHomeLayout();
  const seen = new Set<HomeWidgetId>();
  const columns = raw.columns.slice(0, 3).map(column => {
    if (!Array.isArray(column)) return [];
    return column.filter(id => {
      if (!isWidget(id) || seen.has(id)) return false;
      seen.add(id); return true;
    });
  });
  defaults.forEach((column, index) => column.forEach(id => {
    if (!seen.has(id)) columns[Math.min(index, columns.length - 1)].push(id);
  }));
  return { version: 1, columns, hidden: Array.isArray(raw.hidden) ? [...new Set(raw.hidden.filter(isWidget))] : [] };
}
export function moveHomeWidget(layout: HomeLayoutValue, id: HomeWidgetId, column: number, position: number): HomeLayoutValue {
  if (column < 0 || column >= layout.columns.length) return layout;
  const columns = layout.columns.map(c => c.filter(item => item !== id));
  columns[column].splice(Math.max(0, Math.min(position, columns[column].length)), 0, id);
  return { ...layout, columns };
}
export function resizeHomeColumns(layout: HomeLayoutValue, count: number): HomeLayoutValue {
  count = Math.max(1, Math.min(3, count));
  const columns = layout.columns.map(c => [...c]);
  while (columns.length > count) columns[count - 1].push(...columns.splice(count, 1)[0]);
  while (columns.length < count) columns.push([]);
  return { ...layout, columns };
}
