import {
  Color3,
  PointerEventTypes,
  Ray,
  Vector3,
} from '../../libs/babylon/exports';
import type { EntityTypeFromQuery, ISystemFactory } from '../world';

const COLOR_RED = new Color3(1, 0, 0);

export const PointerInputSystem: ISystemFactory = world => {
  const scene = world.scene;

  const tmpCameraRay = new Ray(Vector3.Zero(), Vector3.Up(), 1);

  const query = world.with(
    'modelObject',
    'visibility',
    'transform',
    'interactable'
  );

  scene.onPointerObservable.add(ev => {
    const pickInfo = scene.pick(ev.event.clientX, ev.event.clientY);

    const ray = pickInfo.ray;
    if (ray) {
      tmpCameraRay.direction.copyFrom(ray.direction);
      tmpCameraRay.origin.copyFrom(ray.origin);
      tmpCameraRay.length = ray.length;
    } else {
      tmpCameraRay.direction.set(0, 0, 1);
      tmpCameraRay.origin.set(0, 0, 0);
      tmpCameraRay.length = 0.01;
    }

    if (ev.type === PointerEventTypes.POINTERDOWN) {
      world.pointerPressed = true;
    } else if (ev.type === PointerEventTypes.POINTERUP) {
      world.pointerPressed = false;
    }
  });

  window.addEventListener('lostpointercapture', ev => {
    world.pointerPressed = false;
  });

  let delay = 0;

  const possibleTargets: EntityTypeFromQuery<typeof query>[] = [];

  return {
    update: dt => {
      delay -= dt;
      if (delay > 0) return;
      delay = 0.05;

      possibleTargets.length = 0;

      for (const e of query) {
        const { modelObject, visibility, attributeSystem, highlighted } = e;

        if (!modelObject.Ready) continue;
        if (!attributeSystem) continue;
        if (visibility.state === 'hidden') continue;

        modelObject.UpdateBoundings();
        const bb = modelObject.BoundingBoxLocal;

        const intersects = tmpCameraRay.intersectsBoxMinMax(
          bb.minimumWorld,
          bb.maximumWorld
        );

        if (intersects) {
          possibleTargets.push(e);
        }
      }

      const oldTarget = world.currentPointerTarget;

      if (possibleTargets.length > 0) {
        world.currentPointerTarget = possibleTargets[0];
      } else {
        world.currentPointerTarget = null;
      }

      if (oldTarget !== world.currentPointerTarget) {
        if (oldTarget && oldTarget.highlighted) {
          world.removeComponent(oldTarget, 'highlighted');
        }
      }

      if (
        world.currentPointerTarget &&
        !world.currentPointerTarget.highlighted
      ) {
        world.addComponent(world.currentPointerTarget, 'highlighted', {
          color: COLOR_RED,
          layer: null,
        });
      }
    },
  };
};
