import { database } from '../index';
import ApprovalTask from '../models/ApprovalTask';
import { ApprovalInboxItem, ApprovalInboxStats } from '../../api/approvals/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Q } from '@nozbe/watermelondb';

const STATS_STORAGE_KEY = 'approvals_inbox_stats';

export class ApprovalsDbService {
  /**
   * Syncs the inbox tasks to local DB.
   * Excludes any tasks that are already queued for offline mutation so we don't accidentally
   * re-add tasks the user has already approved locally but not yet synced.
   */
  static async syncInbox(apiTasks: ApprovalInboxItem[], queuedTaskIds: string[]) {
    await database.write(async () => {
      const collection = database.collections.get<ApprovalTask>('approval_tasks');
      const allLocal = await collection.query().fetch();
      
      const localMap = new Map();
      for (const task of allLocal) {
        if (task.remoteId) {
          localMap.set(task.remoteId, task);
        }
      }

      const ops: any[] = [];

      for (const apiTask of apiTasks) {
        // Skip tasks that the user has already acted upon locally
        if (queuedTaskIds.includes(apiTask.id)) {
          continue;
        }

        const local = localMap.get(apiTask.id);
        
        if (local) {
          ops.push(
            local.prepareUpdate((task: ApprovalTask) => {
              task.module = apiTask.module;
              task.typeLabel = apiTask.type_label;
              task.staffName = apiTask.staff_name;
              task.title = apiTask.title;
              task.subtitle = apiTask.subtitle;
              task.status = apiTask.status;
              task.stageName = apiTask.stage_name || null;
              task.submittedAt = apiTask.submitted_at || null;
              task.waitingDays = apiTask.waiting_days;
              task.canAct = apiTask.can_act;
              task.approvalId = apiTask.approval_id || null;
              task.requestId = apiTask.request_id || null;
              task.reportId = apiTask.report_id || null;
              task.ppaId = apiTask.ppa_id || null;
              task.metaString = apiTask.meta ? JSON.stringify(apiTask.meta) : null;
            })
          );
          localMap.delete(apiTask.id);
        } else {
          ops.push(
            collection.prepareCreate((task: ApprovalTask) => {
              task.remoteId = apiTask.id;
              task.module = apiTask.module;
              task.typeLabel = apiTask.type_label;
              task.staffName = apiTask.staff_name;
              task.title = apiTask.title;
              task.subtitle = apiTask.subtitle;
              task.status = apiTask.status;
              task.stageName = apiTask.stage_name || null;
              task.submittedAt = apiTask.submitted_at || null;
              task.waitingDays = apiTask.waiting_days;
              task.canAct = apiTask.can_act;
              task.approvalId = apiTask.approval_id || null;
              task.requestId = apiTask.request_id || null;
              task.reportId = apiTask.report_id || null;
              task.ppaId = apiTask.ppa_id || null;
              task.metaString = apiTask.meta ? JSON.stringify(apiTask.meta) : null;
            })
          );
        }
      }

      // Remove tasks that are no longer in the API inbox (e.g. approved by someone else or on another device)
      for (const [_, local] of localMap) {
        ops.push(local.prepareDestroyPermanently());
      }

      await database.batch(...ops);
    });
  }

  /**
   * Deletes a task from the local DB immediately upon offline action.
   */
  static async removeOptimisticTask(taskId: string) {
    await database.write(async () => {
      const collection = database.collections.get<ApprovalTask>('approval_tasks');
      const tasks = await collection.query(Q.where('remote_id', taskId)).fetch();
      if (tasks.length > 0) {
        await tasks[0].destroyPermanently();
      }
    });
  }

  /**
   * Saves inbox statistics.
   */
  static async saveStats(stats: ApprovalInboxStats) {
    try {
      await AsyncStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to save approval stats', e);
    }
  }

  /**
   * Retrieves inbox statistics.
   */
  static async getStats(): Promise<ApprovalInboxStats | null> {
    try {
      const val = await AsyncStorage.getItem(STATS_STORAGE_KEY);
      if (val) {
        return JSON.parse(val) as ApprovalInboxStats;
      }
    } catch (e) {
      console.error('Failed to load approval stats', e);
    }
    return null;
  }
}
