import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import DeleteAccountModal from '../components/DeleteAccountModal';

export default function UserSettings() {
  const { user } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  if (!user) {
    return (
      <div>
        <Header />
        <main className="container" style={{ padding: "28px 0 96px" }}>
          <div style={{ textAlign: "center", padding: "40px" }}>
            <h1>Bitte melden Sie sich an</h1>
            <p>Sie müssen angemeldet sein, um die Einstellungen zu verwalten.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="container" style={{ padding: "28px 0 96px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h1 style={{ color: "white", marginBottom: "30px" }}>
            👤 Benutzereinstellungen
          </h1>

          {/* User Info Section */}
          <div className="settings-section" style={{
            backgroundColor: "#2a2a2a",
            padding: "20px",
            borderRadius: "10px",
            marginBottom: "20px"
          }}>
            <h2 style={{ color: "white", marginBottom: "15px" }}>
              📋 Account-Informationen
            </h2>
            <div style={{ color: "#ccc" }}>
              <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
              <p><strong>E-Mail:</strong> {user.email}</p>
              <p><strong>Account-Typ:</strong> {user.isAdmin ? 'Administrator' : 'Benutzer'}</p>
            </div>
          </div>

          {/* Security Section */}
          <div className="settings-section" style={{
            backgroundColor: "#2a2a2a",
            padding: "20px",
            borderRadius: "10px",
            marginBottom: "20px"
          }}>
            <h2 style={{ color: "white", marginBottom: "15px" }}>
              🔒 Sicherheit
            </h2>
            <div style={{ color: "#ccc" }}>
              <p>Ihr Account ist durch sichere Authentifizierung geschützt.</p>
              <p>Bei Problemen können Sie Ihr Passwort über die Login-Seite zurücksetzen.</p>
            </div>
          </div>

          {/* Watchlist Section */}
          <div className="settings-section" style={{
            backgroundColor: "#2a2a2a",
            padding: "20px",
            borderRadius: "10px",
            marginBottom: "20px"
          }}>
            <h2 style={{ color: "white", marginBottom: "15px" }}>
              📺 Watchlist
            </h2>
            <div style={{ color: "#ccc" }}>
              <p>Verwalten Sie Ihre gespeicherten Anime in der Watchlist.</p>
              <button
                onClick={() => window.location.href = '/watchlist'}
                style={{
                  background: "#007bff",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "16px"
                }}
              >
                Zur Watchlist
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="settings-section" style={{
            backgroundColor: "#2a2a2a",
            padding: "20px",
            borderRadius: "10px",
            border: "2px solid #ff4444"
          }}>
            <h2 style={{ color: "#ff4444", marginBottom: "15px" }}>
              ⚠️ Gefahrenbereich
            </h2>
            <div style={{ color: "#ccc", marginBottom: "20px" }}>
              <p><strong>Account löschen</strong></p>
              <p>Löschen Sie Ihren Account und alle zugehörigen Daten permanent.</p>
              <p style={{ color: "#ffaa00", fontWeight: "bold" }}>
                Diese Aktion kann NICHT rückgängig gemacht werden!
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                background: "#ff4444",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold"
              }}
            >
              🗑️ Account löschen
            </button>
          </div>

          {/* Help Section */}
          <div className="settings-section" style={{
            backgroundColor: "#2a2a2a",
            padding: "20px",
            borderRadius: "10px",
            marginTop: "20px"
          }}>
            <h2 style={{ color: "white", marginBottom: "15px" }}>
              ❓ Hilfe & Support
            </h2>
            <div style={{ color: "#ccc" }}>
              <p>Bei Problemen oder Fragen wenden Sie sich an den Administrator.</p>
              <p>Alle Ihre Daten werden sicher und verschlüsselt gespeichert.</p>
            </div>
          </div>
        </div>
      </main>

      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
