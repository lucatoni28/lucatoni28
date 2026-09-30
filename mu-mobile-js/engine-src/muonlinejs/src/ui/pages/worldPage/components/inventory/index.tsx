import './style.less';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import { ItemIcon } from '../../../../components/itemIcon';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { Item } from '../../../../../ecs/world';
import { ItemsDatabase } from '../../../../../common/itemsDatabase';
import { useState } from 'react';

const EquipmentItem = ({
  className,
  item,
}: {
  className: string;
  item: Item | null;
}) => {
  return (
    <div className={`equipment-item ${className}`}>
      <span className="equipment-item-name">
        {!!item && <ItemIcon {...item} />}
      </span>
    </div>
  );
};

const ItemTooltip = ({
  item,
  children,
}: {
  item: Item | null;
  children: React.ReactNode;
}) => {
  const config = item ? ItemsDatabase.getItem(item.group, item.num) : null;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="tooltip"
      onPointerEnter={() => setIsVisible(true)}
      onPointerLeave={() => setIsVisible(false)}
    >
      {children}
      {!!config && isVisible && (
        <div className="tooltip-content" style={{ left: 0, top: 0 }}>
          <div className="tooltip-content-name">{config.ItemName}</div>
        </div>
      )}
    </div>
  );
};

const InventoryItem = ({ item }: { item: Item | null }) => {
  const config = item ? ItemsDatabase.getItem(item.group, item.num) : null;
  const w = config?.X ?? 1;
  const h = config?.Y ?? 1;

  return (
    <div className={`inventory-item w-${w} h-${h}${!item ? '' : ' used'}`}>
      <div className="bg">
        <ItemTooltip item={item}>
          {!!item && <ItemIcon {...item} />}
        </ItemTooltip>
      </div>
    </div>
  );
};

const HOT_KEYS = ['KeyI', 'KeyV'];

export const Inventory = observer(() => {
  const playerData = Store.playerData;

  useEventBus('keyPressed', key => {
    if (HOT_KEYS.includes(key)) {
      Store.inventoryEnabled = !Store.inventoryEnabled;
    }
  });

  if (!Store.inventoryEnabled) {
    return null;
  }

  return (
    <div className="inventory">
      <span className="title">Inventory</span>
      <span className="status">[Set options][Socket options]</span>
      <div className="equipment">
        <EquipmentItem className="pet" item={playerData.petSlot} />
        <EquipmentItem className="leftHand" item={playerData.leftHandSlot} />
        <EquipmentItem className="rightHand" item={playerData.rightHandSlot} />
        <EquipmentItem className="helmet" item={playerData.helmetSlot} />
        <EquipmentItem className="armor" item={playerData.armorSlot} />
        <EquipmentItem className="gloves" item={playerData.glovesSlot} />
        <EquipmentItem className="boots" item={playerData.bootsSlot} />
        <EquipmentItem className="pants" item={playerData.pantsSlot} />
        <EquipmentItem className="leftRing" item={playerData.ring1Slot} />
        <EquipmentItem className="rightRing" item={playerData.ring2Slot} />
        <EquipmentItem className="amulet" item={playerData.pendantSlot} />
        <EquipmentItem className="wings" item={playerData.wingsSlot} />
      </div>
      <div className="inventory-items">
        {playerData.inventoryItems.map((item, index) => (
          <InventoryItem key={index} item={item} />
        ))}
      </div>
      <div className="zen">Zen: {playerData.money}</div>
    </div>
  );
});
