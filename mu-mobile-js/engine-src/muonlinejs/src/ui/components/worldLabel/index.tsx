import { With } from 'miniplex';
import './style.less';
import { useRef } from 'react';
import { Entity } from '../../../ecs/world';
import { usePositionOnScreen } from '../../../hooks';

type Props = {
  entity: With<Entity, 'transform' | 'screenPosition'>;
  text: string;
};

export const WorldLabel = ({ entity, text }: Props) => {
  const elementRef = useRef<HTMLDivElement>(null);

  usePositionOnScreen(entity, elementRef, 0, 0);

  return (
    <div ref={elementRef} className="world-label">
      <div className="text">{text}</div>
    </div>
  );
};
