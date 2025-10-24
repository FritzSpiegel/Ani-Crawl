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

interface AdminStats {
    users: {
        total: number;
        verified: number;
        admins: number;
        recent: number;
        verificationRate: number;
    };
    watchlist: {
        totalItems: number;
        uniqueUsers: number;
        averagePerUser: number;
        maxPerUser: number;
        minPerUser: number;
    };
    anime: {
        total: number;
        recentlyCrawled: number;
    };
    registrationData: Array<{ date: string; count: number }>;
    popularAnime: Array<{ slug: string; title: string; watchlistCount: number }>;
    watchlistDistribution: Array<{ _id: number; users: number }>;
    recentActivity: Array<{ firstName: string; lastName: string; email: string; createdAt: string }>;
}

export default function Admin() {
    const { user, isAdmin } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<AdminStats | null>(null);
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
            try { 
                const list = await adminUsers(); 
                if (mounted) setUsers(list); 
            } catch { }
            
            try {
                const response = await fetch('/api/auth/admin/stats', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    if (mounted) setStats(data.stats);
                }
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            }
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

                {/* Statistics Overview */}
                {stats && (
                    <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
                        gap: "20px", 
                        marginBottom: "40px" 
                    }}>
                        {/* User Statistics */}
                        <div style={{ 
                            backgroundColor: "#2a2a2a", 
                            padding: "20px", 
                            borderRadius: "10px",
                            border: "1px solid #444"
                        }}>
                            <h3 style={{ color: "#007bff", marginBottom: "15px" }}>👥 Benutzer</h3>
                            <div style={{ color: "#ccc", fontSize: "14px" }}>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Gesamt:</strong> {stats.users.total}
                                </div>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Verifiziert:</strong> {stats.users.verified} ({stats.users.verificationRate}%)
                                </div>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Admins:</strong> {stats.users.admins}
                                </div>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Neu (7 Tage):</strong> {stats.users.recent}
                                </div>
                            </div>
                        </div>

                        {/* Watchlist Statistics */}
                        <div style={{ 
                            backgroundColor: "#2a2a2a", 
                            padding: "20px", 
                            borderRadius: "10px",
                            border: "1px solid #444"
                        }}>
                            <h3 style={{ color: "#28a745", marginBottom: "15px" }}>📺 Watchlist</h3>
                            <div style={{ color: "#ccc", fontSize: "14px" }}>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Einträge:</strong> {stats.watchlist.totalItems}
                                </div>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Benutzer:</strong> {stats.watchlist.uniqueUsers}
                                </div>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Ø pro User:</strong> {stats.watchlist.averagePerUser}
                                </div>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Max:</strong> {stats.watchlist.maxPerUser}
                                </div>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Min:</strong> {stats.watchlist.minPerUser}
                                </div>
                            </div>
                        </div>

                        {/* Anime Statistics */}
                        <div style={{ 
                            backgroundColor: "#2a2a2a", 
                            padding: "20px", 
                            borderRadius: "10px",
                            border: "1px solid #444"
                        }}>
                            <h3 style={{ color: "#ff6b6b", marginBottom: "15px" }}>🎬 Anime</h3>
                            <div style={{ color: "#ccc", fontSize: "14px" }}>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Gesamt:</strong> {stats.anime.total}
                                </div>
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Neu gecrawlt (24h):</strong> {stats.anime.recentlyCrawled}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Popular Anime */}
                {stats && stats.popularAnime.length > 0 && (
                    <div style={{ 
                        backgroundColor: "#2a2a2a", 
                        padding: "20px", 
                        borderRadius: "10px",
                        marginBottom: "40px",
                        border: "1px solid #444"
                    }}>
                        <h3 style={{ color: "#fff", marginBottom: "15px" }}>🔥 Beliebte Anime</h3>
                        <div style={{ display: "grid", gap: "10px" }}>
                            {stats.popularAnime.slice(0, 5).map((anime, index) => (
                                <div key={anime.slug} style={{ 
                                    display: "flex", 
                                    justifyContent: "space-between", 
                                    alignItems: "center",
                                    padding: "10px",
                                    backgroundColor: "#333",
                                    borderRadius: "5px"
                                }}>
                                    <span style={{ color: "#fff" }}>
                                        {index + 1}. {anime.title}
                                    </span>
                                    <span style={{ color: "#007bff", fontSize: "12px" }}>
                                        {anime.watchlistCount} Watchlist-Einträge
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Activity */}
                {stats && stats.recentActivity.length > 0 && (
                    <div style={{ 
                        backgroundColor: "#2a2a2a", 
                        padding: "20px", 
                        borderRadius: "10px",
                        marginBottom: "40px",
                        border: "1px solid #444"
                    }}>
                        <h3 style={{ color: "#fff", marginBottom: "15px" }}>🕒 Letzte Aktivitäten</h3>
                        <div style={{ display: "grid", gap: "10px" }}>
                            {stats.recentActivity.map((activity, index) => (
                                <div key={index} style={{ 
                                    display: "flex", 
                                    justifyContent: "space-between", 
                                    alignItems: "center",
                                    padding: "10px",
                                    backgroundColor: "#333",
                                    borderRadius: "5px"
                                }}>
                                    <span style={{ color: "#fff" }}>
                                        {activity.firstName} {activity.lastName} ({activity.email})
                                    </span>
                                    <span style={{ color: "#ccc", fontSize: "12px" }}>
                                        {new Date(activity.createdAt).toLocaleDateString('de-DE')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Watchlist Distribution */}
                {stats && stats.watchlistDistribution.length > 0 && (
                    <div style={{ 
                        backgroundColor: "#2a2a2a", 
                        padding: "20px", 
                        borderRadius: "10px",
                        marginBottom: "40px",
                        border: "1px solid #444"
                    }}>
                        <h3 style={{ color: "#fff", marginBottom: "15px" }}>📊 Watchlist-Verteilung</h3>
                        <div style={{ display: "grid", gap: "8px" }}>
                            {stats.watchlistDistribution.map((dist, index) => (
                                <div key={index} style={{ 
                                    display: "flex", 
                                    justifyContent: "space-between", 
                                    alignItems: "center",
                                    padding: "8px 12px",
                                    backgroundColor: "#333",
                                    borderRadius: "5px"
                                }}>
                                    <span style={{ color: "#fff" }}>
                                        {dist._id} Anime in Watchlist
                                    </span>
                                    <span style={{ color: "#28a745", fontSize: "14px" }}>
                                        {dist.users} Benutzer
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div style={{ 
                            marginTop: "15px",
                            fontSize: "12px",
                            color: "#ccc",
                            textAlign: "center"
                        }}>
                            Verteilung der Watchlist-Größen
                        </div>
                    </div>
                )}

                {/* Registration Chart */}
                {stats && stats.registrationData.length > 0 && (
                    <div style={{ 
                        backgroundColor: "#2a2a2a", 
                        padding: "20px", 
                        borderRadius: "10px",
                        marginBottom: "40px",
                        border: "1px solid #444"
                    }}>
                        <h3 style={{ color: "#fff", marginBottom: "15px" }}>📈 Registrierungen (30 Tage)</h3>
                        <div style={{ display: "flex", alignItems: "end", gap: "2px", height: "100px" }}>
                            {stats.registrationData.slice(-14).map((day, index) => {
                                const maxCount = Math.max(...stats.registrationData.map(d => d.count));
                                const height = maxCount > 0 ? (day.count / maxCount) * 80 : 0;
                                return (
                                    <div key={day.date} style={{ 
                                        display: "flex", 
                                        flexDirection: "column", 
                                        alignItems: "center",
                                        flex: 1
                                    }}>
                                        <div style={{
                                            width: "100%",
                                            height: `${height}px`,
                                            backgroundColor: "#007bff",
                                            borderRadius: "2px 2px 0 0",
                                            minHeight: day.count > 0 ? "4px" : "0px"
                                        }}></div>
                                        <div style={{ 
                                            fontSize: "10px", 
                                            color: "#ccc", 
                                            marginTop: "5px",
                                            transform: "rotate(-45deg)",
                                            whiteSpace: "nowrap"
                                        }}>
                                            {new Date(day.date).getDate()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            marginTop: "10px",
                            fontSize: "12px",
                            color: "#ccc"
                        }}>
                            <span>Gesamt: {stats.registrationData.reduce((sum, day) => sum + day.count, 0)}</span>
                            <span>Ø/Tag: {Math.round(stats.registrationData.reduce((sum, day) => sum + day.count, 0) / stats.registrationData.length)}</span>
                        </div>
                    </div>
                )}

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


