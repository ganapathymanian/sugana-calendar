import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { FAMILY_MEMBERS, getMember, CATEGORIES } from "../../constants/Config";
import { useEvents, CalendarEvent } from "../../hooks/useEvents";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

export default function CalendarScreen() {
  const { events, loading, getEventsForDate, toggleComplete, deleteEvent, loadEvents } = useEvents();
  const [selectedDate, setSelectedDate] = useState(getDateStr(new Date()));
  const [selectedMember, setSelectedMember] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { loadEvents(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const monthDays = getMonthDays(currentYear, currentMonth);
  const todayStr = getDateStr(new Date());
  const dayEvents = getEventsForDate(selectedDate, selectedMember);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const getDateEvents = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(e => e.date === dateStr);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "high": return "#ef4444";
      case "medium": return "#f59e0b";
      default: return "#22c55e";
    }
  };

  const getCategoryIcon = (cat: string) => {
    return CATEGORIES.find(c => c.id === cat)?.icon || "📌";
  };

  const handleDelete = (event: CalendarEvent) => {
    Alert.alert("Delete Event", `Remove "${event.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteEvent(event.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>📅 Sugana Calendar</Text>
        </View>

        {/* Member Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, selectedMember === "all" && styles.filterChipActive]}
            onPress={() => setSelectedMember("all")}
          >
            <Text style={styles.filterEmoji}>👨‍👩‍👧‍👦</Text>
            <Text style={[styles.filterText, selectedMember === "all" && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {FAMILY_MEMBERS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.filterChip, selectedMember === m.id && { backgroundColor: m.color }]}
              onPress={() => setSelectedMember(m.id)}
            >
              <Text style={styles.filterEmoji}>{m.emoji}</Text>
              <Text style={[styles.filterText, selectedMember === m.id && styles.filterTextActive]}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}><Text style={styles.navText}>◀</Text></TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS[currentMonth]} {currentYear}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}><Text style={styles.navText}>▶</Text></TouchableOpacity>
        </View>

        {/* Day Headers */}
        <View style={styles.dayHeaders}>
          {DAYS.map(d => (
            <Text key={d} style={styles.dayHeader}>{d}</Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {monthDays.map((day, i) => {
            if (day === null) return <View key={`empty-${i}`} style={styles.dayCell} />;
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayEvts = getDateEvents(day);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const memberDots = [...new Set(dayEvts.map(e => e.memberId))];

            return (
              <TouchableOpacity
                key={`day-${day}`}
                style={[styles.dayCell, isToday && styles.todayCell, isSelected && styles.selectedCell]}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text style={[styles.dayNum, isToday && styles.todayNum, isSelected && styles.selectedNum]}>{day}</Text>
                {memberDots.length > 0 && (
                  <View style={styles.dots}>
                    {memberDots.slice(0, 4).map(mid => (
                      <View key={mid} style={[styles.dot, { backgroundColor: getMember(mid)?.color || "#6366f1" }]} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Day Events */}
        <View style={styles.eventsSection}>
          <Text style={styles.eventsTitle}>
            {selectedDate === todayStr ? "Today" : new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "short" })}
            {" · "}{dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
          </Text>

          {dayEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🎉</Text>
              <Text style={styles.emptyText}>No events — enjoy your free time!</Text>
            </View>
          ) : (
            dayEvents.map(event => {
              const member = getMember(event.memberId);
              return (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { borderLeftColor: member?.color || "#6366f1" }]}
                  onLongPress={() => handleDelete(event)}
                  activeOpacity={0.8}
                >
                  <View style={styles.eventHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: 20 }}>{member?.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.eventTitle, event.completed && styles.completedText]}>{event.title}</Text>
                        <Text style={styles.eventTime}>
                          {getCategoryIcon(event.category)} {event.time} - {event.endTime} · {member?.name}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(event.priority) }]} />
                      <TouchableOpacity onPress={() => toggleComplete(event.id)}>
                        <Text style={{ fontSize: 22 }}>{event.completed ? "✅" : "⬜"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {event.description ? (
                    <Text style={styles.eventDesc}>{event.description}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { padding: 20, paddingTop: 16 },
  appTitle: { fontSize: 26, fontWeight: "800", color: "#e2e8f0", letterSpacing: -0.5 },
  filterRow: { paddingHorizontal: 16, marginBottom: 16 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#1e293b", marginRight: 8,
  },
  filterChipActive: { backgroundColor: "#6366f1" },
  filterEmoji: { fontSize: 16 },
  filterText: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },
  filterTextActive: { color: "#fff" },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
  navBtn: { padding: 8 },
  navText: { color: "#6366f1", fontSize: 18, fontWeight: "700" },
  monthTitle: { fontSize: 20, fontWeight: "700", color: "#e2e8f0" },
  dayHeaders: { flexDirection: "row", paddingHorizontal: 8 },
  dayHeader: { flex: 1, textAlign: "center", color: "#64748b", fontSize: 12, fontWeight: "600", paddingBottom: 8 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8 },
  dayCell: { width: "14.28%", aspectRatio: 1, justifyContent: "center", alignItems: "center", borderRadius: 12 },
  todayCell: { backgroundColor: "rgba(99, 102, 241, 0.15)" },
  selectedCell: { backgroundColor: "#6366f1" },
  dayNum: { color: "#e2e8f0", fontSize: 15, fontWeight: "500" },
  todayNum: { color: "#818cf8", fontWeight: "800" },
  selectedNum: { color: "#fff", fontWeight: "800" },
  dots: { flexDirection: "row", gap: 3, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  eventsSection: { padding: 20 },
  eventsTitle: { fontSize: 18, fontWeight: "700", color: "#e2e8f0", marginBottom: 14 },
  emptyState: { alignItems: "center", padding: 30, backgroundColor: "#1e293b", borderRadius: 16 },
  emptyText: { color: "#94a3b8", fontSize: 14 },
  eventCard: {
    backgroundColor: "#1e293b", borderRadius: 14, padding: 14,
    marginBottom: 10, borderLeftWidth: 4,
  },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#e2e8f0" },
  completedText: { textDecorationLine: "line-through", color: "#64748b" },
  eventTime: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  eventDesc: { fontSize: 13, color: "#94a3b8", marginTop: 8, lineHeight: 18 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
});
