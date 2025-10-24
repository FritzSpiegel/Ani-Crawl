import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmation: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete account');
      }

      // Logout and redirect
      await logout();
      navigate('/');
      
    } catch (error: any) {
      console.error('Delete account error:', error);
      setError(error.message || 'Failed to delete account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#2a2a2a',
        padding: '30px',
        borderRadius: '10px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        border: '2px solid #ff4444'
      }}>
        <div className="modal-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ color: '#ff4444', margin: 0 }}>
            🗑️ Account löschen
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '5px'
            }}
          >
            ×
          </button>
        </div>

        <div className="warning-section" style={{
          backgroundColor: '#ff4444',
          color: 'white',
          padding: '15px',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>⚠️ WARNUNG</h3>
          <p style={{ margin: 0 }}>
            Diese Aktion kann NICHT rückgängig gemacht werden! Alle Ihre Daten werden permanent gelöscht.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label style={{ 
              display: 'block', 
              color: '#fff', 
              marginBottom: '5px',
              fontWeight: 'bold'
            }}>
              E-Mail-Adresse:
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #555',
                backgroundColor: '#333',
                color: '#fff',
                fontSize: '16px'
              }}
              placeholder="Ihre E-Mail-Adresse"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label style={{ 
              display: 'block', 
              color: '#fff', 
              marginBottom: '5px',
              fontWeight: 'bold'
            }}>
              Passwort:
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #555',
                backgroundColor: '#333',
                color: '#fff',
                fontSize: '16px'
              }}
              placeholder="Ihr aktuelles Passwort"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              color: '#fff', 
              marginBottom: '5px',
              fontWeight: 'bold'
            }}>
              Bestätigung (geben Sie "DELETE" ein):
            </label>
            <input
              type="text"
              name="confirmation"
              value={formData.confirmation}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #555',
                backgroundColor: '#333',
                color: '#fff',
                fontSize: '16px'
              }}
              placeholder="DELETE"
            />
          </div>

          {error && (
            <div className="error-message" style={{
              backgroundColor: '#ff4444',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '15px'
            }}>
              {error}
            </div>
          )}

          <div className="modal-actions" style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '5px',
                border: '1px solid #555',
                backgroundColor: '#555',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isLoading || formData.confirmation !== 'DELETE'}
              style={{
                padding: '10px 20px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: formData.confirmation === 'DELETE' ? '#ff4444' : '#666',
                color: '#fff',
                cursor: formData.confirmation === 'DELETE' ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                opacity: formData.confirmation === 'DELETE' ? 1 : 0.5
              }}
            >
              {isLoading ? 'Lösche...' : 'Account löschen'}
            </button>
          </div>
        </form>

        <div className="additional-info" style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#333',
          borderRadius: '5px',
          fontSize: '14px',
          color: '#ccc'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>Was wird gelöscht:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Ihr Benutzerkonto</li>
            <li>Alle Watchlist-Einträge</li>
            <li>Alle persönlichen Daten</li>
            <li>Alle Einstellungen</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
