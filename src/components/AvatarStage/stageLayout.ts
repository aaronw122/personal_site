export const FLOOR_PX = 30;
const PEEK_LIFT_VH = 21.8;
const PEEK_LIFT_PX = 48;
export const PEEK_BOTTOM = `round(calc(${PEEK_LIFT_VH}vh + ${FLOOR_PX + PEEK_LIFT_PX}px), 1px)`;
export const peekBottomPx = () =>
  Math.round(
    (window.innerHeight * PEEK_LIFT_VH) / 100 + FLOOR_PX + PEEK_LIFT_PX,
  );
export const PEEK_BOX = { width: 96, height: 134 };
export const PEEK_OUT = 3;
export const STAGE_WIDTH = 174;
export const FIGURE_PX = 240;
export const stageScenePx = () => 1 / FIGURE_PX;
