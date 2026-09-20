import { EventBus } from '../libs/eventBus';
import { Sounds, SoundsManager } from '../libs/soundsManager';
import type { ISystemFactory } from '../ecs/world';

/**
 * Âm thanh cho chiến đấu, lên cấp, rơi đồ.
 *
 * Tên file lấy đúng trong assets/game-assets/Sound, đã khai sẵn ở
 * src/common/sounds.json. Không đổi tên, không thêm file nào.
 */

const DANH_TRUNG: Sounds[] = [
  'Sound/eMeleeHit1',
  'Sound/eMeleeHit2',
  'Sound/eMeleeHit3',
  'Sound/eMeleeHit4',
  'Sound/eMeleeHit5',
];

const VUNG_VU_KHI: Sounds[] = [
  'Sound/eBlow1',
  'Sound/eBlow2',
  'Sound/eBlow3',
  'Sound/eBlow4',
];

const NGUOI_KEU: Sounds[] = [
  'Sound/pMaleScream1',
  'Sound/pMaleScream2',
  'Sound/pMaleScream3',
];

const CHI_MANG: Sounds = 'Sound/eCombo';
const HUT: Sounds = 'Sound/eSwingWeapon1';
const QUAI_CHET: Sounds = 'Sound/death1';
const LEN_CAP: Sounds = 'Sound/pLevelUp';
const NHAT_TIEN: Sounds = 'Sound/pDropMoney';
const RA_DO: Sounds = 'Sound/pDropItem';
const CUONG_HOA_XONG: Sounds = 'Sound/eMix';
const CUONG_HOA_HONG: Sounds = 'Sound/eBreak';
const NGUOI_CHET: Sounds = 'Sound/pMaleDie';

function bat(s: Sounds) {
  SoundsManager.loadAndPlaySoundEffect(s);
}

function batMot(ds: Sounds[]) {
  bat(ds[(Math.random() * ds.length) | 0]);
}

/* Hai đòn liên tiếp trong vài chục mili giây nghe thành một tiếng rè. Chặn
   lại theo nhóm, mỗi nhóm có quãng nghỉ riêng. */
const lanCuoi = new Map<string, number>();
function quaGan(nhom: string, cach: number): boolean {
  const gio = performance.now();
  const truoc = lanCuoi.get(nhom) ?? -Infinity;
  if (gio - truoc < cach) return true;
  lanCuoi.set(nhom, gio);
  return false;
}

export const CombatSfxSystem: ISystemFactory = () => {
  EventBus.on('offlineAttack', () => {
    if (quaGan('vung', 120)) return;
    batMot(VUNG_VU_KHI);
  });

  EventBus.on('offlineHit', ({ kind }) => {
    if (kind === 'miss') {
      if (quaGan('hut', 150)) return;
      bat(HUT);
      return;
    }
    if (kind === 'hurt') {
      if (quaGan('dau', 400)) return;
      batMot(NGUOI_KEU);
      return;
    }
    if (kind === 'crit') {
      if (quaGan('cham', 90)) return;
      bat(CHI_MANG);
      return;
    }
    if (quaGan('cham', 90)) return;
    batMot(DANH_TRUNG);
  });

  EventBus.on('offlineKill', () => bat(QUAI_CHET));
  EventBus.on('offlineLevelUp', () => bat(LEN_CAP));
  EventBus.on('offlinePlayerDied', () => bat(NGUOI_CHET));

  EventBus.on('offlineLoot', ({ name }) => {
    bat(name === 'TÚI ĐẦY' ? NHAT_TIEN : RA_DO);
  });

  EventBus.on('offlineUpgrade', ({ ok }) => {
    bat(ok ? CUONG_HOA_XONG : CUONG_HOA_HONG);
  });

  return { update: () => {} };
};
