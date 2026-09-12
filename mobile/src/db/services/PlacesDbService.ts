import { database } from '../index';
import { Q } from '@nozbe/watermelondb';
import PlacesSearchCache from '../models/PlacesSearchCache';
import { BackendPlace } from '../../api/maps/types';

export class PlacesDbService {
  /**
   * Retrieves cached place search results for an exact normalized query string.
   */
  static async getCachedPlaces(normalizedQuery: string): Promise<BackendPlace[] | null> {
    try {
      const collection = database.collections.get<PlacesSearchCache>('places_search_cache');
      const records = await collection
        .query(Q.where('query', normalizedQuery))
        .fetch();

      if (records.length > 0) {
        const record = records[0];
        const parsed = JSON.parse(record.resultsJson);
        return parsed as BackendPlace[];
      }
      return null;
    } catch (error) {
      console.error('[PlacesDbService] getCachedPlaces error:', error);
      return null;
    }
  }

  /**
   * Caches place search results for an exact normalized query string.
   */
  static async cachePlaces(normalizedQuery: string, places: BackendPlace[]): Promise<void> {
    try {
      await database.write(async () => {
        const collection = database.collections.get<PlacesSearchCache>('places_search_cache');
        const existing = await collection
          .query(Q.where('query', normalizedQuery))
          .fetch();

        const jsonString = JSON.stringify(places);
        const now = new Date().toISOString();

        if (existing.length > 0) {
          await existing[0].update((record) => {
            record.resultsJson = jsonString;
            record.cachedAt = now;
          });
        } else {
          await collection.create((record) => {
            record.query = normalizedQuery;
            record.resultsJson = jsonString;
            record.cachedAt = now;
          });
        }
      });
    } catch (error) {
      console.error('[PlacesDbService] cachePlaces error:', error);
    }
  }
}
