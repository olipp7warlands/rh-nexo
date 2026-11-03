// Única gama cromática permitida en gráficos (guía Editorial): azul tinta apagado, en degradado según
// el valor (más oscuro = mayor). No es un color de marca — es la codificación del propio dato.
const INK_BLUE_LIGHT = { r: 199, g: 207, b: 218 }; // tinte más pálido, valores bajos
const INK_BLUE_DARK = { r: 58, g: 74, b: 99 }; // #3A4A63, valor máximo de cada gráfico

export function inkBlueShade(ratio: number): string {
  const t = 0.25 + 0.75 * Math.max(0, Math.min(1, ratio)); // suelo del 25% para que nada quede casi blanco
  const lerp = (light: number, dark: number) => Math.round(light + (dark - light) * t);
  return `rgb(${lerp(INK_BLUE_LIGHT.r, INK_BLUE_DARK.r)}, ${lerp(INK_BLUE_LIGHT.g, INK_BLUE_DARK.g)}, ${lerp(INK_BLUE_LIGHT.b, INK_BLUE_DARK.b)})`;
}

export function BarList({ items }: { items: { label: string; value: number; display?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((i) => (
        <div key={i.label}>
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-[var(--ink-secondary)]">{i.label}</span>
            <span className="mono font-medium">{i.display ?? i.value}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: inkBlueShade(i.value / max) }} />
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-[12px] text-[var(--ink-tertiary)]">Sin datos.</p>}
    </div>
  );
}
