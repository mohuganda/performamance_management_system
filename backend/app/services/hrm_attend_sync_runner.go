package services

import (
	"encoding/json"
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

const hrmAttendSyncLockKey = "hrm_attend_sync"

func (s *HrmAttendService) SyncStatus() (map[string]any, error) {
	var run models.HrmAttendSyncRun
	if err := facades.Orm().Query().Order("id desc").First(&run); err != nil || run.ID == 0 {
		return map[string]any{
			"status":           "idle",
			"last_sync_at":     s.settings.GetString("hrm_attend.last_sync_at", ""),
			"last_sync_status": s.settings.GetString("hrm_attend.last_sync_status", ""),
		}, nil
	}
	return map[string]any{
		"run_id":          run.ID,
		"status":          run.Status,
		"year_month":      run.YearMonth,
		"imported":        run.Imported,
		"skipped_unknown": run.SkippedUnknown,
		"skipped_invalid": run.SkippedInvalid,
		"total_fetched":   run.TotalFetched,
		"last_error":      run.LastError,
		"started_at":      run.StartedAt,
		"finished_at":     run.FinishedAt,
	}, nil
}

func (s *HrmAttendService) StartBackgroundHrmSync(yearMonth string, runID uint) (map[string]any, error) {
	unlock, ok := acquireSyncLock(hrmAttendSyncLockKey)
	if !ok {
		status, err := s.SyncStatus()
		if err != nil {
			return nil, err
		}
		status["message"] = "sync already running in this process"
		return status, nil
	}

	if yearMonth == "" {
		yearMonth = time.Now().AddDate(0, -1, 0).Format("2006-01")
	}

	var run models.HrmAttendSyncRun
	if runID > 0 {
		if err := facades.Orm().Query().Where("id", runID).First(&run); err != nil || run.ID == 0 {
			unlock()
			return nil, fmt.Errorf("sync run not found")
		}
		if run.Status == "cancelled" || run.Status == "completed" {
			unlock()
			return nil, fmt.Errorf("run %d is %s", run.ID, run.Status)
		}
		yearMonth = run.YearMonth
		run.Status = "running"
		run.FinishedAt = nil
		run.LastError = nil
		_ = facades.Orm().Query().Save(&run)
	} else {
		run = models.HrmAttendSyncRun{
			Status:    "running",
			YearMonth: yearMonth,
			StartedAt: time.Now(),
		}
		if err := facades.Orm().Query().Create(&run); err != nil {
			unlock()
			return nil, err
		}
	}

	go func(r models.HrmAttendSyncRun) {
		defer unlock()
		s.executeHrmSyncRun(&r)
	}(run)

	time.Sleep(50 * time.Millisecond)
	return s.SyncStatus()
}

func (s *HrmAttendService) executeHrmSyncRun(run *models.HrmAttendSyncRun) {
	// Re-check cancel before work
	var fresh models.HrmAttendSyncRun
	_ = facades.Orm().Query().Where("id", run.ID).First(&fresh)
	if fresh.ID > 0 && fresh.Status == "cancelled" {
		return
	}

	result, err := s.SyncMonthlySummaries(run.YearMonth)
	now := time.Now()
	_ = facades.Orm().Query().Where("id", run.ID).First(&fresh)
	if fresh.Status == "cancelled" {
		return
	}

	run.Imported = uint(result.Imported)
	run.SkippedUnknown = uint(result.SkippedUnknown)
	run.SkippedInvalid = uint(result.SkippedInvalid)
	run.TotalFetched = uint(result.TotalFetched)
	summary, _ := json.Marshal(result)
	summaryStr := string(summary)
	run.SummaryJSON = &summaryStr
	run.FinishedAt = &now
	if err != nil {
		msg := err.Error()
		run.LastError = &msg
		run.Status = "failed"
	} else {
		run.Status = "completed"
	}
	_ = facades.Orm().Query().Save(run)
}

func (s *HrmAttendService) CancelHrmSync(runID uint) (map[string]any, error) {
	var run models.HrmAttendSyncRun
	if runID > 0 {
		if err := facades.Orm().Query().Where("id", runID).First(&run); err != nil || run.ID == 0 {
			return nil, fmt.Errorf("sync run not found")
		}
	} else {
		if err := facades.Orm().Query().Order("id desc").First(&run); err != nil || run.ID == 0 {
			return nil, fmt.Errorf("no sync run to cancel")
		}
	}
	if run.Status != "running" {
		return s.SyncStatus()
	}
	now := time.Now()
	run.Status = "cancelled"
	run.FinishedAt = &now
	if err := facades.Orm().Query().Save(&run); err != nil {
		return nil, err
	}
	return s.SyncStatus()
}

func (s *HrmAttendService) ResumeBackgroundHrmSync(runID uint) (map[string]any, error) {
	if runID == 0 {
		var run models.HrmAttendSyncRun
		_ = facades.Orm().Query().Order("id desc").First(&run)
		if run.ID == 0 {
			return nil, fmt.Errorf("no sync run to resume")
		}
		if run.Status != "failed" && run.Status != "running" {
			return nil, fmt.Errorf("latest run is %s", run.Status)
		}
		runID = run.ID
	}
	return s.StartBackgroundHrmSync("", runID)
}
