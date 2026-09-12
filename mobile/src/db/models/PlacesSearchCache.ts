import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class PlacesSearchCache extends Model {
  static table = 'places_search_cache';

  @field('query') query!: string;
  @field('results_json') resultsJson!: string;
  @field('cached_at') cachedAt!: string;
}
