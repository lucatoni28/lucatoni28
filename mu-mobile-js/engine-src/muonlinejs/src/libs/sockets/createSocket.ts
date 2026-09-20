import { EventBus } from "../eventBus";
import { ConnectServerPackets, ServerToClientPackets, SimpleModulusDecryptor } from "../../common";
import { byteToString, getPacketSize, getSizeOfPacketType } from "../../common/utils";

type Options = {
  wsAddress: string;
  tcpIP: string;
  tcpPort: number;
};

const STCPackets = [...ConnectServerPackets, ...ServerToClientPackets].filter(p => p.Direction === 'ServerToClient');

const packetsCacheByCode: (typeof STCPackets)[] = [];

STCPackets.forEach(p => {
  const code = p.Code;

  if (packetsCacheByCode[code] == null) {
    packetsCacheByCode[code] = [p];
  } else {
    packetsCacheByCode[code].push(p);
  }
});

const HEADERS = new Set<number>([0xc1, 0xc2, 0xc3, 0xc4]);

const DEBUG_LOG = false;
const INFO_LOG = true;

export function createSocket(_opts: Options): never {
  throw new Error('Bản này chỉ chơi đơn: đã gỡ lớp kết nối máy chủ.');
}
