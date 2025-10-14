import Header from "../components/Header";
import { useEffect, useState } from "react";
import { adminUsers, adminDeleteUser } from "../services/auth";
import { useAuth } from "../context/AuthContext";
import { Link, Navigate } from "react-router-dom";

interface User {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    verified: boolean;
    created_at: string;
    isAdmin?: boolean;
}

export default function Admin() {
    const { user, isAdmin } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [err, setErr] = useState("");
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        verified: false,
        isAdmin: false
    });
    useEffect(() => {
        if (!isAdmin) return;
        let mounted = true;
        (async () => {
            try { const list = await adminUsers(); if (mounted) setUsers(list); } catch { }
        })();
        return () => { mounted = false; };
    }, [isAdmin]);

    async function onDelete(email: string) {
        if (!confirm('Diesen Nutzer wirklich löschen?')) return;
        try {
            await adminDeleteUser(email);
            setUsers(u => u.filter(x => x.email !== email));
        } catch (e: any) {
            alert(e?.response?.message || 'Löschen fehlgeschlagen.');
        }
    }

    function startEdit(user: User) {
        setEditingUser(user);
        setEditForm({
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            verified: user.verified,
            isAdmin: user.isAdmin || false
        });
    }

    function cancelEdit() {
        setEditingUser(null);
        setEditForm({
            firstName: "",
            lastName: "",
            email: "",
            verified: false,
            isAdmin: false
        });
    }

    async function saveEdit() {
        if (!editingUser) return;
        
        try {
            // We need to add this function to the auth service
            const response = await fetch('/api/auth/admin/users/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: editingUser.id,
                    firstName: editForm.firstName,
                    lastName: editForm.lastName,
                    email: editForm.email,
                    verified: editForm.verified,
                    isAdmin: editForm.isAdmin
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Update failed');
            }

            // Update the user in the local state
            setUsers(users => users.map(u => 
                u.id === editingUser.id 
                    ? { 
                        ...u, 
                        first_name: editForm.firstName,
                        last_name: editForm.lastName,
                        email: editForm.email,
                        verified: editForm.verified,
                        isAdmin: editForm.isAdmin
                      }
                    : u
            ));

            cancelEdit();
            alert('Nutzer erfolgreich aktualisiert!');
        } catch (e: any) {
            alert(e?.message || 'Update fehlgeschlagen.');
        }
    }

    // Redirect to login if not logged in
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Show access denied if logged in but not admin
    if (!isAdmin) {
        return (
            <div>
                <Header />
                <main className="container" style={{ padding: "24px 0 96px" }}>
                    <div className="card card--centered">
                        <div className="details__meta">
                            <div className="auth-header">
                                <h2 className="auth-title">Zugriff verweigert</h2>
                                <div className="auth-subtitle">
                                    Sie haben keine Berechtigung für diesen Bereich.<br />
                                    <Link to="/" style={{color: "#ff6b6b", textDecoration: "none"}}>← Zurück zur Startseite</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div>
            <Header />
            <main className="container" style={{ padding: "24px 0 96px" }}>
                <h1 className="page-title">Admin Dashboard</h1>

                {/* Edit User Modal */}
                {editingUser && (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(27, 36, 55, 0.8)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000
                    }}>
                        <div className="card" style={{
                            backgroundColor: "#1b2437",
                            color: "#ffffff",
                            padding: "32px",
                            borderRadius: "12px",
                            minWidth: "500px",
                            maxWidth: "90vw",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                            border: "1px solid #2a3441"
                        }}>
                            <h2 style={{color: "#ff6b6b", marginBottom: "24px", textAlign: "center"}}>👤 Nutzer bearbeiten</h2>
                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ 
                                    display: "block", 
                                    marginBottom: "8px", 
                                    color: "#ffffff", 
                                    fontWeight: "500" 
                                }}>📝 Vorname:</label>
                                <input
                                    type="text"
                                    value={editForm.firstName}
                                    onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                                    style={{ 
                                        width: "100%", 
                                        padding: "12px", 
                                        borderRadius: "6px", 
                                        border: "1px solid #404957",
                                        backgroundColor: "#2a3441",
                                        color: "#ffffff",
                                        fontSize: "14px",
                                        boxSizing: "border-box"
                                    }}
                                />
                            </div>
                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ 
                                    display: "block", 
                                    marginBottom: "8px", 
                                    color: "#ffffff", 
                                    fontWeight: "500" 
                                }}>📝 Nachname:</label>
                                <input
                                    type="text"
                                    value={editForm.lastName}
                                    onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                                    style={{ 
                                        width: "100%", 
                                        padding: "12px", 
                                        borderRadius: "6px", 
                                        border: "1px solid #404957",
                                        backgroundColor: "#2a3441",
                                        color: "#ffffff",
                                        fontSize: "14px",
                                        boxSizing: "border-box"
                                    }}
                                />
                            </div>
                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ 
                                    display: "block", 
                                    marginBottom: "8px", 
                                    color: "#ffffff", 
                                    fontWeight: "500" 
                                }}>📧 E-Mail:</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                                    style={{ 
                                        width: "100%", 
                                        padding: "12px", 
                                        borderRadius: "6px", 
                                        border: "1px solid #404957",
                                        backgroundColor: "#2a3441",
                                        color: "#ffffff",
                                        fontSize: "14px",
                                        boxSizing: "border-box"
                                    }}
                                />
                            </div>
                            <div style={{ 
                                marginBottom: "20px", 
                                padding: "16px", 
                                backgroundColor: "#2a3441", 
                                borderRadius: "8px", 
                                border: "1px solid #404957" 
                            }}>
                                <label style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "12px", 
                                    color: "#ffffff",
                                    fontSize: "14px",
                                    marginBottom: "12px",
                                    cursor: "pointer"
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={editForm.verified}
                                        onChange={(e) => setEditForm({...editForm, verified: e.target.checked})}
                                        style={{ 
                                            width: "18px", 
                                            height: "18px",
                                            accentColor: "#ff6b6b"
                                        }}
                                    />
                                    ✅ Verifiziert
                                </label>
                                <label style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "12px", 
                                    color: "#ffffff",
                                    fontSize: "14px",
                                    cursor: "pointer"
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={editForm.isAdmin}
                                        onChange={(e) => setEditForm({...editForm, isAdmin: e.target.checked})}
                                        style={{ 
                                            width: "18px", 
                                            height: "18px",
                                            accentColor: "#ff6b6b"
                                        }}
                                    />
                                    👑 Admin-Berechtigung
                                </label>
                            </div>
                            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                                <button 
                                    className="btn" 
                                    onClick={cancelEdit}
                                    style={{
                                        backgroundColor: "#404957",
                                        color: "#ffffff",
                                        border: "1px solid #404957",
                                        padding: "12px 24px",
                                        fontSize: "14px"
                                    }}
                                >
                                    ❌ Abbrechen
                                </button>
                                <button 
                                    className="btn btn--primary" 
                                    onClick={saveEdit}
                                    style={{
                                        backgroundColor: "#ff6b6b",
                                        color: "#ffffff",
                                        border: "1px solid #ff6b6b",
                                        padding: "12px 24px",
                                        fontSize: "14px"
                                    }}
                                >
                                    💾 Speichern
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                    <div>
                        <div className="skeleton-row" style={{ marginBottom: 8 }}>Insgesamt {users.length} Nutzer</div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Vorname</th>
                                        <th>Nachname</th>
                                        <th>E-Mail</th>
                                        <th>Verifiziert</th>
                                        <th>Admin</th>
                                        <th>Erstellt</th>
                                        <th>Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.id}</td>
                                            <td>{u.first_name}</td>
                                            <td>{u.last_name}</td>
                                            <td>{u.email}</td>
                                            <td>{u.verified ? <span className="badge badge--success">Ja</span> : <span className="badge badge--warn">Nein</span>}</td>
                                            <td>{u.isAdmin ? <span className="badge" style={{backgroundColor: "#ff6b6b", color: "white"}}>👑 Admin</span> : <span className="badge" style={{backgroundColor: "#6c757d", color: "white"}}>👤 User</span>}</td>
                                            <td>{new Date(u.created_at).toLocaleString()}</td>
                                            <td style={{whiteSpace: "nowrap"}}>
                                                <button 
                                                    className="btn" 
                                                    style={{
                                                        marginRight: "8px", 
                                                        fontSize: "12px", 
                                                        padding: "8px 12px",
                                                        backgroundColor: "#ff6b6b",
                                                        color: "white",
                                                        border: "1px solid #ff6b6b",
                                                        borderRadius: "4px",
                                                        cursor: "pointer",
                                                        transition: "all 0.2s"
                                                    }} 
                                                    onClick={() => startEdit(u)}
                                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#e55a5a"}
                                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#ff6b6b"}
                                                >
                                                    ✏️ Bearbeiten
                                                </button>
                                                <button 
                                                    className="btn" 
                                                    style={{
                                                        fontSize: "12px", 
                                                        padding: "8px 12px", 
                                                        backgroundColor: "#dc3545", 
                                                        color: "white", 
                                                        border: "1px solid #dc3545",
                                                        borderRadius: "4px",
                                                        cursor: "pointer",
                                                        transition: "all 0.2s"
                                                    }} 
                                                    onClick={() => onDelete(u.email)}
                                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#c82333"}
                                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#dc3545"}
                                                >
                                                    🗑️ Löschen
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
            </main>
        </div>
    );
}


