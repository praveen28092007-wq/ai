import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { colors } from '../theme';
import { isOverThreshold, calcFineInr, effectiveBudgetKg, YEARLY_CO2_BUDGET_KG, FINE_RATE_INR_PER_KG } from '../lib/emissions';
import { GOV_DASHBOARD_URL } from '../lib/syncToGov';

async function fetchPeople() {
  try {
    const res = await fetch(`${GOV_DASHBOARD_URL}/api/people`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.people || [];
  } catch (e) {
    return [];
  }
}

async function issueFineApi(name, amountInr, reason) {
  try {
    const res = await fetch(`${GOV_DASHBOARD_URL}/api/people/${encodeURIComponent(name)}/fine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountInr, reason }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function decideRequestApi(name, requestId, approve) {
  try {
    const res = await fetch(
      `${GOV_DASHBOARD_URL}/api/people/${encodeURIComponent(name)}/permit-request/${requestId}/decide`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
      }
    );
    return res.ok;
  } catch (e) {
    return false;
  }
}

export default function GovernmentScreen() {
  const [tab, setTab] = useState('people'); // 'people' | 'requests'
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [fineTarget, setFineTarget] = useState(null);

  const refresh = useCallback(async () => {
    const p = await fetchPeople();
    setPeople(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [refresh]);

  const pendingRequests = people.flatMap((p) =>
    (p.permitRequests || [])
      .filter((r) => r.status === 'pending')
      .map((r) => ({ ...r, personName: p.name }))
  );

  const flaggedCount = people.filter((p) => isOverThreshold(p.totalCo2Kg, effectiveBudgetKg(p))).length;
  const visiblePeople = [...people]
    .filter((p) => !flaggedOnly || isOverThreshold(p.totalCo2Kg, effectiveBudgetKg(p)))
    .sort((a, b) => {
      const aFlagged = isOverThreshold(a.totalCo2Kg, effectiveBudgetKg(a));
      const bFlagged = isOverThreshold(b.totalCo2Kg, effectiveBudgetKg(b));
      if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
      return b.totalCo2Kg - a.totalCo2Kg;
    });

  async function handleDecide(personName, requestId, approve) {
    const ok = await decideRequestApi(personName, requestId, approve);
    if (ok) refresh();
    else Alert.alert('Could not save decision', 'Check your internet connection.');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.emoji}>🏛️</Text>
      <Text style={styles.title}>Enforcement Dashboard</Text>
      <Text style={styles.subtitle}>
        {loading
          ? 'Loading…'
          : flaggedCount === 0
          ? 'No one over the limit right now'
          : `${flaggedCount} of ${people.length} people over the limit`}
      </Text>
      <Text style={styles.disclaimer}>
        Demo model: {YEARLY_CO2_BUDGET_KG}kg CO2/year per person (all vehicles combined),
        fine = ₹{FINE_RATE_INR_PER_KG}/kg over that limit. Not a real policy.
      </Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'people' && styles.tabBtnActive]}
          onPress={() => setTab('people')}
        >
          <Text style={[styles.tabText, tab === 'people' && styles.tabTextActive]}>People & Fines</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
            KM Requests{pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'people' && (
        <>
          <View style={styles.filterRow}>
            <Switch value={flaggedOnly} onValueChange={setFlaggedOnly} />
            <Text style={styles.filterLabel}>Show only people over the limit</Text>
          </View>

          <FlatList
            data={visiblePeople}
            keyExtractor={(p) => p.name}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={!loading && <Text style={styles.subtext}>No one to show.</Text>}
            renderItem={({ item }) => {
              const budget = effectiveBudgetKg(item);
              const flagged = isOverThreshold(item.totalCo2Kg, budget);
              const fine = calcFineInr(item.totalCo2Kg, budget);
              return (
                <View style={[styles.row, flagged && styles.rowFlagged]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.regNo}>{item.name}</Text>
                      {flagged ? (
                        <View style={styles.badgeFlagged}>
                          <Text style={styles.badgeFlaggedText}>OVER LIMIT</Text>
                        </View>
                      ) : (
                        <View style={styles.badgeOk}>
                          <Text style={styles.badgeOkText}>OK</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.meta}>
                      {(item.vehicles || []).join(', ') || 'no vehicles'} · {item.totalKm.toFixed(0)} km ·{' '}
                      {item.totalCo2Kg.toFixed(1)} kg CO2
                    </Text>
                    <Text style={styles.metaBudget}>
                      Yearly limit: {budget} kg{item.budgetBonusKg > 0 ? ` (+${item.budgetBonusKg} approved)` : ''}
                    </Text>
                    {(item.fines || []).length > 0 && (
                      <Text style={styles.metaBudget}>
                        {item.fines.length} fine{item.fines.length > 1 ? 's' : ''} issued · total ₹
                        {item.fines.reduce((s, f) => s + f.amountInr, 0)}
                      </Text>
                    )}
                    {flagged && <Text style={styles.flagText}>Suggested fine: ₹{fine}</Text>}
                  </View>
                  {flagged && (
                    <TouchableOpacity onPress={() => setFineTarget(item)} style={styles.fineBtn}>
                      <Text style={styles.fineBtnText}>Issue Fine</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </>
      )}

      {tab === 'requests' && (
        <FlatList
          data={pendingRequests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.subtext}>No pending requests right now.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.regNo}>{item.personName}</Text>
                <Text style={styles.meta}>
                  Requesting +{item.extraKgRequested} kg extra yearly budget
                </Text>
                {!!item.reason && <Text style={styles.metaBudget}>&ldquo;{item.reason}&rdquo;</Text>}
                <View style={styles.decideRow}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleDecide(item.personName, item.id, true)}
                  >
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.denyBtn}
                    onPress={() => handleDecide(item.personName, item.id, false)}
                  >
                    <Text style={styles.denyBtnText}>Deny</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <FineModal
        person={fineTarget}
        onClose={() => setFineTarget(null)}
        onIssued={() => {
          setFineTarget(null);
          refresh();
        }}
      />
    </View>
  );
}

function FineModal({ person, onClose, onIssued }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Exceeded yearly CO2 emissions limit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (person) {
      const budget = effectiveBudgetKg(person);
      setAmount(String(calcFineInr(person.totalCo2Kg, budget)));
    }
  }, [person]);

  if (!person) return null;

  async function handleSubmit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      Alert.alert('Enter a valid amount');
      return;
    }
    setSaving(true);
    const ok = await issueFineApi(person.name, amt, reason);
    setSaving(false);
    if (ok) onIssued();
    else Alert.alert('Could not issue fine', 'Check your internet connection.');
  }

  return (
    <Modal visible={!!person} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Issue Fine</Text>
          <Text style={styles.subtext}>{person.name}</Text>

          <Text style={styles.inputLabel}>Amount (₹)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          <Text style={styles.inputLabel}>Reason</Text>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} />

          <Text style={styles.modalFootnote}>
            Creates a simulated fine record. The rider sees it next time they open their app
            or portal — no real payment is processed.
          </Text>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalFineBtn} onPress={handleSubmit} disabled={saving}>
              <Text style={styles.fineBtnText}>{saving ? 'Issuing…' : 'Issue Fine'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 56 },
  emoji: { fontSize: 34 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.subtext, fontSize: 14, marginTop: 4, marginBottom: 8 },
  disclaimer: { color: colors.subtext, fontSize: 11, fontStyle: 'italic', marginBottom: 14, lineHeight: 15 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.card },
  tabBtnActive: { backgroundColor: colors.accentDim },
  tabText: { color: colors.subtext, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  filterLabel: { color: colors.subtext, fontSize: 12 },
  subtext: { color: colors.subtext, fontSize: 13, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  rowFlagged: { borderColor: colors.danger },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  regNo: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  meta: { color: colors.subtext, fontSize: 12, marginTop: 6 },
  metaBudget: { color: colors.subtext, fontSize: 11, marginTop: 2, opacity: 0.7 },
  flagText: { color: colors.danger, fontSize: 14, fontWeight: '700', marginTop: 8 },
  badgeFlagged: { backgroundColor: colors.danger, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeFlaggedText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  badgeOk: { backgroundColor: colors.accentDim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOkText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  fineBtn: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  fineBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  decideRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  approveBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  denyBtn: { backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  denyBtnText: { color: colors.subtext, fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.bg, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 18, padding: 20 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
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
  modalFootnote: { color: colors.subtext, fontSize: 11, marginTop: 12, lineHeight: 15 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalCancelText: { color: colors.subtext, fontWeight: '700' },
  modalFineBtn: { flex: 1, backgroundColor: colors.danger, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
});
