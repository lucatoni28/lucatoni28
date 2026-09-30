import './style.less';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ENUM_WORLD } from '../../../../../common';
import { EventBus } from '../../../../../libs/eventBus';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { LL } from '../../../../../libs/localization';

const MAPS_LIST: {
  id: ENUM_WORLD;
  name: string;
  minLvl: number;
  cost: number;
}[] = [
  // {
  //   id: ENUM_WORLD.WD_6STADIUM,
  //   name: 'Arena',
  //   minLvl: 50,
  //   cost: 2000,
  // },
  {
    id: ENUM_WORLD.WD_0LORENCIA,
    name: 'Lorencia',
    minLvl: 10,
    cost: 2000,
  },
  {
    id: ENUM_WORLD.WD_3NORIA,
    name: 'Noria',
    minLvl: 10,
    cost: 2000,
  },
  // {
  //   id: ENUM_WORLD.WD_51ELBELAND,
  //   name: 'Elveland',
  //   minLvl: 10,
  //   cost: 2000,
  // },
  {
    id: ENUM_WORLD.WD_2DEVIAS,
    name: 'Devias',
    minLvl: 20,
    cost: 2000,
  },
  {
    id: ENUM_WORLD.WD_1DUNGEON,
    name: 'Dungeon',
    minLvl: 30,
    cost: 3000,
  },
  {
    id: ENUM_WORLD.WD_7ATLANSE,
    name: 'Atlans',
    minLvl: 70,
    cost: 4000,
  },
  {
    id: ENUM_WORLD.WD_4LOSTTOWER,
    name: 'Lost Tower',
    minLvl: 50,
    cost: 5000,
  },
  {
    id: ENUM_WORLD.WD_8TARKAN,
    name: 'Tarkan',
    minLvl: 140,
    cost: 8000,
  },
  // {
  //   id: ENUM_WORLD.WD_33AIDA,
  //   name: 'Aida',
  //   minLvl: 150,
  //   cost: 8500,
  // },
  {
    id: ENUM_WORLD.WD_10ICARUS,
    name: 'Icarus',
    minLvl: 170,
    cost: 10000,
  },
];

const HOT_KEY = 'KeyM';

export const MapsList = observer(() => {
  const [show, setShow] = useState(false);
  const onMapClicked = (map: ENUM_WORLD) => {
    setShow(false);
    EventBus.emit('requestWarp', { map });
  };

  useEventBus('keyPressed', key => {
    if (key === HOT_KEY) {
      setShow(s => !s);
    }
  });

  if (!show) return null;

  return (
    <div className="maps-list">
      <p className="maps-list-title">{LL('warp-window.title')}</p>
      <table>
        <thead>
          <tr>
            <th>{LL('warp-window.map')}</th>
            <th>{LL('warp-window.min-lvl')}</th>
            <th>{LL('warp-window.cost')}</th>
          </tr>
        </thead>
        <tbody>
          {MAPS_LIST.map(map => {
            return (
              <tr key={map.id} onClick={() => onMapClicked(map.id)}>
                <td>{map.name}</td>
                <td>{map.minLvl}</td>
                <td>{map.cost}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button className="close-button" onClick={() => setShow(false)}>
        {LL('warp-window.close')}
      </button>
    </div>
  );
});
