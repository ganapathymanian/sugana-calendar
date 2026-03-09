import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  endTime: string; // HH:MM
  memberId: string;
  category: string;
  priority: "low" | "medium" | "high";
  notifySound: string;
  notifyMinutesBefore: number;
  completed: boolean;
  createdAt: string;
  createdBy: string;
}

const STORAGE_KEY = "sugana_calendar_events";

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setEvents(JSON.parse(stored));
    } catch (e) {
      console.error("Failed to load events:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const saveEvents = async (newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEvents));
  };

  const addEvent = async (event: Omit<CalendarEvent, "id" | "createdAt" | "completed">) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [...events, newEvent];
    await saveEvents(updated);
    return newEvent;
  };

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    const updated = events.map(e => e.id === id ? { ...e, ...updates } : e);
    await saveEvents(updated);
  };

  const deleteEvent = async (id: string) => {
    const updated = events.filter(e => e.id !== id);
    await saveEvents(updated);
  };

  const toggleComplete = async (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) await updateEvent(id, { completed: !event.completed });
  };

  const getEventsForDate = (date: string, memberId?: string) => {
    return events
      .filter(e => e.date === date && (!memberId || memberId === "all" || e.memberId === memberId))
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const getConflicts = (date: string, time: string, endTime: string, excludeId?: string) => {
    return events.filter(e => {
      if (e.id === excludeId || e.date !== date) return false;
      return (time < e.endTime && endTime > e.time); // Overlap check
    });
  };

  return { events, loading, addEvent, updateEvent, deleteEvent, toggleComplete, getEventsForDate, getConflicts, loadEvents };
}
