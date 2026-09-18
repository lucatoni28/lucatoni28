import { Store } from '../../../store';
import './style.less';

export const PreloaderPage = () => {
  return (
    <div className="preloader-page">
      <div className="buttons">
        <button onClick={() => Store.playOffline()}>Play Offline</button>
      </div>
    </div>
  );
};
