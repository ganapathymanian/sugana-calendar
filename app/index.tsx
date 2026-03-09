import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  SafeAreaView, Dimensions, KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { FAMILY_MEMBERS } from "../constants/Config";
import { useAuth } from "../hooks/useAuth";

const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const { login, isAuthenticated, loading } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"select" | "pin">("select");

  React.useEffect(() => {
    if (isAuthenticated && !loading) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, loading]);

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
    setStep("pin");
    setPin("");
    setError("");
  };

  const handlePinSubmit = async () => {
    if (!selectedUser || pin.length !== 4) return;
    const success = await login(selectedUser, pin);
    if (success) {
      router.replace("/(tabs)");
    } else {
      setError("Incorrect PIN. Try again.");
      setPin("");
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError("");
      if (newPin.length === 4) {
        setTimeout(() => {
          login(selectedUser!, newPin).then(success => {
            if (success) {
              router.replace("/(tabs)");
            } else {
              setError("Incorrect PIN");
              setPin("");
            }
          });
        }, 200);
      }
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.logo}>📅</Text>
        <Text style={styles.title}>Sugana Calendar</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>📅</Text>
        <Text style={styles.title}>Sugana Calendar</Text>
        <Text style={styles.subtitle}>Family Activity Planner</Text>
      </View>

      {step === "select" ? (
        <View style={styles.content}>
          <Text style={styles.prompt}>Who are you?</Text>
          <View style={styles.grid}>
            {FAMILY_MEMBERS.map(member => (
              <TouchableOpacity
                key={member.id}
                style={[styles.memberCard, { borderColor: member.color }]}
                onPress={() => handleUserSelect(member.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.memberEmoji}>{member.emoji}</Text>
                <Text style={[styles.memberName, { color: member.color }]}>{member.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <TouchableOpacity onPress={() => { setStep("select"); setPin(""); setError(""); }}>
            <Text style={{ color: "#6366f1", fontSize: 16, marginBottom: 20 }}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.memberEmoji}>
            {FAMILY_MEMBERS.find(m => m.id === selectedUser)?.emoji}
          </Text>
          <Text style={styles.prompt}>
            Hi {FAMILY_MEMBERS.find(m => m.id === selectedUser)?.name}!
          </Text>
          <Text style={{ color: "#94a3b8", marginBottom: 30, textAlign: "center" }}>Enter your 4-digit PIN</Text>

          {/* PIN dots */}
          <View style={styles.pinDots}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled]} />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Number pad */}
          <View style={styles.numpad}>
            {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "⌫"]].map((row, ri) => (
              <View key={ri} style={styles.numpadRow}>
                {row.map((digit, ci) => (
                  <TouchableOpacity
                    key={ci}
                    style={[styles.numpadKey, !digit && { backgroundColor: "transparent" }]}
                    onPress={() => {
                      if (digit === "⌫") setPin(pin.slice(0, -1));
                      else if (digit) handlePinDigit(digit);
                    }}
                    disabled={!digit}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.numpadText}>{digit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { alignItems: "center", paddingTop: 60, paddingBottom: 20 },
  logo: { fontSize: 64, marginBottom: 10 },
  title: { fontSize: 32, fontWeight: "800", color: "#e2e8f0", letterSpacing: -1 },
  subtitle: { fontSize: 16, color: "#94a3b8", marginTop: 4 },
  content: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  prompt: { fontSize: 22, fontWeight: "700", color: "#e2e8f0", marginBottom: 24, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 },
  memberCard: {
    width: (width - 80) / 2, padding: 24, borderRadius: 20,
    backgroundColor: "#1e293b", borderWidth: 2, alignItems: "center",
  },
  memberEmoji: { fontSize: 48, marginBottom: 8 },
  memberName: { fontSize: 18, fontWeight: "700" },
  pinDots: { flexDirection: "row", gap: 16, marginBottom: 30 },
  pinDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#475569" },
  pinDotFilled: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  error: { color: "#f87171", marginBottom: 10, fontSize: 14 },
  numpad: { gap: 12 },
  numpadRow: { flexDirection: "row", gap: 16, justifyContent: "center" },
  numpadKey: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#1e293b",
    justifyContent: "center", alignItems: "center",
  },
  numpadText: { fontSize: 28, fontWeight: "600", color: "#e2e8f0" },
});
