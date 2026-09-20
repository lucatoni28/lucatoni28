import { ArrayCopy } from '../utils';
import { TERRAIN_SIZE } from './consts';

function _readString(buffer: DataView, from: number, to: number): string {
  let val = '';
  for (let i = from; i < to; i++) {
    const ch = String.fromCharCode(buffer.getUint8(i));

    if (ch === '\0') break;

    val += ch;
  }

  return val;
}

export async function parseTerrainHeight(buffer: Uint8Array) {
  const Index = 1084;
  const factor = 1.5 / 100;

  const result = new Float32Array(TERRAIN_SIZE * TERRAIN_SIZE);

  for (let y = 0; y < TERRAIN_SIZE; y++) {
    for (let x = 0; x < TERRAIN_SIZE; x++) {
      result[y * TERRAIN_SIZE + x] =
        buffer[Index + y * TERRAIN_SIZE + x] * factor;
    }
  }

  return result;
}
