import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'attendance_logs',
          columns: [{ name: 'out_of_station_request_id', type: 'number', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        createTable({
          name: 'places_search_cache',
          columns: [
            { name: 'query', type: 'string', isIndexed: true },
            { name: 'results_json', type: 'string' },
            { name: 'cached_at', type: 'string' },
          ],
        }),
      ],
    },
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
