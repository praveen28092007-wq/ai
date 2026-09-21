import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme';
import { loadVehicles } from './src/lib/storage';
import { loadProfile, setActiveVehicle } from './src/lib/profile';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AddVehicleScreen from './src/screens/AddVehicleScreen';
import IndividualScreen from './src/screens/IndividualScreen';
import GovernmentScreen from './src/screens/GovernmentScreen';

export default function App() {
  const [tab, setTab] = useState('individual');
  const [vehicles, setVehicles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [addingVehicle, setAddingVehicle] = useState(false);

  const refresh = useCallback(async () => {
    setVehicles(await loadVehicles());
  }, []);

  useEffect(() => {
    (async () => {
      setProfile(await loadProfile());
      setCheckingProfile(false);
    })();
  }, []);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  if (checkingProfile) {
    return (
      <SafeAreaView style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return <OnboardingScreen onDone={async () => setProfile(await loadProfile())} />;
  }

  if (addingVehicle) {
    return (
      <AddVehicleScreen
        ownerName={profile.name}
        onCancel={() => setAddingVehicle(false)}
        onAdded={async (regNo) => {
          const updated = await setActiveVehicle(regNo);
          setProfile(updated);
          setAddingVehicle(false);
        }}
      />
    );
  }

  async function handleSwitchVehicle(regNo) {
    const updated = await setActiveVehicle(regNo);
    setProfile(updated);
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {tab === 'individual' ? (
          <IndividualScreen
            profile={profile}
            vehicles={vehicles}
            onTripSaved={refresh}
            onSwitchVehicle={handleSwitchVehicle}
            onAddVehicle={() => setAddingVehicle(true)}
          />
        ) : (
          <GovernmentScreen />
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'individual' && styles.tabBtnActive]}
          onPress={() => setTab('individual')}
        >
          <Text style={styles.tabIcon}>🏍️</Text>
          <Text style={[styles.tabLabel, tab === 'individual' && styles.tabLabelActive]}>
            My Vehicles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'government' && styles.tabBtnActive]}
          onPress={() => setTab('government')}
        >
          <Text style={styles.tabIcon}>🏛️</Text>
          <Text style={[styles.tabLabel, tab === 'government' && styles.tabLabelActive]}>
            Government
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderTopColor: colors.cardBorder,
    borderTopWidth: 1,
    backgroundColor: colors.card,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.tabActive },
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabLabel: { color: colors.subtext, fontWeight: '600', fontSize: 12 },
  tabLabelActive: { color: colors.accent },
});
