import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Notification extends Model {
  static table = 'notifications';

  @field('remote_id') remoteId!: number | null;
  @field('type') type!: string;
  @field('category') category!: string;
  @field('title') title!: string;
  @field('message') message!: string;
  @field('action_url') actionUrl!: string | null;
  @field('is_read') isRead!: boolean;
  @field('server_created_at') createdAt!: string;
  @field('read_at') readAt!: string | null;
}
