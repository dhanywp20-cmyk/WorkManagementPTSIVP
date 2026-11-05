export const Z = {
  base: 1,

  dropdown: 40,

  sticky: 50,

  picker: 55,

  sidebarScrim: 180,

  sidebar: 190,

  overlay: 1000,

  overlayTop: 1100,

  overlayMax: 1200,

  tour: 1500,
  tourRing: 1501,
  tourCard: 1502,
  tourNav: 1503,
  tourFab: 1504,
  tourSidebar: 1505,
  tourMenuItem: 1510,

  layarHost: 1900,

  blocking: 2000,

  sessionScrim: 2400,
  session: 2450,

  toast: 3000,

  tooltip: 3100,
} as const;

export type ZLayer = keyof typeof Z;
