import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class OosRequest extends Model {
  static table = 'oos_requests';

  @field('remote_id') remoteId!: number | null;
  @field('reason_id') reasonId!: number;
  @field('start_date') startDate!: string;
  @field('end_date') endDate!: string;
  @field('remarks') remarks!: string | null;
  @field('expected_deliverables') expectedDeliverables!: string | null;
  @field('attachment_url') attachmentUrl!: string | null;
  @field('destination_name') destinationName!: string;
  @field('destination_address') destinationAddress!: string | null;
  @field('destination_latitude') destinationLatitude!: number;
  @field('destination_longitude') destinationLongitude!: number;
  @field('geofence_radius_meters') geofenceRadiusMeters!: number;
  @field('status') status!: string;
  @field('created_at') createdAt!: string | null;
  @field('submitted_at') submittedAt!: string | null;
  @field('staff_name') staffName!: string | null;
}
