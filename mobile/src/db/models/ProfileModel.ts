import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

export default class ProfileModel extends Model {
  static table = 'profiles';

  @field('staff_id') staffId!: number;
  @field('user_data') userData!: string;
  @field('staff_data') staffData!: string;
  @field('account_data') accountData!: string;
  @field('roles') roles!: string;
  @field('permissions') permissions!: string;
}
