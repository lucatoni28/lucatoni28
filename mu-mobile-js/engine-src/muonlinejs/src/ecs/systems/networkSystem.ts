import type { IVector2Like } from '../../libs/babylon/exports';
import type { ISystemFactory } from '../world';
import { Store } from '../../store';

// Function returning CLIENT CODE (0-7) according to MU Online documentation
// W=0, SW=1, S=2, SE=3, E=4, NE=5, N=6, NW=7

function GetClientDirectionCode(from: IVector2Like, to: IVector2Like): number {
  const dx = ~~(Math.round(to.x) - Math.round(from.x)); // Horizontal (X): left / right – works correctly
  const dy = ~~(Math.round(to.y) - Math.round(from.y)); // Vertical (Y): up / down – correction here

  if (dx === -1 && dy === -1) return 0; // West
  if (dx === 0 && dy === -1) return 1; // South-West
  if (dx === 1 && dy === -1) return 2; // South
  if (dx === 1 && dy === 0) return 3; // South-East
  if (dx === 1 && dy === 1) return 4; // East
  if (dx === 0 && dy === 1) return 5; // North-East
  if (dx === -1 && dy === 1) return 6; // North
  if (dx === -1 && dy === 0) return 7; // North-West
  return 0xff; // Invalid direction
}

function mapToServerDirectionCode(clientDir: number): number {
  return clientDir;
  // return 7 - clientDir;
}

// stackalloc: no GC pressure for  ≤15-step MU packet
const clientDirs = new Array<number>(15);

function sendWalkPathToServer(path: IVector2Like[]) {
  if (path.length == 0) return;

  // console.log(JSON.stringify(path, null, 2));

  const startX = ~~path[0].x;
  const startY = ~~path[0].y;

  let dirLen = 0;
  let currentPos = path[0];
  for (let i = 1; i < path.length; i++) {
    const step = path[i];
    const dirCode = GetClientDirectionCode(currentPos, step);
    if (dirCode > 7) {
      console.error(
        `Invalid direction code: ${dirCode} at step ${i} from [${currentPos.x}, ${currentPos.y}] to [${step.x}, ${step.y}]`
      );
      // If
      break;
    }
    clientDirs[dirLen++] = dirCode;
    currentPos = step;
    if (dirLen == 15) break;
  }
  if (dirLen == 0) return;

  // const directionMap = MuGame.Network?.GetDirectionMap();
  const serverDirs = new Array<number>(dirLen);
  for (let i = 0; i < dirLen; i++) {
    const cd = clientDirs[i];
    serverDirs[i] = mapToServerDirectionCode(cd);
  }

  Store.sendWalkPath(startX, startY, serverDirs);
}

export const NetworkSystem: ISystemFactory = world => {
  return {
    update: () => {
      const playerEntity = world.playerEntity;
      if (!playerEntity) return;

      const { playerMoveTo, pathfinding } = playerEntity;

      if (
        playerMoveTo.sendToServer &&
        pathfinding.calculated &&
        pathfinding.path
      ) {
        sendWalkPathToServer(pathfinding.path);
        playerMoveTo.sendToServer = false;
      }
    },
  };
};
