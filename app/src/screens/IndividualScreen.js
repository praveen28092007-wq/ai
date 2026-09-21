import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { colors } from '../theme';
import {
  pulsesToVolumeMl,
  volumeMlToCo2Kg,
  YEARLY_CO2_BUDGET_KG,
  effectiveBudgetKg,
  isOverThreshold,
} from '../lib/emissions';
import { useDistanceTracker } from '../lib/useDistanceTracker';
import { SimulatedSensorSource, generateDummyTrip } from '../lib/sensorSource';
import { upsertTrip, vehiclesOwnedBy } from '../lib/storage';
import {
  syncTripToGovDashboard,
  fetchPersonState,
  markNotificationsRead,
  requestMoreKm,
} from '../lib/syncToGov';

export default function IndividualScreen({
  profile,
  vehicles,
  onTripSaved,
  onSwitchVehicle,
  onAddVehicle,
}) {
  const [running, setRunning] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const [person, setPerson] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const sensorRef = useRef(null);
  const distanceTracker = useDistanceTracker();

  const refreshPerson = useCallback(async () => {
    const p = await fetchPersonState(profile.name);
    setPerson(p);
  }, [profile.name]);

  useEffect(() => {
    refreshPerson();
    const id = setInterval(refreshPerson, 8000);
    return () => clearInterval(id);
  }, [refreshPerson]);

  useEffect(() => {
    return () => sensorRef.current?.stop?.();
  }, []);

  const myVehicles = vehiclesOwnedBy(vehicles, profile.name);
  const vehicle = myVehicles.find((v) => v.regNo === profile.activeRegNo) || myVehicles[0];

  const volumeMl = pulsesToVolumeMl(pulseCount);
  const tripCo2Kg = vehicle ? volumeMlToCo2Kg(volumeMl, vehicle.fuelType) : 0;

  const totalCo2Kg = myVehicles.reduce((sum, v) => sum + (v.cumulativeCo2Kg || 0), 0) + tripCo2Kg;
  const budget = effectiveBudgetKg(person);
  const overThreshold = isOverThreshold(totalCo2Kg, budget);
  const percentOfBudget = Math.min(150, Math.round((totalCo2Kg / budget) * 100));
  const unreadCount = person?.unreadCount || 0;

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

  async function openNotifications() {
    setShowNotifications(true);
    if (unreadCount > 0) {
      await markNotificationsRead(profile.name);
      refreshPerson();
    }
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
      <View style={styles.headerRow}>
        <Text style={styles.hello}>Hi {profile.name} 👋</Text>
        <TouchableOpacity onPress={openNotifications} style={styles.bellBtn}>
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

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
        <Text style={styles.cardLabel}>Your total this year (all vehicles)</Text>
        <Text style={[styles.bigNumber, overThreshold && { color: colors.danger }]}>
          {totalCo2Kg.toFixed(1)} kg CO2
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
          {percentOfBudget}% of your {budget} kg yearly limit
          {person?.budgetBonusKg > 0 ? ` (${YEARLY_CO2_BUDGET_KG} base + ${person.budgetBonusKg} approved)` : ''}
        </Text>

        {overThreshold && (
          <Text style={styles.warningText}>
            ⚠ You've gone over the limit. This shows up as flagged on the government dashboard.
          </Text>
        )}

        <TouchableOpacity style={styles.requestBtn} onPress={() => setShowRequestForm(true)}>
          <Text style={styles.requestBtnText}>🚧  Request More KM</Text>
        </TouchableOpacity>
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

      <NotificationsModal
        visible={showNotifications}
        person={person}
        onClose={() => setShowNotifications(false)}
      />
      <RequestKmModal
        visible={showRequestForm}
        ownerName={profile.name}
        onClose={() => setShowRequestForm(false)}
        onSent={() => {
          setShowRequestForm(false);
          refreshPerson();
        }}
      />
    </ScrollView>
  );
}

function NotificationsModal({ visible, person, onClose }) {
  const fines = person?.fines || [];
  const decidedRequests = (person?.permitRequests || []).filter((r) => r.status !== 'pending');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }}>
            {fines.length === 0 && decidedRequests.length === 0 && (
              <Text style={styles.subtext}>Nothing here yet.</Text>
            )}
            {fines.map((f) => (
              <View key={f.id} style={styles.notifCardDanger}>
                <Text style={styles.notifTitleDanger}>Fine issued: ₹{f.amountInr}</Text>
                {!!f.reason && <Text style={styles.notifBody}>{f.reason}</Text>}
                <Text style={styles.notifTime}>{new Date(f.issuedAt).toLocaleString()}</Text>
              </View>
            ))}
            {decidedRequests.map((r) => (
              <View
                key={r.id}
                style={r.status === 'approved' ? styles.notifCardSuccess : styles.notifCardNeutral}
              >
                <Text style={r.status === 'approved' ? styles.notifTitleSuccess : styles.notifTitleNeutral}>
                  KM request {r.status === 'approved' ? 'approved' : 'denied'}: +{r.extraKgRequested} kg
                </Text>
                <Text style={styles.notifTime}>{new Date(r.decidedAt).toLocaleString()}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RequestKmModal({ visible, ownerName, onClose, onSent }) {
  const [extraKg, setExtraKg] = useState('200');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const amount = Number(extraKg);
    if (!amount || amount <= 0) {
      Alert.alert('Enter a valid amount');
      return;
    }
    setSaving(true);
    const result = await requestMoreKm(ownerName, amount, reason);
    setSaving(false);
    if (result.sent) {
      onSent();
    } else {
      Alert.alert('Could not send request', result.reason);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Request More KM</Text>
          <Text style={styles.subtext}>
            Like a toll gate — ask for extra yearly CO2 budget. Government reviews and can
            approve or deny.
          </Text>

          <Text style={styles.inputLabel}>Extra CO2 budget (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={extraKg}
            onChangeText={setExtraKg}
          />

          <Text style={styles.inputLabel}>Reason</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            multiline
            placeholder="e.g. Long trip planned next month"
            placeholderTextColor={colors.subtext}
            value={reason}
            onChangeText={setReason}
          />

          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSubmit} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Sending…' : 'Send Request'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  emptyScreen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.subtext, fontSize: 15, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  hello: { color: colors.subtext, fontSize: 15, fontWeight: '600' },
  bellBtn: { padding: 4 },
  bellIcon: { fontSize: 20 },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
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
  requestBtn: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  requestBtnText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  dummyBtnText: { color: colors.subtext, fontWeight: '700', fontSize: 14 },
  tripRow: { paddingVertical: 8, borderTopColor: colors.cardBorder, borderTopWidth: 1 },
  tripText: { color: colors.text, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: {
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  modalClose: { color: colors.subtext, fontSize: 16 },
  notifCardDanger: {
    borderColor: 'rgba(224,80,63,0.4)',
    borderWidth: 1,
    backgroundColor: 'rgba(224,80,63,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  notifTitleDanger: { color: colors.danger, fontWeight: '800', fontSize: 14 },
  notifCardSuccess: {
    borderColor: 'rgba(51,193,122,0.4)',
    borderWidth: 1,
    backgroundColor: 'rgba(51,193,122,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  notifTitleSuccess: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  notifCardNeutral: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  notifTitleNeutral: { color: colors.text, fontWeight: '700', fontSize: 14 },
  notifBody: { color: colors.text, fontSize: 12, marginTop: 4 },
  notifTime: { color: colors.subtext, fontSize: 11, marginTop: 4 },
  inputLabel: { color: colors.subtext, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: {
    flex: 1,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.subtext, fontWeight: '700' },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
});
