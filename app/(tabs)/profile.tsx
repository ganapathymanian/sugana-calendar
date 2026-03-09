import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import { router } from "expo-router";
import { FAMILY_MEMBERS, getMember } from "../../constants/Config";
import { useAuth } from "../../hooks/useAuth";
import { useEvents } from "../../hooks/useEvents";

export default function ProfileScreen() {
  const { currentUser, logout } = useAuth();
  const { events } = useEvents();
  const member = getMember(currentUser || "");

  const myEvents = events.filter(e => e.memberId === currentUser);
  const completed = myEvents.filter(e => e.completed).length;
  const upcoming = myEvents.filter(e => e.date >= new Date().toISOString().split("T")[0] && !e.completed).length;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", onPress: async () => { await logout(); router.replace("/"); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.pageTitle}>👤 Profile</Text>

        {/* Avatar Card */}
        <View style={[styles.avatarCard, { borderColor: member?.color }]}>
          <Text style={{ fontSize: 64 }}>{member?.emoji}</Text>
          <Text style={[styles.name, { color: member?.color }]}>{member?.name}</Text>
          <Text style={styles.role}>Family Member</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{myEvents.length}</Text>
            <Text style={styles.statLabel}>Total Events</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: "#6366f1" }]}>{upcoming}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: "#22c55e" }]}>{completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Family Members */}
        <Text style={styles.sectionTitle}>Family Members</Text>
        {FAMILY_MEMBERS.map(m => {
          const memberEvents = events.filter(e => e.memberId === m.id);
          return (
            <View key={m.id} style={styles.memberRow}>
              <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberStat}>{memberEvents.length} events</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: m.color }]}>
                <Text style={styles.badgeText}>{m.id === currentUser ? "You" : "Family"}</Text>
              </View>
            </View>
          );
        })}

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={{ color: "#6366f1", fontWeight: "700", marginBottom: 4 }}>🔒 Security</Text>
          <Text style={styles.infoText}>PIN protected · Auto-lock after 24h · Local storage</Text>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 20 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#e2e8f0", marginBottom: 20 },
  avatarCard: {
    alignItems: "center", backgroundColor: "#1e293b", borderRadius: 20,
    padding: 30, borderWidth: 3, marginBottom: 20,
  },
  name: { fontSize: 28, fontWeight: "800", marginTop: 10 },
  role: { color: "#94a3b8", marginTop: 4, fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: "#1e293b", borderRadius: 14, padding: 16, alignItems: "center" },
  statNum: { fontSize: 28, fontWeight: "800", color: "#e2e8f0" },
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#94a3b8", marginBottom: 12 },
  memberRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#1e293b",
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  memberName: { color: "#e2e8f0", fontWeight: "700", fontSize: 16 },
  memberStat: { color: "#64748b", fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  infoCard: { backgroundColor: "#1e293b", borderRadius: 14, padding: 16, marginTop: 16 },
  infoText: { color: "#94a3b8", fontSize: 13 },
  logoutBtn: {
    backgroundColor: "#ef4444", borderRadius: 14, padding: 16,
    alignItems: "center", marginTop: 20,
  },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
