import './style.less';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../store';
import { TWFlags } from '../../../common/terrain/consts';
import { isFlagInBinaryMask } from '../../../common/utils';
import { getTilesList } from '../../../common/terrain/getTilesList';
import { ENUM_WORLD } from '../../../common';

export const Debug = observer(() => {
  const playerData = Store.playerData;
  const world = Store.world;

  if (!world) return null;

  const noMoveFlag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.NoMove);
  const noGroundFlag = isFlagInBinaryMask(
    playerData.tileFlag,
    TWFlags.NoGround
  );
  const safeZoneFlag = isFlagInBinaryMask(
    playerData.tileFlag,
    TWFlags.SafeZone
  );
  const waterFlag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Water);
  const actionFlag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Action);
  const cameraUpFlag = isFlagInBinaryMask(
    playerData.tileFlag,
    TWFlags.CameraUp
  );
  const characterFlag = isFlagInBinaryMask(
    playerData.tileFlag,
    TWFlags.Character
  );
  const heightFlag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Height);
  const noAttackZoneFlag = isFlagInBinaryMask(
    playerData.tileFlag,
    TWFlags.NoAttackZone
  );
  const attack1Flag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Att1);
  const attack2Flag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Att2);
  const attack3Flag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Att3);
  const attack4Flag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Att4);
  const attack5Flag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Att5);
  const attack6Flag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Att6);
  const attack7Flag = isFlagInBinaryMask(playerData.tileFlag, TWFlags.Att7);

  const tile = world.getTerrainTile(playerData.x, playerData.y);
  const tiles = getTilesList(world.mapIndex);

  const attributeSystem = world.playerEntity?.attributeSystem;
  const inSafeZone = !!attributeSystem?.isAboveZero('inSafeZone');

  return (
    <div className="debug">
      <span className="coords">
        XY: {playerData.x} {playerData.y}
      </span>
      <span className="tile">
        Tile({tile}): {tiles[tile]}
      </span>
      <span>InSafeZone: {inSafeZone ? 'true' : 'false'}</span>
      <div className="tile-flags">
        <span>Tile Flag:</span>
        {noMoveFlag && <span className="flag">NoMove</span>}
        {noGroundFlag && <span className="flag">NoGround</span>}
        {safeZoneFlag && <span className="flag">SafeZone</span>}
        {waterFlag && <span className="flag">Water</span>}
        {actionFlag && <span className="flag">Action</span>}
        {cameraUpFlag && <span className="flag">CameraUp</span>}
        {characterFlag && <span className="flag">Character</span>}
        {heightFlag && <span className="flag">Height</span>}
        {noAttackZoneFlag && <span className="flag">NoAttackZone</span>}
        {attack1Flag && <span className="flag">Att1</span>}
        {attack2Flag && <span className="flag">Att2</span>}
        {attack3Flag && <span className="flag">Att3</span>}
        {attack4Flag && <span className="flag">Att4</span>}
        {attack5Flag && <span className="flag">Att5</span>}
        {attack6Flag && <span className="flag">Att6</span>}
        {attack7Flag && <span className="flag">Att7</span>}
      </div>
    </div>
  );
});
