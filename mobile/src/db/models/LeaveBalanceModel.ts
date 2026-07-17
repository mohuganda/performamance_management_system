import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class LeaveBalanceModel extends Model {
  static table = 'leave_balances';

  @field('remote_id') remoteId!: number | null;
  @field('leave_type_id') leaveTypeId!: number;
  @field('entitled_days') entitledDays!: number;
  @field('used_days') usedDays!: number;
  @field('carried_over_days') carriedOverDays!: number;
}
