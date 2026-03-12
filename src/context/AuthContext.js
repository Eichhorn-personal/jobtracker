import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("authUser");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Refresh user data from server on app load to pick up role/profile changes
  // made by an admin while this user was already logged in.
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    const base = process.env.REACT_APP_API_URL || "";
    fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((userData) => {
        if (userData) {
          localStorage.setItem("authUser", JSON.stringify(userData));
          setUser(userData);
        }
      })
      .catch(() => {});
  }, []);

  const login = (token, userData, googlePicture = null) => {
    localStorage.setItem("authToken", token);
    localStorage.setItem("authUser", JSON.stringify(userData));
    if (googlePicture) {
      localStorage.setItem("authGooglePicture", googlePicture);
    }
    setUser(userData);
  };

  const logout = () => {
    const token = localStorage.getItem("authToken");
    if (token) {
      const base = process.env.REACT_APP_API_URL || "";
      fetch(`${base}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    localStorage.removeItem("authGooglePicture");
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    localStorage.setItem("authUser", JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
