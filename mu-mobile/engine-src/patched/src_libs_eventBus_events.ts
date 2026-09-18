import type { IVector2Like, IVector3Like } from '../babylon/exports';
import type {
  ConnectServerPackets,
  ENUM_WORLD,
  ServerToClientPackets,
} from '../../common';
import type { Entity } from '../../ecs/world';
import type { With } from 'miniplex';

type CSPacketKeys = (typeof ConnectServerPackets)[number]['Name'];
type GSPacketKeys = (typeof ServerToClientPackets)[number]['Name'];

export type CSEvents = Record<CSPacketKeys, DataView>;
export type GSEvents = Record<GSPacketKeys, DataView>;

export type Events = CSEvents &
  GSEvents & {
    wsOpened: { socket: WebSocket };
    wsClosed: { socket: WebSocket };
    wsError: { socket: WebSocket; error: any };
    groundPointClicked: { point: IVector3Like };
    entityScreenPositionUpdated: {
      entity: With<Entity, 'transform' | 'screenPosition'>;
      screenPosition: IVector2Like;
    };
    requestWarp: { map: ENUM_WORLD; pos?: { x: number; y: number } };
    warpCompleted: { map: ENUM_WORLD };
    keyPressed: string;
    keyReleased: string;
    pageVisibilityChanged: boolean;

    // --- chế độ chơi đơn ---
    // Bản chơi đơn không có server nên toàn bộ chiến đấu tính ngay tại máy;
    // những sự kiện dưới đây là cách lớp giao diện biết chuyện gì vừa xảy ra.
    // x, y là toạ độ MÀN HÌNH (pixel) do CalculateScreenPositionSystem tính
    // sẵn cho từng entity — lớp giao diện khỏi phải chiếu lại từ toạ độ 3D.
    offlineHit: {
      x: number;
      y: number;
      amount: number;
      kind: 'dmg' | 'crit' | 'miss' | 'hurt';
    };
    offlineKill: { name: string; exp: number; zen: number };
    offlineLevelUp: { level: number; points: number };
    offlineStatSpent: { stat: string; points: number };
    offlineItemMoved: { from: number; to: number };
    offlineUpgrade: { slot: number; ok: boolean; lvl: number; cost: number };
    offlineSocket: { slot: number; action: string; index: number; kind?: number };
    offlineLoot: { name: string; zen: number };
    offlineAttack: { slot: number };
    offlinePlayerDied: {};
  };
