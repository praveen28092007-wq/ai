import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { colors } from '../theme';
import { isOverThreshold, excessChargeInr, YEARLY_CO2_BUDGET_KG, EXCESS_RATE_INR_PER_KM } from '../lib/emissions';
import { resetVehicle } from '../lib/storage';

export default function GovernmentScreen({ vehicles, onChanged }) {
  const flaggedCount = vehicles.filter((v) => isOverThreshold(v.cumulativeCo2Kg)).length;

  const sorted = [...vehicles].sort((a, b) => {
    const aFlagged = isOverThreshold(a.cumulativeCo2Kg);
    const bFlagged = isOverThreshold(b.cumulativeCo2Kg);
    if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
    return b.cumulativeCo2Kg - a.cumulativeCo2Kg;
  });

  async function handleReset(regNo) {
    Alert.alert('Reset this vehicle?', `${regNo}'s totals will go back to zero.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await resetVehicle(regNo);
          onChanged?.();
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.emoji}>🏛️</Text>
      <Text style={styles.title}>Enforcement Dashboard</Text>
      <Text style={styles.subtitle}>
        {flaggedCount === 0
          ? 'No vehicles over the limit right now'
          : `${flaggedCount} of ${vehicles.length} vehicles over the limit`}
      </Text>
      <Text style={styles.disclaimer}>
        Prices shown (₹{EXCESS_RATE_INR_PER_KM}/km over budget) are a proposed idea for the
        pitch only — nothing here is a real charge.
      </Text>

      <FlatList
        data={sorted}
        keyExtractor={(v) => v.regNo}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const flagged = isOverThreshold(item.cumulativeCo2Kg);
          const charge = excessChargeInr(item.cumulativeCo2Kg, item.cumulativeKm);
          return (
            <View style={[styles.row, flagged && styles.rowFlagged]}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowHeader}>
                  <Text style={styles.regNo}>{item.regNo}</Text>
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
                  {item.fuelType} · {item.cumulativeKm.toFixed(0)} km · {item.cumulativeCo2Kg.toFixed(1)} kg CO2
                </Text>
                <Text style={styles.metaBudget}>Yearly limit: {YEARLY_CO2_BUDGET_KG} kg</Text>
                {flagged && (
                  <Text style={styles.flagText}>Suggested charge: ₹{charge}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => handleReset(item.regNo)} style={styles.resetBtn}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 56 },
  emoji: { fontSize: 34 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.subtext, fontSize: 14, marginTop: 4, marginBottom: 8 },
  disclaimer: { color: colors.subtext, fontSize: 11, fontStyle: 'italic', marginBottom: 18, lineHeight: 15 },
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
  regNo: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  meta: { color: colors.subtext, fontSize: 12, marginTop: 6 },
  metaBudget: { color: colors.subtext, fontSize: 11, marginTop: 2, opacity: 0.7 },
  flagText: { color: colors.danger, fontSize: 14, fontWeight: '700', marginTop: 8 },
  badgeFlagged: {
    backgroundColor: colors.danger,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeFlaggedText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  badgeOk: {
    backgroundColor: colors.accentDim,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeOkText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  resetBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  resetText: { color: colors.subtext, fontSize: 12 },
});
