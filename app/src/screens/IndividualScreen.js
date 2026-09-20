import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { colors } from '../theme';
import { pulsesToVolumeMl, volumeMlToCo2Kg, YEARLY_CO2_BUDGET_KG, isOverThreshold } from '../lib/emissions';
import { useDistanceTracker } from '../lib/useDistanceTracker';
import { SimulatedSensorSource, generateDummyTrip } from '../lib/sensorSource';
import { upsertTrip, vehiclesOwnedBy } from '../lib/storage';
import { syncTripToGovDashboard } from '../lib/syncToGov';

export default function IndividualScreen({
  profile,
  vehicles,
  onTripSaved,
  onSwitchVehicle,
  onAddVehicle,
}) {
  const [running, setRunning] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const sensorRef = useRef(null);
  const distanceTracker = useDistanceTracker();

  useEffect(() => {
    return () => sensorRef.current?.stop?.();
  }, []);

  const myVehicles = vehiclesOwnedBy(vehicles, profile.name);
  const vehicle = myVehicles.find((v) => v.regNo === profile.activeRegNo) || myVehicles[0];

  const volumeMl = pulsesToVolumeMl(pulseCount);
  const tripCo2Kg = vehicle ? volumeMlToCo2Kg(volumeMl, vehicle.fuelType) : 0;

  const cumulativeCo2Kg = (vehicle?.cumulativeCo2Kg || 0) + tripCo2Kg;
  const overThreshold = isOverThreshold(cumulativeCo2Kg);
  const percentOfBudget = Math.min(150, Math.round((cumulativeCo2Kg / YEARLY_CO2_BUDGET_KG) * 100));

  async function startTrip() {
    setPulseCount(0);
    setRunning(true);
    await distanceTracker.start();
    sensorRef.current = new SimulatedSensorSource();
    sensorRef.current.start((delta) => setPulseCount((p) => p + delta));
  }

  async function stopTrip() {
    sensorRef.current?.stop?.();
    distanceTracker.stop();
    setRunning(false);
    await saveTrip({
      pulseCount,
      volumeMl,
      co2Kg: Number(tripCo2Kg.toFixed(3)),
      distanceKm: Number(distanceTracker.distanceKm.toFixed(3)),
    });
  }

  async function useDummyReading() {
    const dummy = generateDummyTrip();
    const dummyCo2Kg = volumeMlToCo2Kg(dummy.volumeMl, vehicle.fuelType);
    await saveTrip({
      pulseCount: dummy.pulseCount,
      volumeMl: dummy.volumeMl,
      co2Kg: Number(dummyCo2Kg.toFixed(3)),
      distanceKm: dummy.distanceKm,
    });
  }

  async function saveTrip(trip) {
    const fullTrip = { ts: Date.now(), ...trip };
    await upsertTrip(vehicle.regNo, fullTrip);
    onTripSaved?.();

    const sync = await syncTripToGovDashboard(profile.name, vehicle.regNo, vehicle.fuelType, fullTrip);

    Alert.alert(
      'Trip saved ✓',
      `${fullTrip.distanceKm} km ridden\n${fullTrip.co2Kg} kg CO2 produced\n\n` +
        (sync.synced ? 'Sent to the government dashboard.' : 'Saved on your phone (no internet right now).')
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyText}>No vehicle yet.</Text>
        <TouchableOpacity style={styles.startBtn} onPress={onAddVehicle}>
          <Text style={styles.btnText}>+ Add a Vehicle</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.hello}>Hi {profile.name} 👋</Text>

      <View style={styles.vehicleSwitcherRow}>
        {myVehicles.map((v) => (
          <TouchableOpacity
            key={v.regNo}
            style={[styles.vehicleChip, v.regNo === vehicle.regNo && styles.vehicleChipActive]}
            onPress={() => onSwitchVehicle(v.regNo)}
          >
            <Text
              style={[
                styles.vehicleChipText,
                v.regNo === vehicle.regNo && styles.vehicleChipTextActive,
              ]}
            >
              {v.regNo}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addVehicleChip} onPress={onAddVehicle}>
          <Text style={styles.addVehicleChipText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Current ride</Text>
        <Text style={styles.bigNumber}>{tripCo2Kg.toFixed(2)} kg CO2</Text>
        <Text style={styles.subtext}>
          {distanceTracker.distanceKm.toFixed(2)} km so far
          {distanceTracker.error ? ' (location not available)' : ''}
        </Text>

        {!running ? (
          <>
            <TouchableOpacity style={styles.startBtn} onPress={startTrip}>
              <Text style={styles.btnText}>▶  Start Ride</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dummyBtn} onPress={useDummyReading}>
              <Text style={styles.dummyBtnText}>⚡  Use a Dummy Reading Instead</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.stopBtn} onPress={stopTrip}>
            <Text style={styles.btnText}>■  Stop & Save Ride</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Your total this year</Text>
        <Text style={[styles.bigNumber, overThreshold && { color: colors.danger }]}>
          {cumulativeCo2Kg.toFixed(1)} kg CO2
        </Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, percentOfBudget)}%`,
                backgroundColor: overThreshold ? colors.danger : colors.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.subtext}>
          {percentOfBudget}% of your {YEARLY_CO2_BUDGET_KG} kg yearly limit
        </Text>

        {overThreshold && (
          <Text style={styles.warningText}>
            ⚠ You've gone over the limit. This shows up as flagged on the government dashboard.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Recent rides</Text>
        {(vehicle?.trips || []).length === 0 && (
          <Text style={styles.subtext}>No rides yet — start one above.</Text>
        )}
        {(vehicle?.trips || []).slice(0, 5).map((t) => (
          <View key={t.ts} style={styles.tripRow}>
            <Text style={styles.tripText}>
              {new Date(t.ts).toLocaleTimeString()} — {t.distanceKm} km, {t.co2Kg} kg CO2
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  emptyScreen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.subtext, fontSize: 15, marginBottom: 16 },
  hello: { color: colors.subtext, fontSize: 15, fontWeight: '600', marginBottom: 14 },
  vehicleSwitcherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  vehicleChip: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  vehicleChipActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  vehicleChipText: { color: colors.subtext, fontWeight: '700', fontSize: 13 },
  vehicleChipTextActive: { color: '#fff' },
  addVehicleChip: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addVehicleChipText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  cardLabel: { color: colors.subtext, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  bigNumber: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtext: { color: colors.subtext, fontSize: 13, marginTop: 4 },
  warningText: { color: colors.danger, marginTop: 12, fontWeight: '600', lineHeight: 18 },
  progressTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.inputBg,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 6 },
  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  stopBtn: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  dummyBtn: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  dummyBtnText: { color: colors.subtext, fontWeight: '700', fontSize: 14 },
  tripRow: { paddingVertical: 8, borderTopColor: colors.cardBorder, borderTopWidth: 1 },
  tripText: { color: colors.text, fontSize: 13 },
});
