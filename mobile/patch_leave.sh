#!/bin/bash

# Update navigation imports
sed -i '' 's/useNavigation/useNavigation, useRoute/' src/modules/leave/LeaveRequestScreen.tsx
sed -i '' '/import { useTheme }/i\'$'\n''import { useSyncStore } from '\''../../stores/syncStore'\'';' src/modules/leave/LeaveRequestScreen.tsx
sed -i '' '/import LeaveTypeModel/a\'$'\n''import LeaveRequestModel from '\''../../db/models/LeaveRequest'\'';' src/modules/leave/LeaveRequestScreen.tsx

# Add route and syncStore logic
sed -i '' '/const navigation = useNavigation();/a\'$'\n''  const route = useRoute<any>();\n  const discardFailedMutation = useSyncStore((state) => state.discardFailedMutation);\n  const { editMode, localRecordId, queueId } = route.params || {};' src/modules/leave/LeaveRequestScreen.tsx

