import { ModelObject } from './modelObject';
import {
  Color3,
  Mesh,
  RawTexture,
  StandardMaterial,
  Texture,
  TransformNode,
  VertexBuffer,
  Scene,
  Vector3,
  Vector2,
} from '../libs/babylon/exports';
import { Queue } from './queue'; // предполагается, что есть тип Queue
// import { Constants } from './consts';

type Direction = number;

export abstract class WalkerObject extends ModelObject {
  // Fields: rotation and movement
  protected _targetAngle: Vector3;
  protected _direction: Direction;
  protected _location: Vector2;
  protected _currentPath: Queue<Vector2> | null = null; // FIFO – cheaper removal than List.RemoveAt(0)

  // Camera control
  // protected _currentCameraDistance: number = Constants.DEFAULT_CAMERA_DISTANCE;
  // protected _targetCameraDistance: number = Constants.DEFAULT_CAMERA_DISTANCE;
  // protected readonly _minCameraDistance: number = Constants.MIN_CAMERA_DISTANCE;
  // protected readonly _maxCameraDistance: number = Constants.MAX_CAMERA_DISTANCE;
  // protected readonly _zoomSpeed: number = Constants.ZOOM_SPEED;
  protected _previousScrollValue: number = 0;

  // Camera rotation
  // protected _cameraYaw: number = Constants.CAMERA_YAW;
  // protected _cameraPitch: number = Constants.CAMERA_PITCH;
  // protected readonly _rotationSensitivity: number =
  // Constants.ROTATION_SENSITIVITY;
  protected _isRotating: boolean = false;
  protected _wasRotating: boolean = false;

  // Default camera angles
  // protected readonly _defaultCameraDistance: number =
  // Constants.DEFAULT_CAMERA_DISTANCE;
  // protected static readonly _defaultCameraPitch: number =
  // Constants.DEFAULT_CAMERA_PITCH;
  // protected readonly _defaultCameraYaw: number = Constants.DEFAULT_CAMERA_YAW;

  // Rotation limits
  // protected static readonly _maxPitch: number = Constants.MAX_PITCH;
  // protected static readonly _minPitch: number = Constants.MIN_PITCH;

  protected static readonly RotationSpeed: number = 8;
  protected _previousActionForSound: number = -1;
  protected _serverControlledAnimation: boolean = false;

  // Properties
  get isMainWalker(): boolean {
    // TODO: реализовать проверку на основной Walker
    return false;
  }

  get location(): Vector2 {
    return this._location;
  }
  set location(value: Vector2) {
    this.onLocationChanged(this._location, value);
  }

  extraHeight: number = 0;

  get direction(): Direction {
    return this._direction;
  }
  set direction(value: Direction) {
    if (this._direction !== value) {
      this._direction = value;
      this.onDirectionChanged();
    }
  }

  get targetPosition(): Vector3 {
    // const x =
    //   this.location.x * Constants.TERRAIN_SCALE + 0.5 * Constants.TERRAIN_SCALE;
    // const y =
    //   this.location.y * Constants.TERRAIN_SCALE + 0.5 * Constants.TERRAIN_SCALE;
    // const z = this.world?.terrain?.requestTerrainHeight(x, y) ?? 0;
    // return new Vector3(x, y, z);

    return new Vector3(this.location.x, this.location.y, 0);
  }

  moveTargetPosition: Vector3 = Vector3.Zero();
  moveSpeed: number = 1;

  get isMoving(): boolean {
    return Vector3.Distance(this.moveTargetPosition, this.targetPosition) > 0;
  }
  networkId: number = 0;
  idanim: number = 0;

  // protected readonly _animationController: AnimationController;
  get isOneShotPlaying(): boolean {
    return /*this._animationController?.isOneShotPlaying ?? */ false;
  }

  // constructor() {
  //   super();
  //   // this._animationController = new AnimationController(this);
  // }

  async load(): Promise<void> {
    this.moveTargetPosition = Vector3.Zero();
    // TODO: заменить на актуальное получение значения скролла мыши
    this._previousScrollValue = 0;
    // this._cameraYaw = this._defaultCameraYaw;
    // this._cameraPitch = WalkerObject._defaultCameraPitch;
    await super.load?.();
  }

  reset() {
    this._currentPath = null;
    this.moveTargetPosition = Vector3.Zero();
  }

  onDirectionChanged() {
    // TODO: реализовать проверку типа WalkableWorldControl
    // if (this.world && (this.world as any).walker === this) {
    //   this._targetAngle = this._direction.toAngle();
    // } else {
    //   this.angle = this._direction.toAngle();
    // }
  }

  update(gameTime: GameTime) {
    super.Update(gameTime);
    // if (this.isMainWalker) this.handleMouseInput();
    // this.updatePosition(gameTime);
    this.animation(gameTime);
    // if (this._currentPath && this._currentPath.size() > 0 && !this.isMoving) {
    //   const next = this._currentPath.dequeue();
    //   if (next) this.moveTowards(next, gameTime);
    // }
    // if (this.CurrentAction !== this._previousActionForSound) {
    //   // TODO: реализовать MonsterObject
    //   this._previousActionForSound = this.CurrentAction;
    // }
  }

  private animation(gameTime: GameTime) {
    // TODO: реализовать анимацию (см. оригинальный код)
  }

  playAction(actionIndex: number, fromServer = false) {
    this._serverControlledAnimation = fromServer;
    // this._animationController?.playAnimation(actionIndex, fromServer);
  }

  moveTo(targetLocation: Vector2, sendToServer = true) {
    if (!this.world) return;
    // TODO: реализовать PlayerObject и Pathfinding
    const startPos = new Vector2(this.location.x, this.location.y);
    // const currentWorld = this.world;
    // _ = Task.Run(() => {
    //   let path = Pathfinding.findPath(startPos, targetLocation, currentWorld);

    //   // If no path was found for a remote object, fall back to a simple
    //   // straight-line path so that the character still moves visibly
    //   if ((path == null || path.Count == 0) && !sendToServer) {
    //     path = Pathfinding.buildDirectPath(startPos, targetLocation);
    //   }

    //   MuGame.scheduleOnMainThread(() => {
    //     if (
    //       MuGame.Instance.ActiveScene?.World != currentWorld ||
    //       this.status == GameControlStatus.Disposed
    //     )
    //       return;

    //     if (path == null || path.Count == 0) {
    //       this._currentPath?.clear();
    //       return;
    //     }

    //     this._currentPath = new Queue<Vector2>(path);

    //     if (sendToServer && this.isMainWalker) {
    //       Task.Run(() => this.sendWalkPathToServerAsync(path));
    //     }
    //   });
    // });
  }

  async sendWalkPathToServerAsync(path: Vector2[]): Promise<void> {
    if (!path || path.length === 0) return;
    const net = (window as any).MuGame?.Network;
    if (!net) return;

    const startX = Math.floor(this.location.x);
    const startY = Math.floor(this.location.y);

    function getClientDirectionCode(from: Vector2, to: Vector2): number {
      const dx = Math.round(to.x - from.x);
      const dy = Math.round(to.y - from.y);
      if (dx === -1 && dy === 0) return 0; // West
      if (dx === -1 && dy === 1) return 1; // South-West
      if (dx === 0 && dy === 1) return 2; // South
      if (dx === 1 && dy === 1) return 3; // South-East
      if (dx === 1 && dy === 0) return 4; // East
      if (dx === 1 && dy === -1) return 5; // North-East
      if (dx === 0 && dy === -1) return 6; // North
      if (dx === -1 && dy === -1) return 7; // North-West
      return 0xff; // Invalid direction
    }

    const clientDirs: number[] = [];
    let currentPos = this.location.clone();
    for (const step of path) {
      const dirCode = getClientDirectionCode(currentPos, step);
      if (dirCode > 7) break;
      clientDirs.push(dirCode);
      currentPos = step;
      if (clientDirs.length === 15) break;
    }
    if (clientDirs.length === 0) return;

    // directionMap и serverDirs
    const directionMap = net?.getDirectionMap?.();
    const serverDirs: number[] = clientDirs.map(cd =>
      directionMap && directionMap[cd] !== undefined ? directionMap[cd] : cd
    );

    await net.sendWalkRequestAsync(startX, startY, serverDirs);
  }

  // Private Methods
  protected onLocationChanged(oldLocation: Vector2, newLocation: Vector2) {
    if (oldLocation.equalsWithEpsilon(newLocation)) return;
    this._location.x = Math.floor(newLocation.x);
    this._location.y = Math.floor(newLocation.y);

    if (oldLocation.x === 0 && oldLocation.y === 0) return;

    const deltaX = Math.round(newLocation.x - oldLocation.x);
    const deltaY = Math.round(newLocation.y - oldLocation.y);
    // TODO: DirectionExtensions.GetDirectionFromMovementDelta
    // this.direction = getDirectionFromMovementDelta(deltaX, deltaY);
  }

  // protected updatePosition(gameTime: GameTime) {
  //     // TODO: заменить на корректную проверку типа WalkableWorldControl
  //     const walkableWorld = this.world as any;
  //     if (!walkableWorld) return;
  //     this.updateMoveTargetPosition(gameTime);
  //     const worldExtraHeight = walkableWorld.extraHeight ?? 0;
  //     const deltaTime = gameTime.elapsedGameTime;
  //     this._currentCameraDistance = lerp(
  //         this._currentCameraDistance,
  //         this._targetCameraDistance,
  //         this._zoomSpeed * deltaTime
  //     );
  //     this._currentCameraDistance = clamp(
  //         this._currentCameraDistance,
  //         this._minCameraDistance,
  //         this._maxCameraDistance
  //     );
  //     if (!this._targetAngle.equals(this.angle)) {
  //         const angleDifference = new Vector3(
  //             this._targetAngle.x - this.angle.x,
  //             this._targetAngle.y - this.angle.y,
  //             wrapAngle(this._targetAngle.z - this.angle.z)
  //         );
  //         const maxStep = WalkerObject.RotationSpeed * deltaTime;
  //         const stepZ = clamp(angleDifference.z, -maxStep, maxStep);
  //         this.angle = new Vector3(this.angle.x, this.angle.y, this.angle.z + stepZ);
  //         if (Math.abs(angleDifference.z) <= maxStep) {
  //             this.angle = new Vector3(this.angle.x, this.angle.y, this._targetAngle.z);
  //         }
  //     }

  //     const heightScaleFactor = 0.5;
  //     const terrainHeightAtMoveTarget = this.moveTargetPosition.Z + worldExtraHeight + this.extraHeight;
  //     const desiredHeightOffset = heightScaleFactor * terrainHeightAtMoveTarget;
  //     const targetHeight = terrainHeightAtMoveTarget + desiredHeightOffset;

  //     const interpolationFactor = 15 * deltaTime;
  //     const newZ = MathHelper.Lerp(this.position.Z, targetHeight, interpolationFactor);

  //     this.position = new Vector3(this.moveTargetPosition.X, this.moveTargetPosition.Y, newZ);
  // }

  // private updateMoveTargetPosition(time: GameTime) {
  //     if (this.moveTargetPosition == Vector3.Zero) {
  //         this.moveTargetPosition = this.targetPosition;
  //         this.updateCameraPosition(this.moveTargetPosition);
  //         return;
  //     }
  //     if (!this.isMoving) {
  //         this.moveTargetPosition = this.targetPosition;
  //         this.updateCameraPosition(this.moveTargetPosition);
  //         return;
  //     }

  //     const direction = this.targetPosition - this.moveTargetPosition;
  //     direction.Normalize();

  //     const deltaTime = time.elapsedGameTime.totalSeconds as number;
  //     const moveVector = direction.Scale(this.moveSpeed * deltaTime);

  //     if (moveVector.Length() >= (this.targetPosition - this.moveTargetPosition).Length())
  //         this.updateCameraPosition(this.targetPosition);
  //     else
  //         this.updateCameraPosition(this.moveTargetPosition.Add(moveVector));
  // }

  // private updateCameraPosition(position: Vector3) {
  //     this.moveTargetPosition = position;
  //     if (!this.isMainWalker) return;

  //     const x = this._currentCameraDistance * Math.cos(this._cameraPitch) * Math.sin(this._cameraYaw);
  //     const y = this._currentCameraDistance * Math.cos(this._cameraPitch) * Math.cos(this._cameraYaw);
  //     const z = this._currentCameraDistance * Math.sin(this._cameraPitch);
  //     const cameraOffset = new Vector3(x, y, z);
  //     const cameraPosition = position.Add(cameraOffset);

  //     Camera.Instance.FOV = 35;
  //     Camera.Instance.Position = cameraPosition;
  //     Camera.Instance.Target = position;
  // }

  // private moveTowards(target: Vector2, gameTime: GameTime) {
  //     this.location = target;

  //     // Проверка на MonsterObject через instanceof
  //     if ((typeof MonsterObject !== 'undefined') && this instanceof MonsterObject) {
  //         if (this._animationController?.isOneShotPlaying) return;
  //         const MONSTER_ACTION_WALK = 0; // TODO: заменить на актуальный индекс
  //         let moveAction = MONSTER_ACTION_WALK;
  //         // Проверка на run-анимацию
  //         if (this.model?.actions?.length > 1 && this.model.actions[1]?.numAnimationKeys > 0) {
  //             // Можно выбрать run вместо walk
  //         }
  //         if (this.currentAction !== moveAction) {
  //             this.playAction(moveAction);
  //         }
  //     }
  // }

  // private handleMouseInput() {
  //     const mouseState = MuGame.Instance.Mouse;
  //     const currentScroll = mouseState.ScrollWheelValue;
  //     const scrollDiff = currentScroll - this._previousScrollValue;
  //     if (scrollDiff != 0) {
  //         const zoomChange = scrollDiff / 120 * 100;
  //         this._targetCameraDistance = MathHelper.Clamp(
  //             this._targetCameraDistance - zoomChange,
  //             this._minCameraDistance,
  //             this._maxCameraDistance);
  //     }
  //     this._previousScrollValue = currentScroll;

  //     if (mouseState.MiddleButton == ButtonState.Pressed) {
  //         if (!this._isRotating) {
  //             this._isRotating = true;
  //             this._wasRotating = false;
  //         } else {
  //             const delta = mouseState.Position.Subtract(MuGame.Instance.PrevMouseState.Position).ToVector2();
  //             if (delta.LengthSquared() > 0) {
  //                 this._cameraYaw -= delta.X * this._rotationSensitivity;
  //                 this._cameraPitch = MathHelper.Clamp(this._cameraPitch - delta.Y * this._rotationSensitivity, this._minPitch, this._maxPitch);
  //                 this._cameraYaw = MathHelper.WrapAngle(this._cameraYaw);
  //                 this._wasRotating = true;
  //             }
  //         }
  //     } else if (mouseState.MiddleButton == ButtonState.Released &&
  //                  MuGame.Instance.PrevMouseState.MiddleButton == ButtonState.Pressed)
  //     {
  //         if (!this._wasRotating) {
  //             this._targetCameraDistance = this._defaultCameraDistance;
  //             this._cameraYaw = this._defaultCameraYaw;
  //             this._cameraPitch = this._defaultCameraPitch;
  //         }
  //         this._isRotating = false;
  //         this._wasRotating = false;
  //     }
  // }

  // protected override void Dispose(bool disposing)
  // {
  //     if (disposing)
  //     {
  //         _animationController?.Dispose();
  //     }
  //     base.Dispose(disposing);
  // }
}
