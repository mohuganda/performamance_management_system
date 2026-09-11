package services

import "sync"

var syncProcessLocks sync.Map // key string -> *sync.Mutex

func acquireSyncLock(key string) (unlock func(), ok bool) {
	raw, _ := syncProcessLocks.LoadOrStore(key, &sync.Mutex{})
	mu := raw.(*sync.Mutex)
	if !mu.TryLock() {
		return nil, false
	}
	return mu.Unlock, true
}
