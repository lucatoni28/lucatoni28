import { ModelObject } from '../../common/modelObject';

export class CandleObject extends ModelObject {
  async init() {
    // LightEnabled = true;

    await this.loadSpecificModel(`Candle01.glb`);
  }
}
