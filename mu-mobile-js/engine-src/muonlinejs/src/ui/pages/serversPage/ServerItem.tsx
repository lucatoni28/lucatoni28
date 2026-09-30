import React from 'react';

interface ServerItemProps {
  name: string;
  load: number; // 0-100
  onClick?: () => void;
}

export const ServerItem: React.FC<ServerItemProps> = ({ name, load, onClick }) => {
  // Цвет заполненности: зелёный < 50, жёлтый < 80, красный >= 80
  let loadColor = '#4caf50';
  if (load >= 80) loadColor = '#f44336';
  else if (load >= 50) loadColor = '#ff9800';

  return (
    <div className="server-item" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <span className="server-name">{name}</span>
      <span className="server-load" style={{ color: loadColor }}>{load}%</span>
    </div>
  );
};
