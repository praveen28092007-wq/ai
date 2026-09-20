import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import { saveProfile } from '../lib/profile';
import { addVehicle } from '../lib/storage';

const DEMO_SUGGESTIONS = [{ regNo: 'KA05AB1234', fuelType: 'petrol' }];

export default function OnboardingScreen({ onDone }) {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [fuelType, setFuelType] = useState('petrol');
  const [saving, setSaving] = useState(false);

  const canContinue = name.trim().length > 0 && regNo.trim().length > 0 && !saving;

  async function handleContinue() {
    setSaving(true);
    try {
      const ownerName = name.trim();
      const normalizedRegNo = regNo.trim().toUpperCase();
      await addVehicle(ownerName, normalizedRegNo, fuelType);
      await saveProfile({ name: ownerName, activeRegNo: normalizedRegNo });
      onDone();
    } catch (e) {
      Alert.alert('Could not continue', e.message);
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🏍️</Text>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>
          Let's set up your first vehicle. You can add more vehicles later.
        </Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Kamalesh"
          placeholderTextColor={colors.subtext}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Vehicle number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. KA05AB1234"
          placeholderTextColor={colors.subtext}
          autoCapitalize="characters"
          value={regNo}
          onChangeText={setRegNo}
        />
        <TouchableOpacity
          style={styles.suggestionChip}
          onPress={() => {
            setRegNo(DEMO_SUGGESTIONS[0].regNo);
            setFuelType(DEMO_SUGGESTIONS[0].fuelType);
          }}
        >
          <Text style={styles.suggestionChipText}>Use demo number {DEMO_SUGGESTIONS[0].regNo}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Fuel type</Text>
        <View style={styles.demoRow}>
          {['petrol', 'diesel'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.demoChip, fuelType === f && styles.demoChipActive]}
              onPress={() => setFuelType(f)}
            >
              <Text style={[styles.demoChipText, fuelType === f && styles.demoChipTextActive]}>
                {f[0].toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          disabled={!canContinue}
          onPress={handleContinue}
        >
          <Text style={styles.continueBtnText}>{saving ? 'Setting up…' : 'Get Started'}</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Demo only — no real account is created, nothing leaves your phone except trip totals
          synced to the demo government dashboard.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 80, paddingBottom: 40 },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: colors.subtext,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  label: { color: colors.subtext, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  suggestionChip: { alignSelf: 'flex-start', marginTop: 8 },
  suggestionChipText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  demoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demoChip: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  demoChipActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  demoChipText: { color: colors.subtext, fontWeight: '600', fontSize: 13 },
  demoChipTextActive: { color: '#fff' },
  continueBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  footnote: {
    color: colors.subtext,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
});
