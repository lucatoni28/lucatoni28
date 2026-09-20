import { ItemsDatabase } from '../../common/itemsDatabase';
import type { ModelObject } from '../../common/modelObject';
import type { PlayerObject } from '../../common/playerObject';
import type { ISystemFactory, Item } from '../world';

function loadPart(
  part: Item | null,
  playerObject: PlayerObject,
  socket: ModelObject
) {
  if (!part) return;
  const item = ItemsDatabase.getItem(part.group, part.num);

  if (!item) return;

  playerObject.loadPartAsync(
    item.szModelFolder,
    socket,
    item.szModelName,
    part.lvl,
    part.isExcellent,
    part.isDivine
  );

  return true;
}

export const AppearanceSystem: ISystemFactory = world => {
  const query = world.with('charAppearance', 'modelObject', 'visibility');

  return {
    update: () => {
      for (const {
        charAppearance,
        modelObject,
        visibility,
        attributeSystem,
      } of query) {
        if (visibility.state === 'hidden') continue;
        if (!charAppearance.changed) continue;
        if (!modelObject.Ready) continue;

        const playerObject = modelObject as PlayerObject;

        loadPart(charAppearance.helm, playerObject, playerObject.HelmMask) ||
          playerObject.setDefaultMask();
        loadPart(charAppearance.armor, playerObject, playerObject.Armor) ||
          playerObject.setDefaultArmor();
        loadPart(charAppearance.pants, playerObject, playerObject.Pants) ||
          playerObject.setDefaultPants();
        loadPart(charAppearance.gloves, playerObject, playerObject.Gloves) ||
          playerObject.setDefaultGloves();
        loadPart(charAppearance.boots, playerObject, playerObject.Boots) ||
          playerObject.setDefaultBoots();

        /* Cánh. Bản gốc để dòng nạp cánh trong playerObject.ts ở dạng chú
           thích nên nhân vật không bao giờ có cánh; ổ cắm (ModelObject Wings,
           nối vào xương 47) thì đã dựng sẵn từ trước. Nối nốt vào đây để cánh
           đi theo đúng món đang mặc ở ô Wings, không phải hằng số. */
        const coCanh = !!loadPart(
          charAppearance.wings,
          playerObject,
          playerObject.Wings
        );
        if (!coCanh) playerObject.Wings.Unload();

        loadPart(charAppearance.leftHand, playerObject, playerObject.Weapon1) ||
          playerObject.Weapon1.Unload();
        loadPart(
          charAppearance.rightHand,
          playerObject,
          playerObject.Weapon2
        ) || playerObject.Weapon2.Unload();

        if (attributeSystem) {
          // AnimationSystem đọc cờ này mỗi khung để chọn bay hay đi bộ.
          attributeSystem.setValue('hasWings', coCanh ? 1 : 0);

          if (charAppearance.leftHand) {
            const group = charAppearance.leftHand.group;
            const isSpear = group === 3;
            attributeSystem.setValue('isSpearEquipped', isSpear ? 1 : 0);
          }

          if (charAppearance.rightHand) {
            const group = charAppearance.rightHand.group;
            const isSpear = group === 3;
            attributeSystem.setValue('isSpearEquipped', isSpear ? 1 : 0);
          }
        }

        charAppearance.changed = false;
      }
    },
  };
};
