import { database } from '../index';
import NotificationModel from '../models/Notification';
import { Q } from '@nozbe/watermelondb';
import { NotificationRow } from '../../api/notifications/types';

export class NotificationDbService {
  /**
   * Syncs a batch of notifications from the server to the local database.
   */
  static async syncNotifications(apiNotifications: NotificationRow[]) {
    await database.write(async () => {
      const collection = database.collections.get<NotificationModel>('notifications');

      // Fetch existing records for this batch
      const apiIds = apiNotifications.map((req) => req.id);
      const existingRecords = await collection.query(
        Q.where('remote_id', Q.oneOf(apiIds))
      ).fetch();

      const existingMap = new Map(existingRecords.map((r) => [r.remoteId, r]));
      const recordsToBatch: any[] = [];

      for (const apiNotif of apiNotifications) {
        const existing = existingMap.get(apiNotif.id);

        if (existing) {
          recordsToBatch.push(
            existing.prepareUpdate((notif) => {
              notif.type = apiNotif.type;
              notif.category = apiNotif.category;
              notif.title = apiNotif.title;
              notif.message = apiNotif.message;
              notif.actionUrl = apiNotif.action_url || null;
              notif.isRead = apiNotif.is_read;
              notif.createdAt = apiNotif.created_at;
              notif.readAt = apiNotif.read_at || null;
            })
          );
        } else {
          recordsToBatch.push(
            collection.prepareCreate((notif) => {
              notif.remoteId = apiNotif.id;
              notif.type = apiNotif.type;
              notif.category = apiNotif.category;
              notif.title = apiNotif.title;
              notif.message = apiNotif.message;
              notif.actionUrl = apiNotif.action_url || null;
              notif.isRead = apiNotif.is_read;
              notif.createdAt = apiNotif.created_at;
              notif.readAt = apiNotif.read_at || null;
            })
          );
        }
      }

      await database.batch(...recordsToBatch);
    });
  }

  /**
   * Optimistically marks a specific notification as read.
   */
  static async markReadOptimistic(remoteId: number) {
    await database.write(async () => {
      const collection = database.collections.get<NotificationModel>('notifications');
      const records = await collection.query(Q.where('remote_id', remoteId)).fetch();

      if (records.length > 0) {
        await records[0].update((notif) => {
          notif.isRead = true;
          notif.readAt = new Date().toISOString();
        });
      }
    });
  }

  /**
   * Optimistically marks all notifications as read.
   */
  static async markAllReadOptimistic() {
    await database.write(async () => {
      const collection = database.collections.get<NotificationModel>('notifications');
      const unreadRecords = await collection.query(Q.where('is_read', false)).fetch();

      const batch = unreadRecords.map((record) =>
        record.prepareUpdate((notif) => {
          notif.isRead = true;
          notif.readAt = new Date().toISOString();
        })
      );

      if (batch.length > 0) {
        await database.batch(...batch);
      }
    });
  }
}
