import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class LeaveTypeModel extends Model {
  static table = 'leave_types';

  @field('remote_id') remoteId!: number | null;
  @field('name') name!: string;
  @field('code') code!: string;
  @field('advance_notice_days') advanceNoticeDays!: number | null;
  @field('medical_report_after_days') medicalReportAfterDays!: number | null;
}
