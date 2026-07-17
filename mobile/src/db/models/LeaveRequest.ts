import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class LeaveRequest extends Model {
  static table = 'leave_requests';

  @field('remote_id') remoteId!: number | null;
  @field('leave_type_id') leaveTypeId!: number;
  @field('start_date') startDate!: string;
  @field('end_date') endDate!: string;
  @field('status') status!: string;
  @field('reason') reason!: string;
  @field('medical_report_url') medicalReportUrl!: string | null;
  @field('days_requested') daysRequested!: number | null;
}
