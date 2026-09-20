import type { ISystemFactory } from '../world';

export const CalculateVisibilitySystem: ISystemFactory = world => {
  const query = world.with('transform', 'visibility');

  const visibleRange = 16;
  const nearbyRange = 24;
  return {
    update: dt => {
      const playerEntity = world.playerEntity;
      if (!playerEntity) return;
      const terrain = world.terrain;
      if (!terrain) return;

      for (const { transform, visibility } of query) {
        visibility.lastChecked -= dt;

        if (visibility.lastChecked > 0) continue;

        const distance = Math.sqrt(
          Math.pow(transform.pos.x - playerEntity.transform.pos.x, 2) +
            Math.pow(transform.pos.z - playerEntity.transform.pos.z, 2)
        );

        if (distance <= visibleRange) {
          visibility.state = 'visible';
          visibility.lastChecked = 0.2;
        } else if (distance <= nearbyRange) {
          visibility.state = 'nearby';
          visibility.lastChecked = 0.3;
        } else {
          visibility.state = 'hidden';
          visibility.lastChecked = 1;
        }
      }
    },
  };
};
