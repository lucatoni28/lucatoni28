import { ModelObject } from '../../common/modelObject';
import { MODEL_GRASS01 } from '../../common/objects/enum';
import { Vector2 } from '../../libs/babylon/exports';

const TERRAIN_OFFSET = -10;
const WIND_UPDATE_INTERVAL = 32;
const BASE_WIND_INTENSITY = 0.015;
const WIND_SMOOTH_SPEED = 0.2;
const WIND_WAVE_SPEED = 0.2;
const MAX_ANGLE = 0.25;
const RANDOM_INTENSITY = 0.25;
const HEIGHT_INFLUENCE = 1.0;
const HEIGHT_GRADIENT = 0.5;

export class GrassObject extends ModelObject {
  private _lastWindUpdate;
  private _currentAngleX = 0;
  private _currentAngleZ = 0;
  private _targetAngleX = 0;
  private _targetAngleZ = 0;
  private _windTime = 0;
  private _windOffset: Vector2;
  private _modelHeight = 1.0;

  async init(): Promise<void> {
    // LightEnabled = true;
    this._windOffset = new Vector2(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    await this.loadSpecificModelWithDynamicID(MODEL_GRASS01, 'Grass');

    // Calculate model height and terrain height
    // this._modelHeight = (this.BoundingBoxLocal.maximum.z - this.BoundingBoxLocal.minimum.z) * TotalScale;
    // const terrainHeight = World.Terrain.RequestTerrainHeight(Position.X, Position.Y);

    // if (Position.Z < terrainHeight)
    // {
    //     return;
    // }

    // // Adjust position based on model type and terrain
    // if (this.Type === 25)
    // {
    //     // For these types, ensure they're properly grounded with slight elevation
    //     const baseHeight = terrainHeight + TERRAIN_OFFSET;
    //     Position = new Vector3(Position.X, Position.Y, baseHeight);
    // }
    // else if (this.Type === 24 || this.Type === 23 || this.Type === 22)
    // {
    //     Position = new Vector3(
    //         Position.X,
    //         Position.Y - 80f,
    //         terrainHeight + TERRAIN_OFFSET
    //     );
    // }
    // else
    // {
    //     Position = new Vector3(
    //         Position.X,
    //         Position.Y,
    //         Position.Z + TERRAIN_OFFSET
    //     );
    // }

    // // Additional height adjustment for ground cover types
    // if (this.IsGroundCoverType())
    // {
    //     this.AdjustGroundCoverHeight(terrainHeight);
    // }
  }

  //   IsGroundCoverType():boolean {
  //       return this.Type === 22 || this.Type === 23 || this.Type === 24 || this.Type === 25;
  //   }

  //  AdjustGroundCoverHeight( terrainHeight:number):void {
  //       // For ground cover, we want to ensure it follows terrain contours
  //       // Calculate the actual bottom point of the model in world space
  //       const modelBottom = Position.Z - (this._modelHeight * 0.5); // Assuming model origin is at center

  //       // If the model bottom is below terrain, raise it
  //       if (modelBottom < terrainHeight)
  //       {
  //           const adjustment = terrainHeight - modelBottom + TERRAIN_OFFSET;
  //           Position = new Vector3(Position.X, Position.Y, Position.Z + adjustment);
  //       }
  //   }

  // public override void Update(GameTime gameTime)
  // {
  //     base.Update(gameTime);

  //     float deltaTime = (float)gameTime.ElapsedGameTime.TotalSeconds;
  //     _windTime += deltaTime * WIND_WAVE_SPEED;

  //     if (gameTime.TotalGameTime.TotalMilliseconds - _lastWindUpdate >= WIND_UPDATE_INTERVAL)
  //     {
  //         _lastWindUpdate = (float)gameTime.TotalGameTime.TotalMilliseconds;
  //         UpdateWindTarget(deltaTime);
  //     }

  //     float smoothFactor = deltaTime * WIND_SMOOTH_SPEED;
  //     _currentAngleX = MathHelper.Lerp(_currentAngleX, _targetAngleX, smoothFactor);
  //     _currentAngleZ = MathHelper.Lerp(_currentAngleZ, _targetAngleZ, smoothFactor);

  //     ApplyWindEffect();
  // }

  // UpdateWindTarget( deltaTime:number):void
  // {
  //     var worldControl = World;
  //     if (worldControl?.Terrain == null) return;

  //     int terrainX = (int)(Position.X / Constants.TERRAIN_SCALE);
  //     int terrainY = (int)(Position.Y / Constants.TERRAIN_SCALE);

  //     float baseWind = worldControl.Terrain.GetWindValue(terrainX, terrainY) * BASE_WIND_INTENSITY;
  //     float windDirection = _windTime * 0.5f;

  //     float waveX = MathF.Sin(_windTime + _windOffset.X);
  //     float waveZ = MathF.Sin(_windTime + _windOffset.Y + MathF.PI * 0.25f);

  //     float randomX = ((float)_random.NextDouble() * 2 - 1) * RANDOM_INTENSITY * deltaTime;
  //     float randomZ = ((float)_random.NextDouble() * 2 - 1) * RANDOM_INTENSITY * deltaTime;

  //     _targetAngleX = (baseWind * MathF.Cos(windDirection) + waveX * BASE_WIND_INTENSITY + randomX) * HEIGHT_INFLUENCE;
  //     _targetAngleZ = (baseWind * MathF.Sin(windDirection) + waveZ * BASE_WIND_INTENSITY + randomZ) * HEIGHT_INFLUENCE;

  //     _targetAngleX = MathHelper.Clamp(_targetAngleX, -MAX_ANGLE, MAX_ANGLE);
  //     _targetAngleZ = MathHelper.Clamp(_targetAngleZ, -MAX_ANGLE, MAX_ANGLE);
  // }

  // ApplyWindEffect():void
  // {
  //     var position = Position;
  //     float effectiveHeight = _modelHeight * Scale;

  //     Matrix finalTransform = Matrix.Identity;
  //     const int sections = 5;

  //     for (int i = 0; i < sections; i++)
  //     {
  //         float heightFactor = (float)i / (sections - 1);
  //         float sectionInfluence = MathF.Pow(heightFactor, HEIGHT_GRADIENT);

  //         float sectionAngleX = _currentAngleX * sectionInfluence;
  //         float sectionAngleZ = _currentAngleZ * sectionInfluence;

  //         Matrix sectionTransform = Matrix.CreateScale(Scale) *
  //                                 Matrix.CreateRotationX(sectionAngleX) *
  //                                 Matrix.CreateRotationZ(sectionAngleZ);

  //         float sectionHeight = effectiveHeight * heightFactor;
  //         sectionTransform *= Matrix.CreateTranslation(new Vector3(position.X, position.Y + sectionHeight, position.Z));

  //         float blendFactor = (i == sections - 1) ? 1.0f : (1.0f / (sections - i));
  //         finalTransform = Matrix.Lerp(finalTransform, sectionTransform, blendFactor);
  //     }

  //     if (Parent != null)
  //     {
  //         finalTransform *= Parent.WorldPosition;
  //     }

  //     WorldPosition = finalTransform;
  // }
}
