import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { FAMILY_MEMBERS, CATEGORIES, NOTIFICATION_SOUNDS, getMember } from "../../constants/Config";
import { useEvents } from "../../hooks/useEvents";
import { useAuth } from "../../hooks/useAuth";

export default function AddEventScreen() {
  const { addEvent, getConflicts } = useEvents();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [memberId, setMemberId] = useState(currentUser || "gana");
  const [category, setCategory] = useState("personal");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [notifySound, setNotifySound] = useState("default");
  const [notifyMinutes, setNotifyMinutes] = useState("15");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please enter an event title.");
      return;
    }
    if (time >= endTime) {
      Alert.alert("Invalid Time", "End time must be after start time.");
      return;
    }

    // Check conflicts
    const conflicts = getConflicts(date, time, endTime);
    if (conflicts.length > 0) {
      const names = conflicts.map(c => {
        const m = getMember(c.memberId);
        return `${m?.emoji} ${c.title} (${c.time}-${c.endTime})`;
      }).join("\n");

      Alert.alert(
        "⚠️ Time Conflict",
        `This overlaps with:\n${names}\n\nAdd anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add Anyway", onPress: () => doSave() },
        ]
      );
      return;
    }

    doSave();
  };

  const doSave = async () => {
    setSaving(true);
    try {
      await addEvent({
        title: title.trim(),
        description: description.trim(),
        date, time, endTime,
        memberId, category, priority,
        notifySound,
        notifyMinutesBefore: parseInt(notifyMinutes) || 15,
        createdBy: currentUser || "gana",
      });
      Alert.alert("✅ Event Added", `"${title}" has been added to the calendar.`);
      // Reset form
      setTitle(""); setDescription(""); setTime("09:00"); setEndTime("10:00");
      router.navigate("/(tabs)");
    } catch (e) {
      Alert.alert("Error", "Failed to save event.");
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.pageTitle}>➕ New Event</Text>

          {/* Title */}
          <Text style={styles.label}>Title *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="What's happening?" placeholderTextColor="#64748b" />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} value={description} onChangeText={setDescription} placeholder="Add details..." placeholderTextColor="#64748b" multiline />

          {/* Date */}
          <Text style={styles.label}>Date</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#64748b" />

          {/* Time Row */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Start Time</Text>
              <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor="#64748b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>End Time</Text>
              <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="HH:MM" placeholderTextColor="#64748b" />
            </View>
          </View>

          {/* Assign To */}
          <Text style={styles.label}>Assign To</Text>
          <View style={styles.chipRow}>
            {FAMILY_MEMBERS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.chip, memberId === m.id && { backgroundColor: m.color, borderColor: m.color }]}
                onPress={() => setMemberId(m.id)}
              >
                <Text style={{ fontSize: 16 }}>{m.emoji}</Text>
                <Text style={[styles.chipText, memberId === m.id && { color: "#fff" }]}>{m.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category */}
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, category === c.id && styles.chipActive]}
                  onPress={() => setCategory(c.id)}
                >
                  <Text style={{ fontSize: 14 }}>{c.icon}</Text>
                  <Text style={[styles.chipText, category === c.id && { color: "#fff" }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Priority */}
          <Text style={styles.label}>Priority</Text>
          <View style={styles.chipRow}>
            {(["low", "medium", "high"] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, priority === p && {
                  backgroundColor: p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#22c55e",
                  borderColor: p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#22c55e",
                }]}
                onPress={() => setPriority(p)}
              >
                <Text style={{ fontSize: 14 }}>{p === "high" ? "🔴" : p === "medium" ? "🟡" : "🟢"}</Text>
                <Text style={[styles.chipText, priority === p && { color: "#fff" }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notification */}
          <Text style={styles.label}>🔔 Notification Sound</Text>
          <View style={styles.chipRow}>
            {NOTIFICATION_SOUNDS.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, notifySound === s.id && styles.chipActive]}
                onPress={() => setNotifySound(s.id)}
              >
                <Text style={[styles.chipText, notifySound === s.id && { color: "#fff" }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Remind Before (minutes)</Text>
          <TextInput
            style={[styles.input, { width: 100 }]}
            value={notifyMinutes}
            onChangeText={setNotifyMinutes}
            keyboardType="numeric"
            placeholderTextColor="#64748b"
          />

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "✅ Add Event"}</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { padding: 20 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#e2e8f0", marginBottom: 24, letterSpacing: -0.5 },
  label: { color: "#94a3b8", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: "#1e293b", borderRadius: 12, padding: 14, color: "#e2e8f0",
    fontSize: 16, borderWidth: 1, borderColor: "#334155",
  },
  row: { flexDirection: "row", gap: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155",
  },
  chipActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  chipText: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },
  saveBtn: {
    backgroundColor: "#6366f1", borderRadius: 14, padding: 18,
    alignItems: "center", marginTop: 30,
  },
  saveBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
