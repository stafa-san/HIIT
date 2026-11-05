export const POSITION_NAMES: Record<string, string> = {
  QB: 'Quarterback',
  RB: 'Running back',
  FB: 'Fullback',
  WR: 'Wide receiver',
  TE: 'Tight end',
  OL: 'Offensive line',
  C: 'Center',
  DL: 'Defensive line',
  LB: 'Linebacker',
  CB: 'Cornerback',
  S: 'Safety',
  K: 'Kicker',
  P: 'Punter',
  LS: 'Long snapper',
};

export const positionName = (code: string) => POSITION_NAMES[code] ?? code;
