import { Vector3, type ArcRotateCamera } from '../../libs/babylon/exports';
import type { ISystemFactory } from '../world';

const v3Temp = Vector3.Zero();

export const CameraFollowSystem: ISystemFactory = world => {
  const scene = world.scene;

  return {
    update: () => {
      const camera = scene.activeCamera as ArcRotateCamera;

      if (!camera) return;

      const playerEntity = world.playerEntity;
      if (!playerEntity) return;

      v3Temp.copyFrom(playerEntity.transform.pos as any);

      if (playerEntity.transform.posOffset !== undefined) {
        v3Temp.addInPlace(playerEntity.transform.posOffset as any);
      }

      camera.target.copyFrom(v3Temp);
    },
  };
};
