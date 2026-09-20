import type { IVector3Like } from '../babylon/exports';
import type { With } from 'miniplex';
import { Vector3 } from '../babylon/exports';
import { Entity } from '../../ecs/world';

declare global {
  interface IStateMachineIncomingEvents {
    // attack: { skillId?: number; weapon?: WeaponSlots; };
    hit: void;
    idle: void;
    die: void;
  }
}

export class StateMachine {
  prevState: State | undefined;
  currentState: State | undefined;
  elapsedTime: number = 0;

  transitionInProgress = false;

  private _reqId = 0;

  changeState<TState extends State>(newState: TState) {
    if (this.currentState == newState) return;

    this._reqId++;
    const myReq = this._reqId;

    this.transitionInProgress = true;

    const oldCurrent = this.currentState;
    if (oldCurrent) {
      this.currentState = undefined;
      oldCurrent.onExit(this);
    }

    // there was another request, so ignore this
    if (myReq !== this._reqId) {
      return;
    }

    this.prevState = oldCurrent;
    this.currentState = newState;
    this.elapsedTime = 0;

    this.transitionInProgress = false;

    this.currentState.onEnter(this);
  }

  update(dt: number) {
    this.elapsedTime += dt;
    if (this.currentState != null) {
      this.currentState.onUpdate(this, dt);
    }
  }

  handleIncomeEvent<
    TKey extends keyof IStateMachineIncomingEvents,
    TValue extends IStateMachineIncomingEvents[TKey] = IStateMachineIncomingEvents[TKey]
  >(_: TKey, __: TValue): void {}
}

export interface IStateTransitionDecision<
  TFSM extends StateMachine = StateMachine
> {
  onUpdate?: (fsm: TFSM, dt: number) => void;
  check: (fsm: TFSM) => boolean;
}

export interface IStateAction<TFSM extends StateMachine = StateMachine> {
  onEnter?: (fsm: TFSM) => void;
  onUpdate?: (fsm: TFSM, dt: number) => void;
  onExit?: (fsm: TFSM) => void;
}

export interface IStateTransition<TFSM extends StateMachine = StateMachine> {
  decision: IStateTransitionDecision<TFSM>;
  nextState: State;
}

export class State<
  TData extends {} = {},
  TFSM extends StateMachine = StateMachine
> {
  actions: IStateAction<TFSM>[] = [];
  transitions: IStateTransition<TFSM>[] = [];

  readonly data: TData = {} as TData;

  onEnter(fsm: TFSM) {
    this.actions.forEach(a => a.onEnter && a.onEnter(fsm));
  }

  onUpdate(fsm: TFSM, dt: number) {
    // Check this State transitions
    for (const transition of this.transitions) {
      if (transition.decision.onUpdate != null) {
        transition.decision.onUpdate(fsm, dt);
      }
      const decisionResult = transition.decision.check(fsm);

      if (decisionResult) {
        fsm.changeState(transition.nextState);
        return;
      }
    }

    this.actions.forEach(a => a.onUpdate && a.onUpdate(fsm, dt));
  }

  onExit(fsm: TFSM) {
    this.actions.forEach(a => a.onExit && a.onExit(fsm));
  }
}

export class ElapsedTimeDecision<TFSM extends StateMachine = StateMachine>
  implements IStateTransitionDecision<TFSM>
{
  constructor(readonly delay: number) {}

  check(fsm: TFSM): boolean {
    return fsm.elapsedTime >= this.delay;
  }
}

export class TargetInRangeDecision<TFSM extends StateMachine = StateMachine>
  implements IStateTransitionDecision<TFSM>
{
  constructor(
    readonly pos: IVector3Like,
    readonly target: IVector3Like,
    readonly range: number
  ) {}

  check(_: TFSM): boolean {
    return Vector3.Distance(this.pos as any, this.target as any) <= this.range;
  }
}

export class TargetOutOfRangeDecision<TFSM extends StateMachine = StateMachine>
  implements IStateTransitionDecision<TFSM>
{
  constructor(
    readonly pos: IVector3Like,
    readonly target: IVector3Like,
    readonly range: number
  ) {}

  check(_: TFSM): boolean {
    return Vector3.Distance(this.pos as any, this.target as any) > this.range;
  }
}

export class OnDiedDecision<TFSM extends StateMachine = StateMachine>
  implements IStateTransitionDecision<TFSM>
{
  constructor(readonly entity: With<Entity, 'attributeSystem'>) {}

  check(_: TFSM): boolean {
    return this.entity.attributeSystem.getValue('currentHealth') <= 0.00001;
  }
}

export class IdleState extends State {
  constructor() {
    super();
  }
}
