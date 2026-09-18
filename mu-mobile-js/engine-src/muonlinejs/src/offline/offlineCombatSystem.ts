import { PointerEventTypes } from '../libs/babylon/exports';
import { EventBus } from '../libs/eventBus';
import { Store } from '../store';
import { MonsterActionType, PlayerAction } from '../common/objects/enum';
import type { Entity, ISystemFactory, World } from '../ecs/world';
import {
  gearExc,
  playerAttackRate,
  playerDefense,
  playerDefenseRate,
  playerMaxDamage,
  playerMinDamage,
  rollHit,
} from './combatFormulas';
import { grantKill } from './offlineProgress';

/** Người chơi đánh được từ khoảng cách này (tính bằng ô). */
const PLAYER_REACH = 2.2;

/** Giây giữa hai đòn của người chơi. */
const PLAYER_ATTACK_PERIOD = 0.9;

/** Xác chết nằm lại bao lâu trước khi biến mất. */
const CORPSE_TIME = 3.5;

/** Bao lâu sau khi bị đánh thì quái thôi bám nếu người chơi chạy xa. */
const LEASH_RANGE = 24;

/** Quái rảnh thì lang thang quanh chỗ đẻ trong bán kính này. */
const WANDER_RADIUS = 5;

/* Bật tự đánh thì tìm mục tiêu trong bán kính này (ô).
   Phải phủ hết vùng đẻ quái. OfflineSpawnSystem đẻ cách người chơi 7–45 ô và
   loại mọi ô trong vùng an toàn, mà điểm vào Lorencia lại nằm giữa làng — nên
   đo thực tế con gần nhất ở 37–40 ô. Thử 12 ô rồi 34 ô đều ra cảnh bật tự đánh
   xong đứng yên hàng chục giây chờ quái lang thang tới gần. 48 ô là luôn tìm
   được, đúng nếp tự săn của MU: tự chạy tới chỗ có quái. */
const AUTO_RANGE = 48;

/** Bao lâu ra lại lệnh đi khi đang đuổi theo mục tiêu tự chọn (giây). */
const AUTO_REPATH = 0.7;

/* ────────────────────────── HITBOX ──────────────────────────
   Trước đây một đòn chỉ cần khoảng cách tâm-tới-tâm nhỏ hơn PLAYER_REACH là
   trúng, quay lưng cũng trúng. Giờ đòn thường phải quét đúng hình QUẠT trước
   mặt, và quái được tính như một hình trụ có bán kính thật chứ không phải một
   điểm — nên con to dễ trúng hơn con nhỏ, đúng như nhìn thấy trên màn hình. */

/** Nửa góc mở của nhát chém, tính bằng radian (50° mỗi bên → quạt 100°). */
const SWING_HALF_ANGLE = (50 * Math.PI) / 180;

/** Bán kính thân quái khi tính trúng đòn (ô). Bảng quái không có cỡ thân,
    lấy theo tầm đánh của chính nó — con tay dài thì thân cũng to. */
function monsterRadius(e: Entity): number {
  return Math.min(1.4, Math.max(0.55, (e.monster?.attackRange ?? 1.2) * 0.45));
}

/* ───────────────────── XOAY KIẾM (Twisting Slash) ─────────────────────
   Kỹ năng vòng tròn của Dark Knight: xoay một vòng, chém MỌI con quái quanh
   mình. Đây là lý do nó cần hitbox riêng — đòn thường quét hình quạt, Xoay
   Kiếm quét trọn 360°. */

/** Ô thanh bar của Xoay Kiếm — khớp BAR_DEFAULT_SLOTS bên giao diện. */
const SLOT_TWISTING_SLASH = 2;

/** Bán kính quét của Xoay Kiếm (ô). */
const TWIST_RADIUS = 3.2;

/** Mana mỗi lần dùng. */
const TWIST_MANA = 10;

/** Thời gian hồi (giây). */
const TWIST_COOLDOWN = 1.6;

/** Sát thương Xoay Kiếm so với đòn thường. */
const TWIST_DAMAGE_MUL = 0.85;

/** Hoạt ảnh vung đòn giữ trên người bao lâu trước khi trả về đứng/đi. */
const ATTACK_ANIM_TIME = 0.62;
const TWIST_ANIM_TIME = 0.9;

/**
 * Toàn bộ đánh nhau của chế độ chơi đơn.
 *
 * Bản chơi mạng tính sát thương ở server rồi gửi gói về; chơi đơn không có
 * server nên hệ thống này thay chỗ đó. Nó chỉ chạy khi Store.isOffline, không
 * đụng gì tới đường mạng.
 *
 * Cách chơi: chạm vào quái là chọn mục tiêu, nhân vật tự tới trong tầm rồi
 * đánh cho tới khi quái chết hoặc chọn mục tiêu khác — đúng nếp MU.
 */
export const OfflineCombatSystem: ISystemFactory = world => {
  // Xem chú thích cùng chỗ ở OfflineSpawnSystem: cờ isOffline chưa bật lúc
  // dựng hệ thống, phải kiểm trong update.
  const monsters = world.with('monster', 'transform', 'monsterAnimation');

  let now = 0;
  let target: Entity | null = null;
  let nextPlayerAttackAt = 0;
  let nextAutoPathAt = 0;
  let nextTwistAt = 0;
  /** Đến lúc nào thì thôi giữ hoạt ảnh đánh. 0 = không giữ. */
  let animHoldUntil = 0;
  /** Hoạt ảnh đang giữ có phải của KỸ NĂNG không. Đòn thường không được đè
      lên kỹ năng: Xoay Kiếm dài 0,9s mà nhịp đánh thường là 0,9s, không chặn
      thì vòng xoay bị cắt ngang ngay khung sau và chẳng ai kịp thấy. */
  let animIsSkill = false;
  /** Hai nhát chém phải xen kẽ, không thì trông như một cánh tay máy. */
  let swingRight = true;

  /* Chạm vào quái thì chọn nó làm mục tiêu. PointerInputSystem đã lo phần bắn
     tia và giữ world.currentPointerTarget, ở đây chỉ đọc lại. */
  world.scene.onPointerObservable.add(ev => {
    if (ev.type !== PointerEventTypes.POINTERDOWN) return;
    const t = world.currentPointerTarget as Entity | null;
    if (t?.monster && t.monster.state !== 'dead') target = t;
  });

  /* Nút trên HUD. Ô 2 là Xoay Kiếm, mọi ô khác là đòn thường.
     Ô kỹ năng đánh ngay tại chỗ, không cần mục tiêu — nó quét cả vòng. */
  EventBus.on('offlineAttack', ({ slot }) => {
    if (slot === SLOT_TWISTING_SLASH) {
      xoayKiem();
      return;
    }
    if (!target || target.monster?.state === 'dead') {
      target = nearestMonster(world, monsters, PLAYER_REACH * 3);
    }
    nextPlayerAttackAt = 0;
  });

  /** Đặt hoạt ảnh vung đòn và hẹn giờ trả về trạng thái thường.
      laKyNang = true thì đòn thường không đè lên được cho tới khi hết giờ. */
  function datHoatAnh(action: number, giu: number, laKyNang = false) {
    const p = world.playerEntity;
    if (!p?.playerAnimation) return;
    if (!laKyNang && animIsSkill && now < animHoldUntil) return;
    p.playerAnimation.action = action;
    animHoldUntil = now + giu;
    animIsSkill = laKyNang;
  }

  /** Xoay Kiếm: quét trọn vòng quanh mình, trúng mọi con trong bán kính. */
  function xoayKiem() {
    const p = world.playerEntity;
    if (!p) return;

    if (now < nextTwistAt) return;

    const pd = Store.playerData;
    if (pd.currentMP < TWIST_MANA) {
      EventBus.emit('offlineHit', { x: 0, y: 0, amount: 0, kind: 'miss' });
      return;
    }

    nextTwistAt = now + TWIST_COOLDOWN;
    Store.setPlayerMp(pd.currentMP - TWIST_MANA);
    datHoatAnh(PlayerAction.PLAYER_ATTACK_SKILL_WHEEL, TWIST_ANIM_TIME, true);

    const px = p.transform.pos.x;
    const pz = p.transform.pos.z;

    /* Gom danh sách TRƯỚC khi đánh: strikeMonster() có thể gỡ component của
       con vừa chết, duyệt trực tiếp trên truy vấn đang đổi là bỏ sót. */
    const trung: Entity[] = [];
    for (const e of monsters) {
      if (!e.monster || e.monster.state === 'dead' || !e.transform) continue;
      const d = Math.hypot(e.transform.pos.x - px, e.transform.pos.z - pz);
      if (d - monsterRadius(e) <= TWIST_RADIUS) trung.push(e);
    }

    for (const e of trung) strikeMonster(world, e, now, TWIST_DAMAGE_MUL);
  }

  function hurtPlayer(amount: number) {
    const p = Store.playerData;
    const hp = Math.max(0, p.currentHP - amount);
    Store.setPlayerHp(hp);

    if (hp <= 0) {
      target = null;
      EventBus.emit('offlinePlayerDied', {});
      Store.reviveOffline();
    }
  }

  return {
    update: dt => {
      if (!Store.isOffline) return;
      now += dt;

      const player = world.playerEntity;
      if (!player) return;

      const px = player.transform.pos.x;
      const pz = player.transform.pos.z;

      /* Hết giờ giữ thì trả về đứng yên; AnimationSystem thấy action không còn
         nằm trong dải đánh sẽ tự tính lại đi/đứng/bay ngay khung sau. */
      if (animHoldUntil && now >= animHoldUntil && player.playerAnimation) {
        animHoldUntil = 0;
        animIsSkill = false;
        player.playerAnimation.action = PlayerAction.PLAYER_STOP_MALE;
      }

      // --------------------------------------------------- người chơi đánh
      if (target && (!target.monster || target.monster.state === 'dead')) {
        target = null;
      }

      /* Tự đánh: hết mục tiêu thì tự bắt con gần nhất trong tầm rồi chạy tới.
         Không tự bịa thêm sát thương hay tốc độ — chỉ thay thao tác chạm của
         người chơi, mọi phép tính vẫn đi qua đúng strikeMonster() bên dưới. */
      if (Store.autoAttack && !target) {
        target = nearestMonster(world, monsters, AUTO_RANGE);
      }

      if (target) {
        const d = Math.hypot(target.transform!.pos.x - px, target.transform!.pos.z - pz);

        /* Ra LẠI lệnh đi theo nhịp chứ không chỉ một lần lúc chọn mục tiêu:
           quái vẫn đi lang thang, ra lệnh một lần là chạy tới chỗ cũ rồi đứng. */
        if (Store.autoAttack && d > PLAYER_REACH && now >= nextAutoPathAt) {
          nextAutoPathAt = now + AUTO_REPATH;
          if (player.playerMoveTo) {
            player.playerMoveTo.point.x = ~~target.transform!.pos.x;
            player.playerMoveTo.point.y = ~~target.transform!.pos.z;
            player.playerMoveTo.handled = false;
          }
        }

        /* Tầm với tính từ MÉP thân quái, không phải tâm — con to phải với
           tới được từ xa hơn, đúng như mắt nhìn. */
        const tamVoi = PLAYER_REACH + monsterRadius(target);

        if (d <= tamVoi) {
          // Đứng lại và quay mặt về phía quái trước khi vung.
          if (player.pathfinding) player.pathfinding.path = [];
          if (player.movement) {
            player.movement.velocity.x = 0;
            player.movement.velocity.y = 0;
          }
          player.transform.rot.y =
            Math.atan2(
              target.transform!.pos.z - pz,
              target.transform!.pos.x - px
            ) + Math.PI / 2;

          if (now >= nextPlayerAttackAt) {
            /* Dòng Xuất sắc "gia tăng tốc độ tấn công": mỗi điểm rút ngắn
               nhịp đánh 1%, chặn dưới ở 45% nhịp gốc để không thành máy bắn. */
            const nhanh = Math.max(0.45, 1 - gearExc().attackSpeed * 0.01);
            nextPlayerAttackAt = now + PLAYER_ATTACK_PERIOD * nhanh;

            /* HITBOX: nhát chém chỉ ăn khi con quái nằm trong hình quạt trước
               mặt. Vừa quay mặt ở trên nên đòn theo mục tiêu luôn trúng; cái
               quạt này là để những con KHÁC đứng chen vào cũng ăn đòn, và để
               lúc mục tiêu chạy vòng ra sau lưng thì hụt thật. */
            const huong = player.transform.rot.y - Math.PI / 2;

            let trung = false;
            for (const e of monsters) {
              if (!e.monster || e.monster.state === 'dead' || !e.transform) continue;
              const ex = e.transform.pos.x - px;
              const ez = e.transform.pos.z - pz;
              const dd = Math.hypot(ex, ez);
              if (dd - monsterRadius(e) > tamVoi) continue;

              // Chênh lệch góc, quy về khoảng [-π, π].
              let lech = Math.atan2(ez, ex) - huong;
              lech = Math.atan2(Math.sin(lech), Math.cos(lech));

              /* Con nào ĐANG chạm vào người thì khỏi xét góc: ở sát rồi mà
                 còn đòi đúng hướng thì trông như đâm xuyên qua nhau. */
              const sat = dd <= monsterRadius(e) + 0.6;
              if (!sat && Math.abs(lech) > SWING_HALF_ANGLE) continue;

              strikeMonster(world, e, now);
              trung = true;
            }

            // Quạt trống trơn (mục tiêu vừa lách ra) thì vẫn vung cho có nhịp.
            if (!trung) strikeMonster(world, target, now);

            datHoatAnh(
              swingRight
                ? PlayerAction.PLAYER_ATTACK_SWORD_RIGHT1
                : PlayerAction.PLAYER_ATTACK_SWORD_LEFT1,
              ATTACK_ANIM_TIME
            );
            swingRight = !swingRight;
          }
        }
      }

      // ------------------------------------------------------------ quái
      for (const e of monsters) {
        const m = e.monster;

        if (m.state === 'dead') {
          if (now - m.diedAt > CORPSE_TIME && e.modelObject) {
            e.modelObject.getMeshes(true).forEach(mesh => (mesh.isVisible = false));
          }
          continue;
        }

        const dx = px - e.transform.pos.x;
        const dz = pz - e.transform.pos.z;
        const dist = Math.hypot(dx, dz);

        // Nghĩ lại 4 lần/giây là đủ mượt mà rẻ hơn tính mỗi khung.
        if (now >= m.thinkAt) {
          m.thinkAt = now + 0.25;

          if (dist > LEASH_RANGE) {
            m.state = 'idle';
          } else if (dist <= m.attackRange) {
            m.state = 'attack';
          } else if (dist <= m.aggroRange) {
            m.state = 'chase';
          } else if (m.state === 'chase' || m.state === 'attack') {
            // Ra khỏi tầm nhìn thì thôi bám.
            m.state = 'idle';
          }

          if (m.state === 'chase' && e.pathfinding && e.playerMoveTo) {
            e.playerMoveTo.point.x = ~~px;
            e.playerMoveTo.point.y = ~~pz;
            e.playerMoveTo.handled = false;
          }
        }

        if (m.state === 'attack') {
          if (e.pathfinding) e.pathfinding.path = [];
          if (e.movement) {
            e.movement.velocity.x = 0;
            e.movement.velocity.y = 0;
          }
          e.transform.rot.y = Math.atan2(dz, dx) + Math.PI / 2;

          if (now >= m.attackAt) {
            m.attackAt = now + m.attackSpeed;
            e.monsterAnimation.action = MonsterActionType.Attack1;

            const exc = gearExc();

            /* Bên đỡ dùng playerDefenseRate() chứ không phải tỉ lệ ĐÁNH —
               bản trước lấy nhầm playerAttackRate() làm tỉ lệ né, nên cộng
               điểm sát thương lại hoá ra né giỏi hơn. Dòng Xuất sắc "tăng tỉ
               lệ phòng thủ thành công" cộng vào đúng chỗ này. */
            let dmg = rollHit(
              m.attackSuccess + m.level * 3,
              playerDefenseRate(),
              m.minDmg,
              m.maxDmg,
              playerDefense()
            );

            // Dòng Xuất sắc "giảm sát thương nhận vào".
            if (dmg > 0 && exc.damageCutPct > 0) {
              dmg = Math.max(1, Math.round(dmg * (1 - exc.damageCutPct)));
            }

            if (dmg > 0) {
              hurtPlayer(dmg);
              EventBus.emit('offlineHit', {
                x: 0,
                y: 0,
                amount: dmg,
                kind: 'hurt',
              });

              /* Dòng Xuất sắc "phản lại sát thương": trả ngược một phần về
                 con vừa đánh mình. Trừ thẳng vào máu chứ không đi qua
                 strikeMonster() — phản đòn không tính là mình ra đòn nên
                 không được ăn tỉ lệ trúng hay hoạt ảnh vung kiếm. */
              if (exc.reflectPct > 0) {
                const pd = Math.max(1, Math.round(dmg * exc.reflectPct));
                m.hp -= pd;
                const sp = e.screenPosition;
                EventBus.emit('offlineHit', {
                  x: sp?.x ?? 0,
                  y: sp?.y ?? 0,
                  amount: pd,
                  kind: 'dmg',
                });
                if (m.hp <= 0) {
                  m.hp = 0;
                  m.state = 'dead';
                  m.diedAt = now;
                  e.monsterAnimation.action = MonsterActionType.Die;
                  if (e.pathfinding) e.pathfinding.path = [];
                  if (e.interactable) world.removeComponent(e as any, 'interactable');
                  if (e.highlighted) world.removeComponent(e as any, 'highlighted');
                  grantKill(m);
                }
              }
            } else {
              EventBus.emit('offlineHit', { x: 0, y: 0, amount: 0, kind: 'miss' });
            }
          }
        } else if (m.state === 'idle') {
          if (e.monsterAnimation.action === MonsterActionType.Attack1) {
            e.monsterAnimation.action = MonsterActionType.Stop1;
          }

          // Rảnh thì đi vẩn vơ quanh chỗ đẻ. Đứng chôn chân nhìn giả lắm, mà
          // đi lang thang cũng chỉ tốn một lần tìm đường mỗi vài giây.
          const dungYen =
            !e.pathfinding?.path || e.pathfinding.path.length === 0;
          if (dungYen && now >= m.attackAt) {
            m.attackAt = now + 3 + Math.random() * 5;
            const tx = ~~(m.home.x + (Math.random() * 2 - 1) * WANDER_RADIUS);
            const ty = ~~(m.home.y + (Math.random() * 2 - 1) * WANDER_RADIUS);
            if (world.isWalkable(tx, ty) && e.playerMoveTo) {
              e.playerMoveTo.point.x = tx;
              e.playerMoveTo.point.y = ty;
              e.playerMoveTo.handled = false;
            }
          }
        }
      }
    },
  };
};

function nearestMonster(
  world: World,
  monsters: Iterable<Entity>,
  range: number
): Entity | null {
  const p = world.playerEntity;
  if (!p) return null;

  let best: Entity | null = null;
  let bestD = range;

  for (const e of monsters) {
    if (!e.monster || e.monster.state === 'dead' || !e.transform) continue;
    const d = Math.hypot(
      e.transform.pos.x - p.transform.pos.x,
      e.transform.pos.z - p.transform.pos.z
    );
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function strikeMonster(world: World, e: Entity, now: number, mul = 1) {
  const m = e.monster!;

  const dmg = rollHit(
    playerAttackRate(),
    m.attackSuccess + m.level * 2,
    Math.round(playerMinDamage() * mul),
    Math.round(playerMaxDamage() * mul),
    m.def,
    gearExc().perfectRate
  );

  const sp = e.screenPosition;

  if (dmg <= 0) {
    EventBus.emit('offlineHit', {
      x: sp?.x ?? 0,
      y: sp?.y ?? 0,
      amount: 0,
      kind: 'miss',
    });
    return;
  }

  m.hp -= dmg;

  EventBus.emit('offlineHit', {
    x: sp?.x ?? 0,
    y: sp?.y ?? 0,
    amount: dmg,
    kind: 'dmg',
  });

  if (m.hp > 0) {
    e.monsterAnimation!.action = MonsterActionType.Shock;
    return;
  }

  // ------------------------------------------------------------- quái chết
  m.hp = 0;
  m.state = 'dead';
  m.diedAt = now;
  e.monsterAnimation!.action = MonsterActionType.Die;

  if (e.pathfinding) e.pathfinding.path = [];
  if (e.movement) {
    e.movement.velocity.x = 0;
    e.movement.velocity.y = 0;
  }
  if (e.interactable) world.removeComponent(e as any, 'interactable');
  if (e.highlighted) world.removeComponent(e as any, 'highlighted');

  grantKill(m);
}
