import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class AttendanceLog extends Model {
  static table = 'attendance_logs';

  @field('remote_id') remoteId!: number | null;
  @field('action') action!: string;
  @field('clocked_at') clockedAt!: string;
  @field('server_created_at') createdAt!: string | null;
  @field('latitude') latitude!: number;
  @field('longitude') longitude!: number;
  @field('accuracy_meters') accuracyMeters!: number | null;
  @field('verified') verified!: boolean | null;
  @field('within_geofence') withinGeofence!: boolean | null;
  @field('notes') notes!: string | null;
  @field('location_label') locationLabel!: string | null;
  @field('verification_status') verificationStatus!: string | null;
  @field('distance_from_destination_meters') distanceFromDestinationMeters!: number | null;
}
