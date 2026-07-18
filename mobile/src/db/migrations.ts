import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'attendance_logs',
          columns: [{ name: 'sync_error', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'leave_requests',
          columns: [{ name: 'sync_error', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'oos_requests',
          columns: [{ name: 'sync_error', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [],
    },
    {
      toVersion: 2,
      steps: [],
    },
  ],
});
