import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class ApprovalTask extends Model {
  static table = 'approval_tasks';

  @field('remote_id') remoteId!: string | null;
  @field('module') module!: string;
  @field('type_label') typeLabel!: string;
  @field('staff_name') staffName!: string;
  @field('title') title!: string;
  @field('subtitle') subtitle!: string;
  @field('status') status!: string;
  @field('stage_name') stageName!: string | null;
  @field('submitted_at') submittedAt!: string | null;
  @field('waiting_days') waitingDays!: number;
  @field('can_act') canAct!: boolean;
  @field('approval_id') approvalId!: number | null;
  @field('request_id') requestId!: number | null;
  @field('report_id') reportId!: number | null;
  @field('ppa_id') ppaId!: number | null;
  @field('meta_string') metaString!: string | null;
}
