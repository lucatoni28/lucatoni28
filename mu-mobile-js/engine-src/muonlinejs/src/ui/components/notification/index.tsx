import './style.less';
import { observer } from 'mobx-react-lite';
import { Store, Notification as NotificationType } from '../../../store';

const Message = ({ text, type }: NotificationType) => {
  return <div className={'message ' + type}>{text}</div>;
};

export const Notification = observer(() => {
  return (
    <div className="notification">
      {Store.notifications.map((notification, index) => (
        <Message
          key={index}
          text={notification.text}
          type={notification.type}
        />
      ))}
    </div>
  );
});
