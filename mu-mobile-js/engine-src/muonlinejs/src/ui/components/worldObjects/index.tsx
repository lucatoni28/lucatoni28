import { observer } from 'mobx-react-lite';
import { Store } from '../../../store';
import { useMemo, useState } from 'react';
import { WorldLabel } from '../worldLabel';
import { useRenderId } from '../../../hooks';

export const WorldObjects = observer(() => {
  const world = Store.world!;

  const { refresh } = useRenderId();

  const query = useMemo(
    () => world.with('transform', 'screenPosition'),
    [world]
  );

  useState(() => {
    const sub = query.onEntityAdded.subscribe(refresh);
    const sub2 = query.onEntityRemoved.subscribe(refresh);

    return () => {
      sub();
      sub2();
    };
  }, [query]);

  return (
    <div className="world-objects">
      {query.entities.map((entity, i) => {
        if (entity.objectNameInWorld)
          return (
            <WorldLabel
              entity={entity}
              key={i}
              text={entity.objectNameInWorld}
            />
          );

        return null;
      })}
    </div>
  );
});
