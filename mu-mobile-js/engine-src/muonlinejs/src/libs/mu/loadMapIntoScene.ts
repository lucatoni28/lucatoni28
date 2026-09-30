import { ENUM_WORLD } from '../../common';
import type { World } from '../../ecs/world';
import { Store } from '../../store';
import { createLorencia } from '../../maps/lorencia';
import { getTerrainData } from './getTerrainData';
import { Color4, Vector3 } from '../babylon/exports';
import { toRadians } from '../../common/utils';
import {
  MODEL_HOUSE_WALL05,
  MODEL_HOUSE_WALL06,
} from '../../common/objects/enum';
import { MapTileObject } from '../../common/mapTileObject';
import { IVector3Like } from '../babylon/exports';
import { EventBus } from '../eventBus';
import { DISABLE_OBJECTS_LOADING } from '../../consts';
import { PoseBoxObject } from '../../maps/lorencia/poseBoxObject';
import { SoundsManager } from '../soundsManager';

async function loadWorld(world: World) {
  if (!world.terrain) return;

  const tiles = world.terrain.MapTileObjects;
  const map = world.mapIndex;

  world.scene.clearColor.set(0, 0, 0, 1);

  switch (map) {
    case ENUM_WORLD.WD_0LORENCIA:
      world.add({
        worldIndex: map,
        interactiveArea: {
          min: { x: 120, y: 120 },
          max: { x: 129, y: 136 },
          onEnter: () => {
            SoundsManager.stopAllMusic();
            SoundsManager.loadAndPlaySoundEffect('Music/Pub');

            const models = [MODEL_HOUSE_WALL05, MODEL_HOUSE_WALL06];
            const query = world.with('transform', 'modelId', 'worldIndex');
            models.forEach(id => {
              for (const e of query) {
                if (e.worldIndex !== map) continue;
                if (e.modelId === id) {
                  e.transform.posOffset = { x: 0, y: 100, z: 0 };
                }
              }
            });
          },
          onLeave: () => {
            SoundsManager.stopAllMusic();
            SoundsManager.loadAndPlaySoundEffect('Music/main_theme');

            const models = [MODEL_HOUSE_WALL05, MODEL_HOUSE_WALL06];
            const query = world.with('transform', 'modelId', 'worldIndex');
            models.forEach(id => {
              for (const e of query) {
                if (e.worldIndex !== map) continue;
                if (e.modelId === id) {
                  e.transform.posOffset = undefined;
                }
              }
            });
          },
        },
        onDispose: () => {
          SoundsManager.stopSoundEffect('Music/Pub');
        },
      });
      return createLorencia(world);
    case ENUM_WORLD.WD_2DEVIAS:
      tiles[91] = PoseBoxObject;
      return;
    case ENUM_WORLD.WD_3NORIA:
      tiles[38] = PoseBoxObject;
      return;
    case ENUM_WORLD.WD_7ATLANSE:
      tiles[39] = PoseBoxObject;
      return;
    case ENUM_WORLD.WD_10ICARUS: {
      world.terrain.extraHeight = 0.9;
      world.scene.clearColor = new Color4(3 / 256, 25 / 256, 44 / 256, 1);
      return;
    }
  }
}

function createObjects(
  world: World,
  objs: { id: number; pos: IVector3Like; rot: IVector3Like; scale: number }[]
) {
  for (const data of objs) {
    const angles = new Vector3(
      toRadians(data.rot.x),
      toRadians(data.rot.z),
      toRadians(data.rot.y)
    );

    const pos = new Vector3(
      data.pos.x / world.terrainScale,
      data.pos.z / world.terrainScale,
      data.pos.y / world.terrainScale
    );

    world.add({
      worldIndex: world.mapIndex,
      transform: {
        pos,
        rot: angles,
        scale: data.scale,
      },
      modelId: data.id,
      modelFactory: world.terrain!.MapTileObjects[data.id] || MapTileObject,
      visibility: {
        state: 'hidden',
        lastChecked: 0,
      },
    });
  }
}

function unloadMap(world: World, oldMap: ENUM_WORLD) {
  const query = world.with('worldIndex');

  for (const e of query) {
    if (e === world.playerEntity) continue;
    if (e.worldIndex === oldMap) {
      world.remove(e);
      e.onDispose?.();
      e.modelObject?.dispose();
    }
  }

  if (world.terrain) {
    world.terrain.mesh.material?.dispose(true, true);
    world.terrain.mesh.dispose(false, true);
  }
}

export async function loadMapIntoScene(
  world: World,
  map: ENUM_WORLD,
  pos?: { x: number; y: number }
) {
  const oldMap = world.mapIndex;
  world.mapIndex = map;

  if (oldMap !== map) {
    unloadMap(world, oldMap);

    const {
      objects,
      terrain,
      RequestTerrainHeight,
      IsWalkable,
      RequestTerrainFlag,
      GetTerrainTile,
    } = await getTerrainData(world, map);

    world.getTerrainHeight = RequestTerrainHeight;
    world.isWalkable = IsWalkable;
    world.getTerrainFlag = RequestTerrainFlag;
    world.getTerrainTile = GetTerrainTile;

    if (map === ENUM_WORLD.WD_10ICARUS) {
      terrain.isVisible = false;
    }

    world.terrain = {
      mesh: terrain,
      MapTileObjects: new Array(256).fill(MapTileObject),
      extraHeight: 0,
    };

    await loadWorld(world);

    const filteredObjects = objects; //filter(o => TYPES.includes(o.id));

    !DISABLE_OBJECTS_LOADING && createObjects(world, filteredObjects);
  }

  if (world.playerEntity) {
    world.playerEntity.worldIndex = map;
    const playerPos = world.playerEntity.transform.pos;

    switch (map) {
      case ENUM_WORLD.WD_0LORENCIA:
        playerPos.x = 135;
        playerPos.z = 131;
        break;
      case ENUM_WORLD.WD_1DUNGEON:
        playerPos.x = 232;
        playerPos.z = 126;
        break;
      case ENUM_WORLD.WD_3NORIA:
        playerPos.x = 174;
        playerPos.z = 123;
        break;
      case ENUM_WORLD.WD_4LOSTTOWER:
        playerPos.x = 208;
        playerPos.z = 81;
        break;
      case ENUM_WORLD.WD_6STADIUM:
        playerPos.x = 56;
        playerPos.z = 85;
        break;
      case ENUM_WORLD.WD_7ATLANSE:
        playerPos.x = 20;
        playerPos.z = 20;
        break;
      case ENUM_WORLD.WD_8TARKAN:
        playerPos.x = 200;
        playerPos.z = 58;
        break;
      case ENUM_WORLD.WD_10ICARUS:
        playerPos.x = 14;
        playerPos.z = 12;
        break;
      case ENUM_WORLD.WD_33AIDA:
        playerPos.x = 85;
        playerPos.z = 10;
        break;
      case ENUM_WORLD.WD_51ELBELAND:
        playerPos.x = 61;
        playerPos.z = 201;
        break;
      case ENUM_WORLD.WD_2DEVIAS:
        playerPos.x = 219;
        playerPos.z = 24;
        break;
    }

    if (pos) {
      playerPos.x = pos.x;
      playerPos.z = pos.y;
    }

    playerPos.y = world.getTerrainHeight(playerPos.x, playerPos.z);

    Store.syncPlayerAppearance();
  }

  EventBus.emit('warpCompleted', { map });
}
