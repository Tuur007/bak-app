// Look A "Scandi terracotta": kalkwit, terracotta (actie), donkergroen (structuur),
// bordeaux (kleine punch: nu, let op). Contrast: inkt 13,4:1, terracotta 4,7:1 op kalkwit;
// terracotta nooit als kleine tekst op blush (3,7:1). Randen van velden en schakelaars (`edge`) halen 3:1 (WCAG 1.4.11).
export const colors = {
  bg: '#F6F0E6',
  card: '#FCF9F4',
  ink: '#2A2522',
  mut: '#625850', // 4,8:1 ook op blush
  edge: '#857B72', // randen van velden en schakelaars: minstens 3:1 op kaart en kalkwit
  ter: '#B04E33',
  grn: '#2F4A3E',
  bor: '#6B2737',
  blush: '#EBD2C4',
  line: '#E3D8C8',
  white: '#FFFFFF',
  crust: ['#E3B97E', '#C98A45', '#9A5B25', '#6A3A17'],
} as const;

export const fonts = {
  title: 'YoungSerif_400Regular',
  body: 'Figtree_400Regular',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const;

/** 8px-raster */
export const space = (n: number): number => n * 8;

export const radius = { card: 20, field: 14, pill: 999 } as const;
