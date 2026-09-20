import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = 'co2tracker.profile.v2';

// A profile is just the person: { name, activeRegNo }. Vehicles they own live in
// storage.js, keyed by ownerName, so one person can have many vehicles.

export async function loadProfile() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function saveProfile(profile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function setActiveVehicle(regNo) {
  const profile = await loadProfile();
  if (!profile) return null;
  const updated = { ...profile, activeRegNo: regNo };
  await saveProfile(updated);
  return updated;
}

export async function clearProfile() {
  await AsyncStorage.removeItem(PROFILE_KEY);
}
