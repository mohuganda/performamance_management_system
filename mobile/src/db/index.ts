import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import migrations from './migrations';

import AttendanceLog from './models/AttendanceLog';
import LeaveRequest from './models/LeaveRequest';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'MohPmsWatermelonDB',
  jsi: true, /* (optional, but highly recommended) */
  onSetUpError: error => {
    console.error('WatermelonDB setup error', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    AttendanceLog,
    LeaveRequest,
  ],
});
