package services

import (
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

const ihrisSyncLockKey = "ihris_sync"

// StartBackgroundIhrisSync starts or resumes an iHRIS sync in a goroutine.
// Returns immediately with current status; leaving the browser does not stop the job.
func (s *IhrisSyncService) StartBackgroundIhrisSync(runID uint) (map[string]any, error) {
	unlock, ok := acquireSyncLock(ihrisSyncLockKey)
	if !ok {
		status, err := s.SyncStatus()
		if err != nil {
			return nil, err
		}
		status["message"] = "sync already running in this process"
		return status, nil
	}

	var run models.IhrisSyncRun
	if runID > 0 {
		if err := facades.Orm().Query().Where("id", runID).First(&run); err != nil || run.ID == 0 {
			unlock()
			return nil, fmt.Errorf("sync run not found")
		}
		if run.Status == "cancelled" || run.Status == "completed" {
			// Start a fresh run instead of failing when UI still has the old run_id.
			runID = 0
		} else if run.Status == "failed" {
			run.Status = "running"
			run.FinishedAt = nil
			_ = facades.Orm().Query().Save(&run)
		}
	}
	if runID == 0 {
		// Prefer continuing an incomplete running run; otherwise create a new one via first batch.
		_ = facades.Orm().Query().Order("id desc").First(&run)
		if run.ID > 0 && (run.Status == "running" || run.Status == "failed") {
			if run.Status == "failed" {
				run.Status = "running"
				run.FinishedAt = nil
				_ = facades.Orm().Query().Save(&run)
			}
			runID = run.ID
		}
	}

	go func(resumeID uint) {
		defer unlock()
		s.runIhrisBatches(resumeID)
	}(runID)

	// Give the worker a moment to create/update the run row.
	time.Sleep(50 * time.Millisecond)
	return s.SyncStatus()
}

func (s *IhrisSyncService) runIhrisBatches(runID uint) {
	for {
		var check models.IhrisSyncRun
		if runID > 0 {
			_ = facades.Orm().Query().Where("id", runID).First(&check)
			if check.ID > 0 && check.Status == "cancelled" {
				return
			}
		}

		result, err := s.SyncFromAPI(SyncBatchOptions{
			RunID:         runID,
			PagesPerBatch: 1,
		})
		if err != nil {
			return
		}
		runID = result.RunID
		if result.Status == "cancelled" || result.Status == "completed" || result.Status == "failed" || !result.HasMore {
			return
		}
	}
}

func (s *IhrisSyncService) CancelIhrisSync(runID uint) (map[string]any, error) {
	var run models.IhrisSyncRun
	if runID > 0 {
		if err := facades.Orm().Query().Where("id", runID).First(&run); err != nil || run.ID == 0 {
			return nil, fmt.Errorf("sync run not found")
		}
	} else {
		if err := facades.Orm().Query().Order("id desc").First(&run); err != nil || run.ID == 0 {
			return nil, fmt.Errorf("no sync run to cancel")
		}
	}
	if run.Status != "running" && run.Status != "failed" {
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

// ResumeBackgroundIhrisSync resumes the latest incomplete run or a specific run_id.
func (s *IhrisSyncService) ResumeBackgroundIhrisSync(runID uint) (map[string]any, error) {
	if runID == 0 {
		var run models.IhrisSyncRun
		_ = facades.Orm().Query().Order("id desc").First(&run)
		if run.ID == 0 {
			return nil, fmt.Errorf("no sync run to resume")
		}
		if run.Status == "completed" || run.Status == "cancelled" {
			return nil, fmt.Errorf("latest run is %s", run.Status)
		}
		runID = run.ID
	}
	return s.StartBackgroundIhrisSync(runID)
}
