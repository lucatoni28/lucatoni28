import { Vector3 } from '../../libs/babylon/exports';
import { ISystemFactory } from '../world';

const v3Temp = Vector3.Zero();
const v3Temp2 = Vector3.Zero();

export const RenderSystem: ISystemFactory = world => {
  const query = world.with('transform', 'modelObject');

  return {
    update: () => {
      const terrain = world.terrain;
      if (!terrain) return;

      const extraHeight = terrain.extraHeight;

      for (const { transform, modelObject } of query) {
        modelObject.Update(world.gameTime);

        v3Temp.copyFrom(transform.rot as any);
        v3Temp.y = Math.PI * 2 - v3Temp.y;

        v3Temp2.copyFrom(transform.pos as any);
        if (transform.posOffset !== undefined) {
          v3Temp2.addInPlace(transform.posOffset as any);
        }

        // v3Temp2.y += extraHeight;

        modelObject.updateLocation(v3Temp2, transform.scale, v3Temp);

        modelObject.Draw(world.gameTime);
      }
    },
  };
};
