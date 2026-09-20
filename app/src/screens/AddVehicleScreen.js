import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import { addVehicle } from '../lib/storage';

export default function AddVehicleScreen({ ownerName, onAdded, onCancel }) {
  const [regNo, setRegNo] = useState('');
  const [fuelType, setFuelType] = useState('petrol');
  const [saving, setSaving] = useState(false);

  const canSave = regNo.trim().length > 0 && !saving;

  async function handleSave() {
    setSaving(true);
    try {
      const normalizedRegNo = regNo.trim().toUpperCase();
      await addVehicle(ownerName, normalizedRegNo, fuelType);
      onAdded(normalizedRegNo);
    } catch (e) {
      Alert.alert('Could not add vehicle', e.message);
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.title}>Add a Vehicle</Text>
        <Text style={styles.subtitle}>Register another two-wheeler under your name.</Text>

        <Text style={styles.label}>Vehicle number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. KA07GH3456"
          placeholderTextColor={colors.subtext}
          autoCapitalize="characters"
          autoFocus
          value={regNo}
          onChangeText={setRegNo}
        />

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
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          disabled={!canSave}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Adding…' : 'Add Vehicle'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 80 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.subtext, fontSize: 14, marginTop: 6, marginBottom: 10 },
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
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancelBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 10 },
  cancelBtnText: { color: colors.subtext, fontWeight: '600', fontSize: 14 },
});
