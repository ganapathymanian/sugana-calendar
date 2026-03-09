import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "sugana_calendar_auth";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Auto-expire after 24 hours
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          setIsAuthenticated(true);
          setCurrentUser(data.userId);
        } else {
          await AsyncStorage.removeItem(AUTH_KEY);
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  const login = async (userId: string, pin: string): Promise<boolean> => {
    if (pin === "2024") { // Family PIN
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify({ userId, timestamp: Date.now() }));
      setIsAuthenticated(true);
      setCurrentUser(userId);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  return { isAuthenticated, currentUser, loading, login, logout };
}
