import { database } from '../index';
import ProfileModel from '../models/ProfileModel';
import { MeResponse, UpdateProfilePayload } from '../../api/auth/types';

export class ProfileDbService {
  /**
   * Upserts the full profile (MeResponse) fetched from the server into WatermelonDB.
   */
  static async syncProfile(data: MeResponse): Promise<void> {
    await database.write(async () => {
      const profilesCollection = database.get<ProfileModel>('profiles');
      const allProfiles = await profilesCollection.query().fetch();
      
      if (allProfiles.length > 0) {
        await allProfiles[0].update((p) => {
          p.staffId = data.staff_id || 0;
          p.userData = JSON.stringify(data.user || {});
          p.staffData = JSON.stringify(data.staff || {});
          p.accountData = JSON.stringify(data.account || {});
          p.roles = JSON.stringify(data.roles || []);
          p.permissions = JSON.stringify(data.permissions || []);
        });
      } else {
        await profilesCollection.create((p) => {
          p.staffId = data.staff_id || 0;
          p.userData = JSON.stringify(data.user || {});
          p.staffData = JSON.stringify(data.staff || {});
          p.accountData = JSON.stringify(data.account || {});
          p.roles = JSON.stringify(data.roles || []);
          p.permissions = JSON.stringify(data.permissions || []);
        });
      }
    });
  }

  /**
   * Optimistically updates the local profile when a user edits their photo or signature.
   */
  static async updateOptimistically(newProfileData: UpdateProfilePayload): Promise<void> {
    await database.write(async () => {
      const profilesCollection = database.get<ProfileModel>('profiles');
      const allProfiles = await profilesCollection.query().fetch();
      if (allProfiles.length > 0) {
        const profile = allProfiles[0];
        let userData: any = {};
        try {
          userData = JSON.parse(profile.userData);
        } catch (e) {
          // fallback to empty object if parsing fails
        }
        
        if (newProfileData.profile_photo !== undefined) {
          userData.ProfilePhoto = newProfileData.profile_photo;
        }
        if (newProfileData.signature_image !== undefined) {
          userData.SignatureImage = newProfileData.signature_image;
        }
        
        await profile.update((p) => {
          p.userData = JSON.stringify(userData);
        });
      }
    });
  }
}
