import { memo } from 'react';
import type { Item } from '../../../ecs/world';

function normalizeLvl(lvl: number) {
  if (lvl < 3) return 0;
  if (lvl < 5) return 3;
  if (lvl < 7) return 5;
  if (lvl < 9) return 7;
  if (lvl < 11) return 9;
  if (lvl < 13) return 11;
  if (lvl < 15) return 13;
  return 15;
}

export const ItemIcon = memo(({ group, num, lvl, isExcellent }: Item) => {
  const normalizedLvl = normalizeLvl(lvl ?? 0);

  return (
    <img
      src={`${(typeof window !== 'undefined' && (window as any).MU_ASSETS?.itemsBase) || '/items/'}item_${group}_${num}_${normalizedLvl}${
        isExcellent ? '_e' : ''
      }.png`}
      className="item-icon"
      alt="icon"
      draggable={false}
    />
  );
});
