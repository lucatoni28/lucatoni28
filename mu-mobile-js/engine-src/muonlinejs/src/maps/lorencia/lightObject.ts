import { ModelObject } from '../../common/modelObject';
import { MODEL_LIGHT01 } from '../../common/objects/enum';

export class LightObject extends ModelObject {
  async init() {
    // LightEnabled = true;

    await this.loadSpecificModelWithDynamicID(MODEL_LIGHT01, 'Light');
  }
}
