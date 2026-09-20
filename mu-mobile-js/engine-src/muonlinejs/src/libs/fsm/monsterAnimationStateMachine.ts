import { With } from 'miniplex';
import { IdleState, State, StateMachine } from '.';
import { Entity, World } from '../../ecs/world';
import { MonsterActionType } from '../../common/objects/enum';

declare global {
  interface IStateMachineIncomingEvents {
    startMovement: void;
    stopMovement: void;
  }
}

export class MonsterAnimationStateMachine<
  TAnims extends number
> extends StateMachine {
  get attrSystem() {
    return this.npcEntity.attributeSystem;
  }

  idleState = new IdleState();
  walkState = new IdleState();
  // attackState = new State();
  // diedState = new State();
  // hitState = new State();

  get model() {
    return this.npcEntity.modelObject;
  }

  constructor(
    readonly npcEntity: With<Entity, 'modelObject'>,
    readonly world: World
  ) {
    super();

    this.idleState.actions.push({
      onEnter: () => {
        if (!this.model) return;

        this.model.CurrentAction = MonsterActionType.Stop1;
      },
    });

    this.walkState.actions.push({
      onEnter: () => {
        if (!this.model) return;

        const attrSystem = this.npcEntity.attributeSystem;
        let k = 1;
        if (
          attrSystem !== undefined &&
          attrSystem.hasAttribute('totalMovementSpeed')
        ) {
          k = attrSystem.getValue('totalMovementSpeed') * 2;
        }

        this.model.CurrentAction = MonsterActionType.Walk;
      },
    });

    // this.attackState.actions.push({
    //   onEnter: () => {
    //     this.playAttack();
    //   },
    //   onUpdate: () => {
    //     const animName = this.anims.attack.name;
    //     if (this.isAnimStopped(animName)) {
    //       this.goToIdle();
    //     }
    //   },
    // });

    // this.hitState.actions.push({
    //   onEnter: () => {
    //     this.playHit();
    //   },
    //   onUpdate: () => {
    //     if (!this.anims.hit) return;

    //     const animName = this.anims.hit.name;
    //     if (this.isAnimStopped(animName)) {
    //       this.goToIdle();
    //     }
    //   },
    // });

    // this.diedState.actions.push({
    //   onEnter: () => {
    //     this.playDying();
    //   }
    // });

    this.changeState(this.idleState);
  }

  private _acEventsSubscribed = false;
  private _finishedAnims: Record<TAnims, boolean> = {} as any;
  private _stoppedAnims: Record<TAnims, boolean> = {} as any;

  isAnimFinished(animName: TAnims): boolean {
    return this._finishedAnims[animName] === true;
  }

  // isAnimStopped(animName: TAnims): boolean {
  //   return this._stoppedAnims[animName] === true;
  // }

  update(dt: number): void {
    super.update(dt);

    if (this.model) {
      for (const k in this._finishedAnims) {
        this._finishedAnims[k] = false;
      }
      for (const k in this._stoppedAnims) {
        this._stoppedAnims[k] = false;
      }

      if (this._acEventsSubscribed) return;

      this._acEventsSubscribed = true;
    }
  }

  onAnimFinished(anim: number) {
    if (!anim) return;

    this._finishedAnims[anim as TAnims] = true;
  }

  onAnimStop(anim: number) {
    if (!anim) return;

    this._stoppedAnims[anim as TAnims] = true;
  }

  // private playAttack() {
  //   if (this.animationsController) {
  //     const attrSystem = this.npcEntity.attributeSystem;
  //     let coef = 1;
  //     if (attrSystem && attrSystem.hasAttribute('totalAttackSpeed')) {
  //       coef = attrSystem.getValue('totalAttackSpeed');
  //     }
  //     coef *= 1.3;

  //     if (coef < 0.7) {
  //       coef = 0.7;
  //     }
  //     // console.log(`log to attack: ${this.npcEntity.id}${this.npcEntity.model?.key}`);
  //     this.animationsController.play(
  //       this.anims.attack.name,
  //       coef * this.anims.attack.speed * this.world.RETARGET_ANIMATION_RATE,
  //       false
  //     );
  //   }
  // }

  // private playHit() {
  //   if (this.animationsController && this.anims.hit) {
  //     const hitName = this.anims.hit.name;

  //     // console.log(`log to attack: ${this.npcEntity.id}${this.npcEntity.model?.key}`);
  //     this.animationsController.play(
  //       hitName,
  //       this.anims.hit.speed * this.world.RETARGET_ANIMATION_RATE,
  //       false
  //     );
  //   }
  // }

  // private playDying() {
  //   if (!this.model) {
  //     this.world.bus.onDieAnimationFinished.notifyObservers(this.npcEntity);
  //     return;
  //   }
  //   const sub = this.animationsController.onAnimationEnd.add(anim => {
  //     if (anim.name !== this.anims.dying.name) return;
  //     sub.remove();
  //     this.world.bus.onDieAnimationFinished.notifyObservers(this.npcEntity);
  //   });

  //   this.animationsController.play(
  //     this.anims.dying.name,
  //     this.anims.dying.speed * this.world.RETARGET_ANIMATION_RATE,
  //     false
  //   );
  // }

  // private playWalk() {
  //   if (this.animationsController) {
  //     // console.log(`log to walk: ${npcEntity.id}${npcEntity.model?.key}${this.animationsController != null}`)
  //     this.animationsController.play(this.anims.walk.name, this.anims.walk.speed * this.world.RETARGET_ANIMATION_RATE, true);
  //   }
  // }

  private goToIdle(): void {
    this.changeState(this.idleState);
  }

  private goToWalk(): void {
    this.changeState(this.walkState);
  }

  // private goToAttack(): void {
  //   this.changeState(this.attackState);
  // }

  // private goToHit(): void {
  //   this.changeState(this.hitState);
  // }

  private goToDie(): void {
    this.changeState(this.diedState);
  }

  handleIncomeEvent<TKey extends keyof IStateMachineIncomingEvents>(
    evName: TKey,
    value: IStateMachineIncomingEvents[TKey]
  ): void {
    super.handleIncomeEvent(evName, value);

    switch (evName) {
      case 'idle': {
        this.goToIdle();
        break;
      }
      // case 'attack': {
      //   this.goToAttack();
      //   break;
      // }
      case 'die': {
        this.goToDie();
        break;
      }
      case 'startMovement': {
        if (this.currentState === this.idleState) {
          this.goToWalk();
        }
        break;
      }
      case 'stopMovement': {
        if (this.currentState === this.walkState) {
          this.goToIdle();
        }
        break;
      }
    }
  }
}
