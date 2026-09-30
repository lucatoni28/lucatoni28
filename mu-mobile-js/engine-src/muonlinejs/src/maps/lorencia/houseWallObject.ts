import { getMaterial } from '../../common/modelLoader';
import { ModelObject } from '../../common/modelObject';
import { BlendState, MODEL_HOUSE_WALL01 } from '../../common/objects/enum';
import { Rand } from '../../common/rand';
import { World } from '../../ecs/world';
import { Scalar } from '../../libs/babylon/exports';

export class HouseWallObject extends ModelObject {
  _flickerEnabled = false;
  _flickerAlpha = 1;
  _flickerStart = 1;
  _flickerTarget = 1;
  _flickerDur = 0;
  _flickerElapsed = 0;

  async init(world: World) {
    // LightEnabled = true;

    await this.loadSpecificModelWithDynamicID(MODEL_HOUSE_WALL01, 'HouseWall');

    const idx = this.Type - MODEL_HOUSE_WALL01 + 1;

    if (idx === 2) {
      this._flickerEnabled = true;
      this._flickerStart = 1;
      this._flickerTarget = Rand.nextFloat(0.85, 1); // 0.85–1.0
      this._flickerDur = Rand.nextFloat(0.1, 0.2); // 0.10–0.20s
      this._flickerElapsed = 0;

      const m = this.getMesh(4);
      if (m) {
        m.material = getMaterial(world.scene, false, 2, BlendState.ALPHA_ADD);
      }
    }
  }

  Update(gameTime: World['gameTime']): void {
    super.Update(gameTime);

    // Flicker effect
    if (this._flickerEnabled) {
      const dt = gameTime.TotalGameTime.TotalSeconds;
      this._flickerElapsed += dt;

      if (this._flickerElapsed >= this._flickerDur) {
        this._flickerStart = this._flickerTarget;
        this._flickerTarget = Rand.nextFloat(0.85, 1);
        this._flickerDur = Rand.nextFloat(0.1, 0.2);
        this._flickerElapsed = 0;
      }

      const t = Scalar.Clamp(this._flickerElapsed / this._flickerDur, 0, 1);
      const smoothStep = t * t * (3 - 2 * t);
      this._flickerAlpha = Scalar.Lerp(
        this._flickerStart,
        this._flickerTarget,
        smoothStep
      );
    }
  }

  DrawMesh(mesh: number): void {
    super.DrawMesh(mesh);

    // Apply flicker effect to the material
    if (this._flickerEnabled && mesh === 4) {
      const m = this.getMesh(mesh);
      if (m) {
        m.visibility = this._flickerAlpha;
      }
    }
  }
}
