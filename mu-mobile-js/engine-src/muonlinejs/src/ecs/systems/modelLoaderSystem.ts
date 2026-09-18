import { With } from 'miniplex';
import { MapPlayerNetClassToModelClass } from '../../common/mapPlayerNetClassToModelClass';
import { getModel, loadGLTF } from '../../common/modelLoader';
import { ModelObject } from '../../common/modelObject';
import { PlayerObject } from '../../common/playerObject';
import { Entity, ISystemFactory, World } from '../world';

const v3Temp = { x: 0, y: 0, z: 0 };

function createModelObject(
  world: World,
  entity: With<Entity, 'modelFactory' | 'worldIndex' | 'transform'>
) {
  const terrainScale = world.terrainScale;
  const transform = entity.transform;
  const modelId = entity.modelId;

  world.addComponent(
    entity,
    'modelObject',
    new entity.modelFactory(world.scene, world.mapParent)
  );

  const modelObject = entity.modelObject as any as ModelObject;
  modelObject.WorldIndex = entity.worldIndex;
  if (modelId !== undefined) {
    modelObject.Type = modelId;
  }

  v3Temp.x = transform.pos.x;
  v3Temp.y = transform.pos.y;
  v3Temp.z = transform.pos.z;

  modelObject.updateLocation(v3Temp, transform.scale, transform.rot);

  if (
    'playerClass' in modelObject &&
    entity.attributeSystem?.hasAttribute('playerNetClass')
  ) {
    (modelObject as PlayerObject).playerClass = MapPlayerNetClassToModelClass(
      entity.attributeSystem.getValue('playerNetClass')
    );
  }

  modelObject.init(world, entity).then(() => {
    if (modelObject.gltf || modelObject.Ready) return;
    if (!entity.modelObject) {
      modelObject.dispose();
      return;
    }

    const modelFilePath = entity.modelFilePath;

    if (modelId != null) {
      getModel(modelId).then(gltf => {
        if (entity.modelObject) {
          entity.modelObject.load(gltf);
        }
      });
    } else if (modelFilePath) {
      loadGLTF(modelFilePath, world).then(gltf => {
        if (entity.modelObject) {
          entity.modelObject.load(gltf);
        }
      });
    }
  });
}

export const ModelLoaderSystem: ISystemFactory = world => {
  const query = world.with(
    'modelFactory',
    'worldIndex',
    'transform',
    'visibility'
  );

  return {
    update: () => {
      const terrain = world.terrain;
      if (!terrain) return;
      const playerEntity = world.playerEntity;
      if (!playerEntity) return;

      for (const entity of query) {
        const visibility = entity.visibility;

        switch (visibility.state) {
          case 'visible':
          case 'nearby': {
            if (!entity.modelObject) {
              createModelObject(world, entity);
            }
            break;
          }
          case 'hidden': {
            if (entity.modelObject) {
              entity.modelObject.dispose();
              world.removeComponent(entity, 'modelObject');
            }
            break;
          }
        }
      }
    },
  };
};
