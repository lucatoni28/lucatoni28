import { ModelObject } from '../../common/modelObject';
import { MODEL_FIRE_LIGHT01 } from '../../common/objects/enum';

export class FireLightObject extends ModelObject {
  async init() {
    // LightEnabled = true;

    await this.loadSpecificModelWithDynamicID(MODEL_FIRE_LIGHT01, 'FireLight');
  }
}
